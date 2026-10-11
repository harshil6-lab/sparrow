"""DynamoDB single-table access for the Sparrow API.

One partition per Cognito user, keyed by the verified JWT `sub`:

    pk = USER#<sub>
    sk = PROFILE | BILL#YYYY-MM | MISSION#<id>#YYYY-MM-DD

Every read and write in the API goes through this module, and every one of them
is scoped to that partition, so one user can never reach another user's items.
"""
import os
from datetime import datetime, timezone
from decimal import Decimal

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config

#: A household is never expected to store more than ten years of bills.
MAX_BILLS = 120
#: DynamoDB BatchWriteItem accepts at most 25 requests per call.
BATCH = 25
PROFILE_SK = "PROFILE"
BILL_PREFIX = "BILL#"
MISSION_PREFIX = "MISSION#"

_table = None
_s3 = None
_rekognition = None


def table():
    global _table
    if _table is None:
        _table = boto3.resource("dynamodb").Table(os.environ["TABLE"])
    return _table


_community_table = None


def community_table():
    global _community_table
    if _community_table is None:
        _community_table = boto3.resource("dynamodb").Table(
            os.environ.get("COMMUNITY_TABLE", "CommunityTable")
        )
    return _community_table


def set_community_table(value):
    global _community_table
    _community_table = value


def set_table(value):
    """Test seam: point the module at a moto (or local) table."""
    global _table
    _table = value


def s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            region_name=os.environ.get("AWS_REGION", "ap-south-1"),
            endpoint_url=os.environ.get("S3_ENDPOINT_URL"),
            config=Config(signature_version="s3v4", s3={"addressing_style": "virtual"}),
        )
    return _s3


def set_s3(value):
    global _s3
    _s3 = value


def rekognition():
    global _rekognition
    if _rekognition is None:
        _rekognition = boto3.client("rekognition", region_name=os.environ.get("AWS_REGION", "ap-south-1"))
    return _rekognition


def set_rekognition(value):
    global _rekognition
    _rekognition = value


def partition(sub):
    return f"USER#{sub}"


def now_iso():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def number(value):
    """DynamoDB gives numbers back as Decimal; JSON wants int or float."""
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    return value


def decimal(value):
    """boto3 refuses a Python float; Decimal is what DynamoDB stores."""
    return Decimal(str(value))


def _query(sub, sk_prefix=None):
    """One user's items; optionally only those whose sort key starts with a prefix.

    A prefix of None means the whole partition - DynamoDB rejects an empty
    string as a key value, so `begins_with` is not used for that case.
    """
    condition = Key("pk").eq(partition(sub))
    if sk_prefix:
        condition = condition & Key("sk").begins_with(sk_prefix)
    kwargs = {"KeyConditionExpression": condition}
    items = []
    while True:
        page = table().query(**kwargs)
        items.extend(page.get("Items", []))
        start = page.get("LastEvaluatedKey")
        if not start:
            return items
        kwargs["ExclusiveStartKey"] = start


# --- profile ---------------------------------------------------------------

def default_profile():
    """What a brand new account starts with: nothing invented, nothing shown."""
    return {
        "language": "en",
        "introSeen": False,
        "setupDone": False,
        "home": {"type": None, "people": None, "city": None, "appliances": []},
        "prefs": {"wifiOnly": False, "reminders": {"enabled": False, "time": "20:00", "days": []}},
        "displayName": None,
        "createdAt": now_iso(),
    }


def _profile_view(item):
    defaults = default_profile()
    return {
        "language": item.get("language", defaults["language"]),
        "introSeen": bool(item.get("introSeen", False)),
        "setupDone": bool(item.get("setupDone", False)),
        "home": item.get("home") or defaults["home"],
        "prefs": item.get("prefs") or defaults["prefs"],
        "createdAt": item.get("createdAt"),
        "displayName": item.get("displayName"),
    }


def get_profile(sub):
    item = table().get_item(Key={"pk": partition(sub), "sk": PROFILE_SK}).get("Item")
    return _profile_view(item) if item else None


def put_profile(sub, doc):
    table().put_item(Item={**doc, "pk": partition(sub), "sk": PROFILE_SK})
    return doc


def ensure_profile(sub):
    """GET /me on a fresh account creates the default profile on first call."""
    doc = get_profile(sub)
    if doc is None:
        doc = default_profile()
        put_profile(sub, doc)
    return doc


# --- bills -----------------------------------------------------------------

def bill_view(item):
    bill = {
        "month": item["sk"].split("#", 1)[1],
        "units": number(item["units"]),
        "verified": bool(item.get("verified", False)),
        "createdAt": item.get("createdAt"),
        "hasPhoto": bool(item.get("photoKey")),
    }
    if item.get("amount") is not None:
        bill["amount"] = number(item["amount"])
    return bill


def list_bills(sub):
    """Oldest first, so 'the previous month' is simply the one before."""
    bills = [bill_view(item) for item in _query(sub, BILL_PREFIX)]
    bills.sort(key=lambda bill: bill["month"])
    return bills


def get_bill(sub, month):
    item = table().get_item(Key={"pk": partition(sub), "sk": BILL_PREFIX + month}).get("Item")
    return bill_view(item) if item else None


def get_bill_item(sub, month):
    return table().get_item(Key={"pk": partition(sub), "sk": BILL_PREFIX + month}).get("Item")


def put_bill(sub, month, units, amount, verified):
    existing = get_bill_item(sub, month) or {}
    item = {
        "pk": partition(sub),
        "sk": BILL_PREFIX + month,
        "units": decimal(units),
        "verified": verified,
        "createdAt": now_iso(),
    }
    if existing.get("photoKey"):
        item["photoKey"] = existing["photoKey"]
    if existing.get("photoAt"):
        item["photoAt"] = existing["photoAt"]
    if amount is not None:
        item["amount"] = decimal(amount)
    table().put_item(Item=item)
    return bill_view(item)


def attach_photo(sub, month, key):
    item = get_bill_item(sub, month)
    if item is None:
        return None
    old_key = item.get("photoKey")
    item["photoKey"] = key
    item["photoAt"] = now_iso()
    table().put_item(Item=item)
    return old_key


def clear_photo(sub, month):
    item = get_bill_item(sub, month)
    if item is None:
        return None
    old_key = item.pop("photoKey", None)
    item.pop("photoAt", None)
    table().put_item(Item=item)
    return old_key


# --- missions --------------------------------------------------------------

def list_missions(sub):
    """Completed missions, most recent first. Bills - and so the world state -
    are never touched here."""
    done = []
    for item in _query(sub, MISSION_PREFIX):
        _, mission_id, date = item["sk"].split("#", 2)
        done.append({"id": mission_id, "date": date})
    done.sort(key=lambda entry: (entry["date"], entry["id"]), reverse=True)
    return done


def put_mission(sub, mission_id, date):
    item = {"pk": partition(sub), "sk": f"MISSION#{mission_id}#{date}", "createdAt": now_iso()}
    table().put_item(Item=item)
    return {"id": mission_id, "date": date}


# --- delete ----------------------------------------------------------------

def delete_user(sub):
    """Remove every item under USER#<sub>. Chunked at 25 for BatchWriteItem."""
    keys = [{"pk": item["pk"], "sk": item["sk"]} for item in _query(sub)]
    for start in range(0, len(keys), BATCH):
        chunk = keys[start:start + BATCH]
        request = {table().table_name: [{"DeleteRequest": {"Key": key}} for key in chunk]}
        table().meta.client.batch_write_item(RequestItems=request)
    return len(keys)


def delete_user_photos(sub, bucket=None):
    bucket = bucket or os.environ["BUCKET"]
    prefix = f"u/{sub}/"
    client = s3()
    token = None
    while True:
        kwargs = {"Bucket": bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        page = client.list_objects_v2(**kwargs)
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        for start in range(0, len(objects), 1000):
            client.delete_objects(Bucket=bucket, Delete={"Objects": objects[start:start + 1000]})
        if not page.get("IsTruncated"):
            return
        token = page.get("NextContinuationToken")
