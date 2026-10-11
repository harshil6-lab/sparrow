"""Input validation for the Sparrow API.

Everything a client sends is untrusted. Types and ranges are checked here and
a bad request raises HttpError, so a route answers with a clean 400 instead of
leaking a stack trace. Standard library only.
"""
import json
import re

#: Hard cap on a request body, checked before we try to parse it.
MAX_BODY_BYTES = 8 * 1024

MONTH_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")
TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
WEEKDAYS = ("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
#: The ten languages the app ships (mirrors frontend/src/i18n/languages.ts).
LANGUAGES = ("en", "hi", "gu", "mr", "bn", "ta", "te", "kn", "ml", "pa")
#: Missions a user is allowed to complete.
MISSION_IDS = ("standby_sweep", "ac", "daylight", "geyser")

PROFILE_FIELDS = ("language", "introSeen", "setupDone", "home", "prefs", "displayName")
BILL_FIELDS = ("month", "units", "amount")
PHOTO_UPLOAD_FIELDS = ("contentType", "size")
PHOTO_ATTACH_FIELDS = ("key",)

MAX_TEXT = 60
MAX_APPLIANCES = 20
MAX_DAYS = 7
DISPLAY_NAME_RE = re.compile(r"^[A-Za-z0-9 .\-_']+$")


class HttpError(Exception):
    """An error that is safe to hand back to the client."""

    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code or ("validation_error" if status < 500 else "internal_error")


def only_fields(body, allowed):
    """Reject unknown keys so a typo never silently does nothing."""
    extra = sorted(set(body) - set(allowed))
    if extra:
        raise HttpError(400, "unknown field(s): " + ", ".join(extra))
    return body


def parse_body(event):
    """Decode and size-check the JSON body. Returns {} when there is none."""
    raw = event.get("body")
    if raw is None or raw == "":
        return {}
    if isinstance(raw, (bytes, bytearray)):
        try:
            raw = raw.decode("utf-8")
        except UnicodeDecodeError:
            raise HttpError(400, "body must be UTF-8")
    if not isinstance(raw, str):
        raise HttpError(400, "body must be a JSON string")
    if len(raw.encode("utf-8")) > MAX_BODY_BYTES:
        raise HttpError(400, "body is too large")
    try:
        parsed = json.loads(raw)
    except ValueError:
        raise HttpError(400, "body is not valid JSON")
    if not isinstance(parsed, dict):
        raise HttpError(400, "body must be a JSON object")
    return parsed


def text(value, field, max_len=MAX_TEXT, allow_empty=False):
    if not isinstance(value, str):
        raise HttpError(400, f"{field} must be a string")
    value = value.strip()
    if not value and not allow_empty:
        raise HttpError(400, f"{field} must not be empty")
    if len(value) > max_len:
        raise HttpError(400, f"{field} must be at most {max_len} characters")
    return value


def optional_text(value, field, max_len=MAX_TEXT):
    """Empty string and null both mean "not set"."""
    if value is None:
        return None
    if not isinstance(value, str):
        raise HttpError(400, f"{field} must be a string")
    value = value.strip()
    if not value:
        return None
    if len(value) > max_len:
        raise HttpError(400, f"{field} must be at most {max_len} characters")
    return value


def boolean(value, field):
    if not isinstance(value, bool):
        raise HttpError(400, f"{field} must be a boolean")
    return value


def number(value, field, minimum, maximum):
    # bool is an int subclass in Python; it is never a valid reading.
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise HttpError(400, f"{field} must be a number")
    value = float(value)
    if value != value or value in (float("inf"), float("-inf")):
        raise HttpError(400, f"{field} must be a finite number")
    if value < minimum or value > maximum:
        raise HttpError(400, f"{field} must be between {minimum} and {maximum}")
    return value


def integer(value, field, minimum, maximum):
    if isinstance(value, bool) or not isinstance(value, int):
        raise HttpError(400, f"{field} must be an integer")
    if value < minimum or value > maximum:
        raise HttpError(400, f"{field} must be between {minimum} and {maximum}")
    return value


def query_integer(value, field, minimum, maximum):
    """Coerce API Gateway's string query parameters without loosening body validation."""
    if isinstance(value, bool):
        raise HttpError(400, f"{field} must be an integer")
    if isinstance(value, str) and re.fullmatch(r"[0-9]+", value):
        value = int(value)
    elif not isinstance(value, int):
        raise HttpError(400, f"{field} must be an integer")
    if value < minimum or value > maximum:
        raise HttpError(400, f"{field} must be between {minimum} and {maximum}")
    return value


def month(value):
    if not isinstance(value, str) or not MONTH_RE.match(value):
        raise HttpError(400, "month must be formatted as YYYY-MM")
    return value


def content_type(value):
    allowed = ("image/jpeg", "image/png", "image/webp")
    if not isinstance(value, str) or value not in allowed:
        raise HttpError(400, "contentType must be image/jpeg, image/png, or image/webp")
    return value


def language(value):
    if not isinstance(value, str) or value not in LANGUAGES:
        raise HttpError(400, "language must be one of: " + ", ".join(LANGUAGES))
    return value


def display_name(value):
    if not isinstance(value, str):
        raise HttpError(400, "displayName must be a string")
    value = value.strip()
    if len(value) < 2 or len(value) > 40 or not DISPLAY_NAME_RE.fullmatch(value):
        raise HttpError(400, "displayName must be 2-40 letters, digits, spaces, or .-_\'")
    return value


def home(value):
    """Validate a partial `home` object; unknown keys are rejected."""
    if not isinstance(value, dict):
        raise HttpError(400, "home must be an object")
    only_fields(value, ("type", "people", "city", "appliances"))
    out = {}
    if "type" in value:
        out["type"] = optional_text(value["type"], "home.type", 40)
    if "people" in value:
        out["people"] = optional_text(value["people"], "home.people", 40)
    if "city" in value:
        out["city"] = optional_text(value["city"], "home.city", 60)
    if "appliances" in value:
        items = value["appliances"]
        if not isinstance(items, list) or len(items) > MAX_APPLIANCES:
            raise HttpError(400, f"home.appliances must be a list of at most {MAX_APPLIANCES} items")
        out["appliances"] = [text(item, "home.appliances[]", 40) for item in items]
    return out


def reminders(value):
    if not isinstance(value, dict):
        raise HttpError(400, "prefs.reminders must be an object")
    only_fields(value, ("enabled", "time", "days"))
    out = {}
    if "enabled" in value:
        out["enabled"] = boolean(value["enabled"], "prefs.reminders.enabled")
    if "time" in value:
        raw = value["time"]
        if not isinstance(raw, str) or not TIME_RE.match(raw):
            raise HttpError(400, "prefs.reminders.time must be HH:MM")
        out["time"] = raw
    if "days" in value:
        days = value["days"]
        if not isinstance(days, list) or len(days) > MAX_DAYS:
            raise HttpError(400, f"prefs.reminders.days must be a list of at most {MAX_DAYS} weekdays")
        for day in days:
            if not isinstance(day, str) or day not in WEEKDAYS:
                raise HttpError(400, "prefs.reminders.days must be weekday names like 'Mon'")
        out["days"] = sorted(set(days))
    return out


def prefs(value):
    if not isinstance(value, dict):
        raise HttpError(400, "prefs must be an object")
    only_fields(value, ("wifiOnly", "reminders"))
    out = {}
    if "wifiOnly" in value:
        out["wifiOnly"] = boolean(value["wifiOnly"], "prefs.wifiOnly")
    if "reminders" in value:
        out["reminders"] = reminders(value["reminders"])
    return out