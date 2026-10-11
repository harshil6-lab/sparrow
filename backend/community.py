"""Community v1 storage and validation.

The community table is intentionally separate from household data. All
identity-sensitive values come from the verified JWT subject supplied by the
handler.
"""
import base64
import json
import os
import re
import uuid
from datetime import datetime, timedelta, timezone

from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

import store
from validation import HttpError, content_type, integer, only_fields, query_integer, text

MAX_PHOTO_BYTES = 5 * 1024 * 1024
PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
TAGS = {"energy_saving", "solar", "trees", "waste", "water", "community_drive", "other"}
REACTIONS = {"grow", "sun", "cheer", "love", "idea"}
REPORT_REASONS = {"spam", "inappropriate", "unsafe", "other"}
COUNTS = {key: 0 for key in REACTIONS}


def _now():
    return store.now_iso()


def _author(sub):
    return f"AUTHOR#{sub}"


def _meta_key(post_id):
    return {"pk": f"POST#{post_id}", "sk": "META"}


def _decode_cursor(value):
    if not value:
        return None
    try:
        raw = base64.urlsafe_b64decode(value.encode()).decode()
        key = json.loads(raw)
        if not isinstance(key, dict) or "pk" not in key or "sk" not in key:
            raise ValueError
        return key
    except (ValueError, TypeError, json.JSONDecodeError):
        raise HttpError(400, "cursor is invalid")


def _encode_cursor(key):
    if not key:
        return None
    raw = json.dumps(key, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _profile_name(sub):
    profile = store.ensure_profile(sub)
    if not profile.get("displayName"):
        raise HttpError(400, "a profile displayName is required", "needs_display_name")
    return profile["displayName"]


def _comment_author(sub):
    """Comment authors never block a valid body.

    The contract defines a comment as {text} only, so a comment must not fail
    with needs_display_name when the account has not named itself yet. Posts
    still require a display name; comments fall back to a neutral label.
    """
    profile = store.ensure_profile(sub)
    return profile.get("displayName") or "Sparrow user"


def _head_photo(key):
    try:
        return store.s3().head_object(Bucket=os.environ["BUCKET"], Key=key)
    except ClientError:
        raise HttpError(400, "photo object is missing or invalid", "invalid_photo")


def _moderate(key):
    if os.environ.get("MODERATION_MODE", "on").lower() == "off":
        return
    try:
        result = store.rekognition().detect_moderation_labels(
            Image={"S3Object": {"Bucket": os.environ["BUCKET"], "Name": key}},
            MinConfidence=80,
        )
    except Exception:
        raise HttpError(503, "moderation is temporarily unavailable", "moderation_unavailable")
    blocked = {"Explicit Nudity", "Violence", "Visually Disturbing", "Hate Symbols", "Drugs"}
    if any(label.get("Name") in blocked and label.get("Confidence", 0) >= 80
           for label in result.get("ModerationLabels", [])):
        try:
            store.s3().delete_object(Bucket=os.environ["BUCKET"], Key=key)
        except ClientError:
            pass
        raise HttpError(400, "photo did not pass moderation", "moderation_rejected")


def _delete_object(key):
    if key:
        store.s3().delete_object(Bucket=os.environ["BUCKET"], Key=key)


def _get_meta(post_id):
    return store.community_table().get_item(Key=_meta_key(post_id)).get("Item")


def _visible(meta, sub):
    return meta and (meta.get("status") == "visible" or meta.get("authorSub") == sub)


def _reaction(sub, post_id):
    item = store.community_table().get_item(
        Key={"pk": f"POST#{post_id}", "sk": f"REACT#{sub}"}
    ).get("Item")
    return item.get("type") if item else None


def _view(meta, sub):
    if not _visible(meta, sub):
        raise HttpError(404, "post not found", "not_found")
    photo_url = None
    if meta.get("photoKey"):
        photo_url = store.s3().generate_presigned_url(
            "get_object",
            Params={"Bucket": os.environ["BUCKET"], "Key": meta["photoKey"]},
            ExpiresIn=300,
        )
    return {
        "id": meta["postId"],
        "authorName": meta["authorName"],
        "isMine": meta["authorSub"] == sub,
        "caption": meta["caption"],
        "tag": meta["tag"],
        "photoUrl": photo_url,
        "createdAt": meta["createdAt"],
        "reactionCounts": {key: int(meta.get("reactionCounts", {}).get(key, 0)) for key in REACTIONS},
        "myReaction": _reaction(sub, meta["postId"]),
        "commentCount": int(meta.get("commentCount", 0)),
    }


def feed(sub, limit, cursor):
    limit = query_integer(limit, "limit", 1, 20)
    kwargs = {
        "IndexName": "GSI1",
        "KeyConditionExpression": Key("gsi1pk").eq("FEED"),
        "ScanIndexForward": False,
        "Limit": limit,
    }
    start = _decode_cursor(cursor)
    if start:
        kwargs["ExclusiveStartKey"] = start
    page = store.community_table().query(**kwargs)
    posts = [_view(item, sub) for item in page.get("Items", []) if _visible(item, sub)]
    return {"posts": posts, "cursor": _encode_cursor(page.get("LastEvaluatedKey"))}


def upload_ticket(sub, body):
    only_fields(body, ("contentType", "size"))
    content = content_type(body.get("contentType"))
    size = integer(body.get("size"), "size", 1, MAX_PHOTO_BYTES)
    key = f"c/{sub}/{uuid.uuid4()}.{PHOTO_TYPES[content]}"
    result = store.s3().generate_presigned_post(
        Bucket=os.environ["BUCKET"], Key=key,
        Fields={"Content-Type": content, "key": key},
        Conditions=[
            {"Content-Type": content}, {"key": key},
            ["content-length-range", 1, MAX_PHOTO_BYTES],
        ],
        ExpiresIn=300,
    )
    return {**result, "key": key, "maxBytes": MAX_PHOTO_BYTES, "expiresIn": 300, "size": size}


def _rate_count(sub, prefix, since):
    page = store.community_table().query(
        IndexName="GSI2", KeyConditionExpression=Key("gsi2pk").eq(_author(sub))
        & Key("gsi2sk").begins_with(prefix),
    )
    return sum(1 for item in page.get("Items", []) if item.get("createdAt", "") >= since)


def create_post(sub, body):
    only_fields(body, ("key", "caption", "tag", "confirmAdult"))
    key = body.get("key")
    prefix = f"c/{sub}/"
    if not isinstance(key, str) or not key.startswith(prefix):
        raise HttpError(400, "key does not belong to this user", "invalid_photo")
    caption = text(body.get("caption"), "caption", 500)
    tag = body.get("tag")
    if tag not in TAGS:
        raise HttpError(400, "tag is invalid")
    if body.get("confirmAdult") is not True:
        raise HttpError(400, "adult confirmation is required", "adult_confirmation_required")
    if _rate_count(sub, "POST#", (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()) >= 5:
        raise HttpError(429, "post rate limit reached", "rate_limited")
    head = _head_photo(key)
    if head.get("ContentType") not in PHOTO_TYPES or not 1 <= head.get("ContentLength", 0) <= MAX_PHOTO_BYTES:
        _delete_object(key)
        raise HttpError(400, "photo object is missing or invalid", "invalid_photo")
    try:
        _moderate(key)
    except HttpError:
        if os.environ.get("MODERATION_MODE", "on").lower() != "off":
            _delete_object(key)
        raise
    post_id = str(uuid.uuid4())
    created = _now()
    meta = {
        **_meta_key(post_id), "postId": post_id, "authorSub": sub,
        "authorName": _profile_name(sub), "caption": caption, "tag": tag,
        "photoKey": key, "createdAt": created, "status": "visible",
        "reactionCounts": dict(COUNTS), "commentCount": 0, "reportCount": 0,
        "gsi1pk": "FEED", "gsi1sk": f"{created}#{post_id}",
        "gsi2pk": _author(sub), "gsi2sk": f"POST#{post_id}#META",
    }
    store.community_table().put_item(Item=meta)
    return _view(meta, sub)


def get_post(sub, post_id):
    meta = _get_meta(post_id)
    view = _view(meta, sub)
    comments = store.community_table().query(
        KeyConditionExpression=Key("pk").eq(f"POST#{post_id}") & Key("sk").begins_with("COMMENT#"),
        Limit=50, ScanIndexForward=True,
    ).get("Items", [])
    view["comments"] = [
        {"id": item["commentId"], "authorName": item["authorName"], "text": item["text"],
         "createdAt": item["createdAt"], "isMine": item["authorSub"] == sub}
        for item in comments
    ]
    return view


def delete_post(sub, post_id):
    meta = _get_meta(post_id)
    if not meta or meta.get("authorSub") != sub:
        raise HttpError(404, "post not found", "not_found")
    table = store.community_table()
    query_kwargs = {"KeyConditionExpression": Key("pk").eq(f"POST#{post_id}")}
    items = []
    while True:
        page = table.query(**query_kwargs)
        items.extend(page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            break
        query_kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    requests = [{"DeleteRequest": {"Key": {"pk": i["pk"], "sk": i["sk"]}}} for i in items]
    for start in range(0, len(requests), 25):
        table.meta.client.batch_write_item(
            RequestItems={table.table_name: requests[start:start + 25]}
        )
    _delete_object(meta.get("photoKey"))
    return None


def set_reaction(sub, post_id, reaction_type):
    meta = _get_meta(post_id)
    if not _visible(meta, sub):
        raise HttpError(404, "post not found", "not_found")
    if reaction_type is not None and reaction_type not in REACTIONS:
        raise HttpError(400, "reaction type is invalid")
    table = store.community_table()
    old_item = table.get_item(Key={"pk": f"POST#{post_id}", "sk": f"REACT#{sub}"}).get("Item")
    old = old_item.get("type") if old_item else None
    if old == reaction_type:
        return _view(meta, sub)
    actions = []
    if old or reaction_type:
        names, values, assignments = {}, {":one": 1, ":zero": 0}, []
        if old:
            names["#old"] = old
            assignments.append("reactionCounts.#old = reactionCounts.#old - :one")
        if reaction_type:
            names["#new"] = reaction_type
            assignments.append("reactionCounts.#new = if_not_exists(reactionCounts.#new, :zero) + :one")
        actions.append({"Update": {"TableName": table.table_name, "Key": _meta_key(post_id),
            "UpdateExpression": "SET " + ", ".join(assignments),
            "ExpressionAttributeNames": names, "ExpressionAttributeValues": values}})
    if reaction_type:
        actions.append({"Put": {"TableName": table.table_name,
            "Item": {"pk": f"POST#{post_id}", "sk": f"REACT#{sub}", "type": reaction_type,
                     "authorSub": sub, "gsi2pk": _author(sub), "gsi2sk": f"POST#{post_id}#REACT#{sub}"}}})
    elif old:
        actions.append({"Delete": {"TableName": table.table_name, "Key": {"pk": f"POST#{post_id}", "sk": f"REACT#{sub}"}}})
    table.meta.client.transact_write_items(TransactItems=actions)
    return _view(_get_meta(post_id), sub)


def list_comments(sub, post_id, cursor):
    if not _visible(_get_meta(post_id), sub):
        raise HttpError(404, "post not found", "not_found")
    kwargs = {"KeyConditionExpression": Key("pk").eq(f"POST#{post_id}") & Key("sk").begins_with("COMMENT#"),
              "Limit": 50, "ScanIndexForward": True}
    start = _decode_cursor(cursor)
    if start:
        kwargs["ExclusiveStartKey"] = start
    page = store.community_table().query(**kwargs)
    return {"comments": [{"id": i["commentId"], "authorName": i["authorName"], "text": i["text"],
                          "createdAt": i["createdAt"], "isMine": i["authorSub"] == sub}
                         for i in page.get("Items", [])], "cursor": _encode_cursor(page.get("LastEvaluatedKey"))}


def add_comment(sub, post_id, body):
    only_fields(body, ("text",))
    if not _visible(_get_meta(post_id), sub):
        raise HttpError(404, "post not found", "not_found")
    if _rate_count(sub, f"POST#{post_id}#COMMENT#", (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()) >= 30:
        raise HttpError(429, "comment rate limit reached", "rate_limited")
    value = re.sub(r"<[^>]*>", "", text(body.get("text"), "text", 300))
    if not value:
        raise HttpError(400, "text must not be empty")
    cid, created = str(uuid.uuid4()), _now()
    item = {"pk": f"POST#{post_id}", "sk": f"COMMENT#{created}#{cid}", "commentId": cid,
            "authorSub": sub, "authorName": _comment_author(sub), "text": value, "createdAt": created,
            "gsi2pk": _author(sub), "gsi2sk": f"POST#{post_id}#COMMENT#{created}#{cid}"}
    table = store.community_table()
    table.meta.client.transact_write_items(TransactItems=[
        {"Put": {"TableName": table.table_name, "Item": item}},
        {"Update": {"TableName": table.table_name, "Key": _meta_key(post_id),
                    "UpdateExpression": "SET commentCount = if_not_exists(commentCount, :zero) + :one",
                    "ExpressionAttributeValues": {":zero": 0, ":one": 1}}},
    ])
    return {"id": cid, "authorName": item["authorName"], "text": value, "createdAt": created, "isMine": True}


def delete_comment(sub, post_id, cid):
    table = store.community_table()
    comment_items = table.query(
        KeyConditionExpression=Key("pk").eq(f"POST#{post_id}") & Key("sk").begins_with("COMMENT#")
    ).get("Items", [])
    item = next((i for i in comment_items if i.get("commentId") == cid), None)
    meta = _get_meta(post_id)
    if not item or not meta or (item.get("authorSub") != sub and meta.get("authorSub") != sub):
        raise HttpError(404, "comment not found", "not_found")
    table.meta.client.transact_write_items(TransactItems=[
        {"Delete": {"TableName": table.table_name, "Key": {"pk": item["pk"], "sk": item["sk"]}}},
        {"Update": {"TableName": table.table_name, "Key": _meta_key(post_id),
                    "UpdateExpression": "SET commentCount = commentCount - :one",
                    "ConditionExpression": "commentCount >= :one",
                    "ExpressionAttributeValues": {":one": 1}}},
    ])


def report(sub, post_id, reason):
    if reason not in REPORT_REASONS:
        raise HttpError(400, "report reason is invalid")
    meta = _get_meta(post_id)
    if not meta or meta.get("authorSub") == sub:
        raise HttpError(404, "post not found", "not_found")
    table = store.community_table()
    key = {"pk": f"POST#{post_id}", "sk": f"REPORT#{sub}"}
    if table.get_item(Key=key).get("Item"):
        return
    count = int(meta.get("reportCount", 0)) + 1
    table.meta.client.transact_write_items(TransactItems=[
        {"Put": {"TableName": table.table_name, "Item": {**key, "authorSub": sub, "reason": reason,
            "gsi2pk": _author(sub), "gsi2sk": f"POST#{post_id}#REPORT#{sub}"}}},
        {"Update": {"TableName": table.table_name, "Key": _meta_key(post_id),
            "UpdateExpression": "SET reportCount = :count, #status = :status",
            "ExpressionAttributeNames": {"#status": "status"},
            "ExpressionAttributeValues": {":count": count, ":status": "hidden" if count >= 3 else meta.get("status", "visible")}}},
    ])


def delete_user(sub):
    """Delete community items authored or created by a user and repair counters."""
    table = store.community_table()
    items = []
    query_kwargs = {"IndexName": "GSI2", "KeyConditionExpression": Key("gsi2pk").eq(_author(sub))}
    while True:
        page = table.query(**query_kwargs)
        items.extend(page.get("Items", []))
        if not page.get("LastEvaluatedKey"):
            break
        query_kwargs["ExclusiveStartKey"] = page["LastEvaluatedKey"]
    deleted_posts = set()
    for item in items:
        gsi_key = item.get("gsi2sk", "")
        if item.get("sk") == "META":
            delete_post(sub, item["postId"])
            deleted_posts.add(item["postId"])
        elif gsi_key.endswith("#REACT#" + sub):
            post_id = item["pk"].split("#", 1)[1]
            if post_id in deleted_posts:
                continue
            set_reaction(sub, post_id, None)
        elif gsi_key.endswith("#COMMENT#" + item.get("commentId", "")):
            post_id = item["pk"].split("#", 1)[1]
            if post_id not in deleted_posts:
                delete_comment(sub, post_id, item["commentId"])
        elif gsi_key.endswith("#REPORT#" + sub):
            post_id = item["pk"].split("#", 1)[1]
            if post_id in deleted_posts:
                continue
            meta = _get_meta(post_id)
            if meta:
                table.update_item(
                    Key=_meta_key(post_id),
                    UpdateExpression="SET reportCount = if_not_exists(reportCount, :zero) - :one",
                    ConditionExpression="reportCount >= :one",
                    ExpressionAttributeValues={":zero": 0, ":one": 1},
                )
            table.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
        else:
            table.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
