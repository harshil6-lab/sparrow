import json
from pathlib import Path


def _display_name(call):
    status, body, _ = call("PUT", "/me", body={"displayName": "Asha Rao"})
    assert status == 200
    assert body["displayName"] == "Asha Rao"


def _photo(call, s3, key="c/user-a/photo.jpg"):
    s3.put_object(Bucket="sparrow-photos", Key=key, Body=b"jpeg", ContentType="image/jpeg")
    return key


def _post(call, s3, caption="Saved energy"):
    _display_name(call)
    key = _photo(call, s3)
    status, body, _ = call(
        "POST", "/community/posts",
        body={"key": key, "caption": caption, "tag": "energy_saving", "confirmAdult": True},
    )
    assert status == 200
    return body


def test_community_lifecycle_and_user_isolation(call, dynamo):
    import os
    import store

    os.environ["MODERATION_MODE"] = "off"
    post = _post(call, store.s3())
    post_id = post["id"]
    assert call("GET", "/community/feed")[1]["posts"][0]["id"] == post_id
    assert call("GET", "/community/feed", query={"limit": "20"})[0] == 200
    assert call("GET", "/community/posts/{id}", path_params={"id": post_id})[0] == 200
    assert call("GET", "/community/posts/{id}", sub="user-b", path_params={"id": post_id})[0] == 200
    assert call("PUT", "/community/posts/{id}/reaction", path_params={"id": post_id},
               body={"type": "grow"})[0] == 200
    assert call("PUT", "/community/posts/{id}/reaction", path_params={"id": post_id},
               body={"type": None})[0] == 200
    assert call("POST", "/community/posts/{id}/comments", path_params={"id": post_id},
               body={"text": "<b>Great</b>"})[0] == 200
    comments = call("GET", "/community/posts/{id}/comments", path_params={"id": post_id})[1]
    assert comments["comments"][0]["text"] == "Great"
    assert call("DELETE", "/community/posts/{id}", sub="user-b",
                path_params={"id": post_id})[0] == 404
    assert call("DELETE", "/community/posts/{id}", path_params={"id": post_id})[0] == 204
    assert call("GET", "/community/posts/{id}", path_params={"id": post_id})[0] == 404


def test_feed_query_contract_examples(call, dynamo):
    contract = json.loads((Path(__file__).parents[2] / "contracts" / "community-payloads.json").read_text())
    for example in contract["valid"]["feedQueries"]:
        assert call("GET", "/community/feed", query=example["query"])[0] == 200
    for example in contract["invalid"]:
        if "feedQuery" not in example:
            continue
        status, body, _ = call("GET", "/community/feed", query=example["feedQuery"]["query"])
        assert status == 400
        assert body["code"] == "validation_error" or body["code"] == "cursor is invalid"


def test_community_validation_and_display_name_requirement(call, dynamo):
    import os
    import store

    os.environ["MODERATION_MODE"] = "off"
    key = _photo(call, store.s3())
    status, body, _ = call(
        "POST", "/community/posts",
        body={"key": key, "caption": "x", "tag": "energy_saving", "confirmAdult": True},
    )
    assert status == 400 and body["code"] == "needs_display_name"
    status, body, _ = call("POST", "/community/posts", body={
        "key": "c/user-b/x.jpg", "caption": "x", "tag": "energy_saving", "confirmAdult": True})
    assert status == 400 and body["code"] == "invalid_photo"
    _display_name(call)
    status, body, _ = call("POST", "/community/posts", body={
        "key": key, "caption": "x", "tag": "energy_saving", "confirmAdult": False})
    assert status == 400 and body["code"] == "adult_confirmation_required"


def test_report_idempotency_and_auto_hide(call, dynamo):
    import os
    import store

    os.environ["MODERATION_MODE"] = "off"
    post = _post(call, store.s3())
    post_id = post["id"]
    for user in ("user-b", "user-c", "user-d"):
        _display_name_for_user(call, user)
        assert call("POST", "/community/posts/{id}/report", sub=user,
                    path_params={"id": post_id}, body={"reason": "spam"})[0] == 204
    assert call("GET", "/community/feed", sub="user-x")[1]["posts"] == []
    assert call("GET", "/community/feed", sub="user-a")[1]["posts"][0]["id"] == post_id


def _display_name_for_user(call, user):
    status, _, _ = call("PUT", "/me", sub=user, body={"displayName": f"User {user[-1]}"})
    assert status == 200


def test_delete_me_removes_authored_community_items(call, dynamo):
    import os
    import store

    os.environ["MODERATION_MODE"] = "off"
    post = _post(call, store.s3())
    assert call("DELETE", "/me")[0] == 204
    assert call("GET", "/community/feed")[1]["posts"] == []
    assert store.s3().list_objects_v2(Bucket="sparrow-photos", Prefix="c/user-a/").get("KeyCount", 0) == 0


def test_moderation_rejection_deletes_photo_and_unavailable_fails_closed(call, dynamo):
    import os
    import store

    class RejectingRekognition:
        def detect_moderation_labels(self, **kwargs):
            return {"ModerationLabels": [{"Name": "Violence", "Confidence": 99}]}

    os.environ["MODERATION_MODE"] = "on"
    _display_name(call)
    key = _photo(call, store.s3())
    store.set_rekognition(RejectingRekognition())
    status, body, _ = call("POST", "/community/posts", body={
        "key": key, "caption": "x", "tag": "energy_saving", "confirmAdult": True})
    assert status == 400 and body["code"] == "moderation_rejected"
    assert store.s3().list_objects_v2(Bucket="sparrow-photos", Prefix=key).get("KeyCount", 0) == 0

    class BrokenRekognition:
        def detect_moderation_labels(self, **kwargs):
            raise RuntimeError("unavailable")

    key = _photo(call, store.s3(), "c/user-a/retry.jpg")
    store.set_rekognition(BrokenRekognition())
    status, body, _ = call("POST", "/community/posts", body={
        "key": key, "caption": "x", "tag": "energy_saving", "confirmAdult": True})
    assert status == 503 and body["code"] == "moderation_unavailable"


def test_community_contract_examples_are_structured():
    path = Path(__file__).resolve().parents[2] / "contracts" / "community-payloads.json"
    payloads = json.loads(path.read_text(encoding="utf-8"))
    assert payloads["valid"]["post"]["confirmAdult"] is True
    assert payloads["valid"]["uploadTicket"]["size"] <= 5 * 1024 * 1024
    assert payloads["invalid"]
