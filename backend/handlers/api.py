"""Authenticated HTTP API for Sparrow.

Identity always comes from the verified Cognito JWT (`claims.sub`) that API
Gateway puts on the request. A user id sent in the body or path is ignored, so
one account can never read or write another account's items.

Handlers are wired one per route group in infra/template.yaml. The only public
route is GET /hello.
"""
import functools
import json
import sys
import traceback
import os
import uuid
from botocore.exceptions import ClientError
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

import impact
import community as community_store
import store
import validation
from validation import HttpError

JSON_HEADERS = {"Content-Type": "application/json; charset=utf-8"}


def _response(status, body):
    if status == 204:
        return {"statusCode": 204, "headers": {}, "body": ""}
    return {
        "statusCode": status,
        "headers": JSON_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=float),
    }


def _error(status, message, code, request_id=None):
    headers = {**JSON_HEADERS, "X-Sparrow-Error-Code": code}
    if request_id:
        headers["X-Sparrow-Request-Id"] = request_id
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps({"error": message, "code": code}, ensure_ascii=False),
    }


def route(handler):
    """Turn HttpError into a clean status code; log anything else and answer 500."""

    @functools.wraps(handler)
    def wrapper(event, context):
        try:
            return handler(event, context)
        except HttpError as exc:
            request_id = (event.get("requestContext") or {}).get("requestId")
            return _error(exc.status, exc.message, exc.code, request_id)
        except Exception as exc:  # noqa: BLE001 - never leak a stack trace to a client
            request_id = (event.get("requestContext") or {}).get("requestId")
            route_key = event.get("routeKey", "unknown")
            print(f"[sparrow] API failure route={route_key} request_id={request_id or 'unknown'} "
                  f"status=500 exception={type(exc).__name__}")
            traceback.print_exc()
            return _error(500, "internal server error", "internal_error", request_id)

    return wrapper


def _sub(event):
    """The caller's Cognito subject. Never a value the client chose."""
    try:
        claims = event["requestContext"]["authorizer"]["jwt"]["claims"]
        sub = claims["sub"]
    except (KeyError, TypeError):
        raise HttpError(401, "missing or invalid token")
    if not isinstance(sub, str) or not sub:
        raise HttpError(401, "missing or invalid token")
    return sub


def _path_param(event, name):
    params = event.get("pathParameters") or {}
    value = params.get(name)
    if not isinstance(value, str) or not value:
        raise HttpError(400, f"missing path parameter: {name}")
    return value


# --- public ----------------------------------------------------------------

def hello(event, context):
    return _response(200, {"ok": True, "service": "chiri"})


# --- profile ---------------------------------------------------------------

@route
def get_me(event, context):
    return _response(200, store.ensure_profile(_sub(event)))


@route
def put_me(event, context):
    sub = _sub(event)
    body = validation.only_fields(validation.parse_body(event), validation.PROFILE_FIELDS)
    patch = {}
    if "language" in body:
        patch["language"] = validation.language(body["language"])
    if "displayName" in body:
        patch["displayName"] = validation.display_name(body["displayName"])
    if "introSeen" in body:
        patch["introSeen"] = validation.boolean(body["introSeen"], "introSeen")
    if "setupDone" in body:
        patch["setupDone"] = validation.boolean(body["setupDone"], "setupDone")
    if "home" in body:
        patch["home"] = validation.home(body["home"])
    if "prefs" in body:
        patch["prefs"] = validation.prefs(body["prefs"])
    if not patch:
        raise HttpError(400, "nothing to update")

    doc = store.ensure_profile(sub)
    home = {**doc["home"], **patch["home"]} if "home" in patch else doc["home"]
    prefs = doc["prefs"]
    if "prefs" in patch:
        prefs = {**prefs, **{k: v for k, v in patch["prefs"].items() if k != "reminders"}}
        if "reminders" in patch["prefs"]:
            prefs["reminders"] = {**doc["prefs"]["reminders"], **patch["prefs"]["reminders"]}
    updated = {
        **doc,
        **{k: v for k, v in patch.items() if k not in ("home", "prefs")},
        "home": home,
        "prefs": prefs,
    }
    store.put_profile(sub, updated)
    return _response(200, updated)


@route
def post_intro_seen(event, context):
    sub = _sub(event)
    doc = store.ensure_profile(sub)
    if doc["introSeen"] is not True:
        doc = {**doc, "introSeen": True}
        store.put_profile(sub, doc)
    return _response(200, doc)


@route
def delete_me(event, context):
    sub = _sub(event)
    community_store.delete_user(sub)
    store.delete_user(sub)
    if os.environ.get("BUCKET"):
        store.delete_user_photos(sub)
    return _response(204, None)


# --- bills -----------------------------------------------------------------

def previous_month(month):
    year, mon = int(month[:4]), int(month[5:7])
    return f"{year - 1:04d}-12" if mon == 1 else f"{year:04d}-{mon - 1:02d}"


@route
def get_bills(event, context):
    return _response(200, {"bills": store.list_bills(_sub(event))})


PHOTO_MAX_BYTES = 5 * 1024 * 1024
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _photo_bill(event):
    sub = _sub(event)
    month = validation.month(_path_param(event, "month"))
    if store.get_bill_item(sub, month) is None:
        raise HttpError(404, "bill not found")
    return sub, month


def _photo_key(sub, month, key):
    prefix = f"u/{sub}/bills/{month}/"
    if not isinstance(key, str) or not key.startswith(prefix):
        raise HttpError(400, "key does not belong to this bill")
    return key


@route
def post_bill_photo_upload(event, context):
    sub = _sub(event)
    month = validation.month(_path_param(event, "month"))
    if store.get_bill_item(sub, month) is None:
        raise HttpError(404, "bill not found")
    body = validation.only_fields(validation.parse_body(event), validation.PHOTO_UPLOAD_FIELDS)
    content = validation.content_type(body.get("contentType"))
    validation.integer(body.get("size"), "size", 1, PHOTO_MAX_BYTES)
    key = f"u/{sub}/bills/{month}/{uuid.uuid4()}.{PHOTO_TYPES[content]}"
    fields = {"Content-Type": content, "key": key}
    conditions = [
        {"Content-Type": content},
        {"key": key},
        ["content-length-range", 1, PHOTO_MAX_BYTES],
    ]
    result = store.s3().generate_presigned_post(
        Bucket=os.environ["BUCKET"],
        Key=key,
        Fields=fields,
        Conditions=conditions,
        ExpiresIn=300,
    )
    return _response(200, {
        "url": result["url"],
        "fields": result["fields"],
        "key": key,
        "maxBytes": PHOTO_MAX_BYTES,
        "expiresIn": 300,
    })


@route
def post_bill_photo(event, context):
    sub, month = _photo_bill(event)
    body = validation.only_fields(validation.parse_body(event), validation.PHOTO_ATTACH_FIELDS)
    key = _photo_key(sub, month, body.get("key"))
    client = store.s3()
    try:
        head = client.head_object(Bucket=os.environ["BUCKET"], Key=key)
        content = head.get("ContentType")
        size = head.get("ContentLength")
        if content not in PHOTO_TYPES or not isinstance(size, int) or size < 1 or size > PHOTO_MAX_BYTES:
            raise ValueError("photo does not meet upload requirements")
    except (ClientError, ValueError):
        try:
            client.delete_object(Bucket=os.environ["BUCKET"], Key=key)
        except ClientError:
            pass
        raise HttpError(400, "photo object is missing or invalid")
    old_key = store.attach_photo(sub, month, key)
    if old_key and old_key != key:
        client.delete_object(Bucket=os.environ["BUCKET"], Key=old_key)
    return _response(200, {"photo": {"attached": True}})


@route
def get_bill_photo(event, context):
    sub, month = _photo_bill(event)
    item = store.get_bill_item(sub, month)
    key = item.get("photoKey")
    if not key:
        raise HttpError(404, "photo not found")
    url = store.s3().generate_presigned_url(
        "get_object",
        Params={
            "Bucket": os.environ["BUCKET"],
            "Key": key,
            "ResponseContentDisposition": "inline",
        },
        ExpiresIn=300,
    )
    return _response(200, {"url": url})


@route
def delete_bill_photo(event, context):
    sub, month = _photo_bill(event)
    old_key = store.clear_photo(sub, month)
    if old_key:
        store.s3().delete_object(Bucket=os.environ["BUCKET"], Key=old_key)
    return _response(204, None)


@route
def photo(event, context):
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    path = event.get("rawPath", "")
    if method == "POST" and path.endswith("/photo/upload"):
        return post_bill_photo_upload.__wrapped__(event, context)
    if method == "POST" and path.endswith("/photo"):
        return post_bill_photo.__wrapped__(event, context)
    if method == "GET" and path.endswith("/photo"):
        return get_bill_photo.__wrapped__(event, context)
    if method == "DELETE" and path.endswith("/photo"):
        return delete_bill_photo.__wrapped__(event, context)
    raise HttpError(404, "unknown photo route")


@route
def post_bills(event, context):
    sub = _sub(event)
    body = validation.only_fields(validation.parse_body(event), validation.BILL_FIELDS)
    month = validation.month(body.get("month"))
    units = validation.integer(body.get("units"), "units", 1, 5000)
    amount = None
    if "amount" in body:
        amount = validation.integer(body["amount"], "amount", 1, 100000)

    bills = store.list_bills(sub)
    is_new_month = all(bill["month"] != month for bill in bills)
    if is_new_month and len(bills) >= store.MAX_BILLS:
        raise HttpError(400, f"bill limit reached ({store.MAX_BILLS})")

    # Verification is computed here, against the user's own previous month.
    previous = next((bill for bill in bills if bill["month"] == previous_month(month)), None)
    factor = impact.load_config().get("grid_emission_factor_kg_per_kwh")
    if previous is None:
        verification = {"baseline": True}
        verified = False
    else:
        result = impact.mission_result(previous["units"], units)
        verification = dict(result)
        if factor is not None:
            verification["co2_kg"] = round(impact.co2_kg(result["kwh_saved"], factor), 2)
        verification["rupees_saved"] = impact.rupees_saved(
            result["kwh_saved"], previous.get("amount"), previous["units"]
        )
        verified = result["verified"]

    bill = store.put_bill(sub, month, units, amount, verified)
    return _response(200, {"bill": bill, "verification": verification})


# --- missions --------------------------------------------------------------

@route
def get_missions(event, context):
    return _response(200, {"missions": store.list_missions(_sub(event))})


@route
def complete_mission(event, context):
    sub = _sub(event)
    mission_id = _path_param(event, "id")
    if mission_id not in validation.MISSION_IDS:
        raise HttpError(404, "unknown mission")
    return _response(200, store.put_mission(sub, mission_id, store.today()))


# --- community -------------------------------------------------------------

@route
def community(event, context):
    sub = _sub(event)
    method = (event.get("requestContext", {}).get("http", {}).get("method") or "").upper()
    path = event.get("rawPath", "")
    body = validation.parse_body(event)
    if method == "GET" and path.endswith("/community/feed"):
        query = event.get("queryStringParameters") or {}
        return _response(200, community_store.feed(sub, query.get("limit", 20), query.get("cursor")))
    if method == "POST" and path.endswith("/community/upload-ticket"):
        return _response(200, community_store.upload_ticket(sub, body))
    if method == "POST" and path.endswith("/community/posts"):
        return _response(200, community_store.create_post(sub, body))
    post_id = _path_param(event, "id")
    if method == "GET" and path.endswith(f"/community/posts/{post_id}"):
        return _response(200, community_store.get_post(sub, post_id))
    if method == "DELETE" and path.endswith(f"/community/posts/{post_id}"):
        community_store.delete_post(sub, post_id)
        return _response(204, None)
    if method == "PUT" and path.endswith(f"/community/posts/{post_id}/reaction"):
        payload = validation.only_fields(body, ("type",))
        reaction_type = payload.get("type")
        return _response(200, community_store.set_reaction(sub, post_id, reaction_type))
    if method == "GET" and path.endswith(f"/community/posts/{post_id}/comments"):
        query = event.get("queryStringParameters") or {}
        return _response(200, community_store.list_comments(sub, post_id, query.get("cursor")))
    if method == "POST" and path.endswith(f"/community/posts/{post_id}/comments"):
        return _response(200, community_store.add_comment(sub, post_id, body))
    if method == "DELETE" and "/comments/" in path:
        cid = _path_param(event, "cid")
        community_store.delete_comment(sub, post_id, cid)
        return _response(204, None)
    if method == "POST" and path.endswith(f"/community/posts/{post_id}/report"):
        payload = validation.only_fields(body, ("reason",))
        community_store.report(sub, post_id, payload.get("reason"))
        return _response(204, None)
    raise HttpError(404, "unknown community route", "not_found")