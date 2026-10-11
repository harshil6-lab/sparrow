import json
from pathlib import Path

import boto3

import validation


ROOT = Path(__file__).resolve().parents[2]


def _photo_path(month="2026-08"):
    return {"month": month}


def test_upload_validation_contract(call, dynamo):
    contract = json.loads((ROOT / "contracts" / "bill-photo.json").read_text())
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    for body in contract["upload"]["valid"]:
        assert call("POST", "/bills/{month}/photo/upload", body=body, path_params=_photo_path())[0] == 200
    for body in contract["upload"]["invalid"]:
        assert call("POST", "/bills/{month}/photo/upload", body=body, path_params=_photo_path())[0] == 400


def test_presigned_post_has_size_condition(call, dynamo, monkeypatch):
    captured = {}

    class FakeS3:
        def generate_presigned_post(self, **kwargs):
            captured.update(kwargs)
            return {"url": "https://photos.example", "fields": kwargs["Fields"]}

    from backend.handlers import api
    call("POST", "/bills", body={"month": "2026-08", "units": 200})
    monkeypatch.setattr(api.store, "s3", lambda: FakeS3())
    assert call(
        "POST", "/bills/{month}/photo/upload",
        body={"contentType": "image/jpeg", "size": 100},
        path_params=_photo_path(),
    )[0] == 200
    assert ["content-length-range", 1, 5242880] in captured["Conditions"]


def test_attach_validation_contract():
    contract = json.loads((ROOT / "contracts" / "bill-photo.json").read_text())
    for body in contract["attach"]["valid"]:
        validation.only_fields(body, validation.PHOTO_ATTACH_FIELDS)
        from backend.handlers import api
        api._photo_key("user-a", "2026-08", body["key"])
    for body in contract["attach"]["invalid"]:
        try:
            validation.only_fields(body, validation.PHOTO_ATTACH_FIELDS)
            from backend.handlers import api
            api._photo_key("user-a", "2026-08", body["key"])
        except validation.HttpError:
            continue
        raise AssertionError("invalid attach example was accepted")


def test_photo_upload_attach_get_delete_and_replacement(call, dynamo):
    assert call("POST", "/bills", body={"month": "2026-08", "units": 200})[0] == 200
    status, upload, _ = call(
        "POST", "/bills/{month}/photo/upload",
        body={"contentType": "image/jpeg", "size": 3},
        path_params=_photo_path(),
    )
    assert status == 200
    assert upload["fields"]["Content-Type"] == "image/jpeg"
    key = upload["key"]
    s3 = boto3.client("s3", region_name="ap-south-1")
    s3.put_object(Bucket="sparrow-photos", Key=key, Body=b"one", ContentType="image/jpeg")
    assert call("POST", "/bills/{month}/photo", body={"key": key}, path_params=_photo_path())[0] == 200
    status, result, _ = call("GET", "/bills/{month}/photo", path_params=_photo_path())
    assert status == 200 and key in result["url"]

    _, second_upload, _ = call(
        "POST", "/bills/{month}/photo/upload",
        body={"contentType": "image/png", "size": 3},
        path_params=_photo_path(),
    )
    second = second_upload["key"]
    s3.put_object(Bucket="sparrow-photos", Key=second, Body=b"two", ContentType="image/png")
    assert call("POST", "/bills/{month}/photo", body={"key": second}, path_params=_photo_path())[0] == 200
    assert "Contents" not in s3.list_objects_v2(Bucket="sparrow-photos", Prefix=key)
    assert call("GET", "/bills",)[1]["bills"][0]["hasPhoto"] is True
    assert call("DELETE", "/bills/{month}/photo", path_params=_photo_path())[0] == 204
    assert call("GET", "/bills/{month}/photo", path_params=_photo_path())[0] == 404


def test_photo_isolation_and_missing_object(call, dynamo):
    call("POST", "/bills", sub="user-a", body={"month": "2026-08", "units": 200})
    assert call(
        "POST", "/bills/{month}/photo/upload", sub="user-b",
        body={"contentType": "image/jpeg", "size": 1}, path_params=_photo_path(),
    )[0] == 404
    assert call(
        "POST", "/bills/{month}/photo", sub="user-a",
        body={"key": "u/user-b/bills/2026-08/x.jpg"}, path_params=_photo_path(),
    )[0] == 400
    assert call(
        "POST", "/bills/{month}/photo", sub="user-a",
        body={"key": "u/user-a/bills/2026-08/missing.jpg"}, path_params=_photo_path(),
    )[0] == 400


def test_delete_me_removes_only_users_photos(call, dynamo):
    call("POST", "/bills", sub="user-a", body={"month": "2026-08", "units": 200})
    call("POST", "/bills", sub="user-b", body={"month": "2026-08", "units": 200})
    s3 = boto3.client("s3", region_name="ap-south-1")
    s3.put_object(Bucket="sparrow-photos", Key="u/user-a/one", Body=b"a")
    s3.put_object(Bucket="sparrow-photos", Key="u/user-b/one", Body=b"b")
    assert call("DELETE", "/me", sub="user-a")[0] == 204
    assert "Contents" not in s3.list_objects_v2(Bucket="sparrow-photos", Prefix="u/user-a/")
    assert s3.head_object(Bucket="sparrow-photos", Key="u/user-b/one")
