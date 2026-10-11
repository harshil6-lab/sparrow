"""GET/PUT /me, POST /me/intro-seen and DELETE /me."""

import store


def test_first_get_creates_a_default_profile(call, dynamo):
    status, body, _ = call("GET", "/me")
    assert status == 200
    assert body["language"] == "en"
    assert body["introSeen"] is False
    assert body["setupDone"] is False
    assert body["home"] == {"type": None, "people": None, "city": None, "appliances": []}
    assert body["prefs"]["wifiOnly"] is False
    assert body["createdAt"]
    # persisted, so a second read is stable
    assert call("GET", "/me")[1]["createdAt"] == body["createdAt"]


def test_put_me_merges_a_partial_update(call, dynamo):
    call("GET", "/me")
    status, body, _ = call(
        "PUT",
        "/me",
        body={
            "language": "hi",
            "setupDone": True,
            "home": {"type": "apartment", "city": "Pune", "appliances": ["AC"]},
            "prefs": {"wifiOnly": True},
        },
    )
    assert status == 200
    assert body["language"] == "hi"
    assert body["setupDone"] is True
    assert body["home"] == {"type": "apartment", "people": None, "city": "Pune", "appliances": ["AC"]}
    assert body["prefs"]["wifiOnly"] is True
    # an untouched sub-object keeps its defaults
    assert body["prefs"]["reminders"]["time"] == "20:00"
    assert call("GET", "/me")[1] == body


def test_put_me_merges_reminders_without_dropping_siblings(call, dynamo):
    call("GET", "/me")
    _, body, _ = call("PUT", "/me", body={"prefs": {"reminders": {"enabled": True, "days": ["Mon"]}}})
    assert body["prefs"]["reminders"] == {"enabled": True, "time": "20:00", "days": ["Mon"]}
    assert body["prefs"]["wifiOnly"] is False


def test_intro_seen_route(call, dynamo):
    assert call("GET", "/me")[1]["introSeen"] is False
    status, body, _ = call("POST", "/me/intro-seen")
    assert status == 200 and body["introSeen"] is True
    assert call("GET", "/me")[1]["introSeen"] is True


def test_users_are_isolated(call, dynamo):
    call("PUT", "/me", sub="user-a", body={"language": "hi"})
    call("PUT", "/me", sub="user-b", body={"language": "ta"})
    assert call("GET", "/me", sub="user-a")[1]["language"] == "hi"
    assert call("GET", "/me", sub="user-b")[1]["language"] == "ta"


def test_rejects_a_client_supplied_user_id(call, dynamo):
    """`sub` in the body is an unknown field, never an identity."""
    status, body, _ = call("PUT", "/me", body={"sub": "user-b"})
    assert status == 400 and "unknown field" in body["error"]


# --- validation ------------------------------------------------------------

def test_missing_token_is_401(call, dynamo):
    status, body, _ = call("GET", "/me", claims=False)
    assert status == 401 and body["error"]


def test_unknown_field_is_400(call, dynamo):
    status, body, _ = call("PUT", "/me", body={"nickname": "x"})
    assert status == 400 and "unknown field" in body["error"]


def test_bad_language_is_400(call, dynamo):
    assert call("PUT", "/me", body={"language": "fr"})[0] == 400


def test_wrong_type_is_400(call, dynamo):
    assert call("PUT", "/me", body={"introSeen": "yes"})[0] == 400
    assert call("PUT", "/me", body={"home": "flat"})[0] == 400
    assert call("PUT", "/me", body={"prefs": {"wifiOnly": 1}})[0] == 400


def test_bad_reminder_values_are_400(call, dynamo):
    assert call("PUT", "/me", body={"prefs": {"reminders": {"time": "25:00"}}})[0] == 400
    assert call("PUT", "/me", body={"prefs": {"reminders": {"days": ["Funday"]}}})[0] == 400


def test_oversized_and_malformed_bodies_are_400(call, dynamo):
    assert call("PUT", "/me", body={"language": "x" * 4096})[0] == 400
    status, body, _ = call("PUT", "/me")
    assert status == 400 and "nothing to update" in body["error"]


# --- delete ----------------------------------------------------------------

def test_delete_removes_every_item_for_that_user_only(call, dynamo):
    call("GET", "/me", sub="user-a")
    call("PUT", "/me", sub="user-a", body={"language": "hi"})
    call("POST", "/bills", sub="user-a", body={"month": "2026-08", "units": 200})
    call("GET", "/me", sub="user-b")

    status, body, _ = call("DELETE", "/me", sub="user-a")
    assert status == 204 and body is None
    assert dynamo.scan()["Count"] == 1  # only user-b's profile survived
    assert call("GET", "/me", sub="user-a")[1]["language"] == "en"


def test_delete_handles_more_than_one_batch(call, dynamo):
    """BatchWriteItem caps at 25, so 30+ items must still all go."""
    call("GET", "/me")
    for index in range(30):
        month = f"{2020 + index // 12:04d}-{index % 12 + 1:02d}"
        call("POST", "/bills", body={"month": month, "units": 100})

    assert call("DELETE", "/me")[0] == 204
    assert dynamo.scan()["Count"] == 0
    assert store.list_bills("user-a") == []
