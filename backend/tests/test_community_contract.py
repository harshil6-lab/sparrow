"""Shared community payload examples must match backend validation and routes."""

import json
from pathlib import Path

import pytest

import store

CONTRACT = json.loads(
    (Path(__file__).resolve().parents[2] / "contracts" / "community-payloads.json").read_text(encoding="utf-8")
)


def _display_name(call):
    status, body, _ = call("PUT", "/me", body={"displayName": "Asha Rao"})
    assert status == 200
    assert body["displayName"] == "Asha Rao"


def _seed_photo(s3, key="c/user-a/photo.jpg"):
    s3.put_object(Bucket="sparrow-photos", Key=key, Body=b"jpeg", ContentType="image/jpeg")


def test_valid_community_contract_examples_accepted(call, dynamo):
    import os

    os.environ["MODERATION_MODE"] = "off"
    _display_name(call)
    _seed_photo(store.s3())
    post = CONTRACT["valid"]["post"]
    status, body, _ = call("POST", "/community/posts", body=post)
    assert status == 200
    post_id = body["id"]

    reaction = CONTRACT["valid"]["reaction"]
    assert (
        call("PUT", "/community/posts/{id}/reaction", path_params={"id": post_id}, body=reaction)[0]
        == 200
    )

    comment = CONTRACT["valid"]["comment"]
    status, body, _ = call(
        "POST",
        "/community/posts/{id}/comments",
        path_params={"id": post_id},
        body=comment,
    )
    assert status == 200
    assert body["text"] == comment["text"]

    report = CONTRACT["valid"]["report"]
    assert (
        call(
            "POST",
            "/community/posts/{id}/report",
            sub="user-b",
            path_params={"id": post_id},
            body=report,
        )[0]
        == 204
    )


@pytest.mark.parametrize("example", [e for e in CONTRACT["invalid"] if "post" in e])
def test_invalid_post_contract_examples_rejected(call, dynamo, example):
    import os

    os.environ["MODERATION_MODE"] = "off"
    _display_name(call)
    body = example["post"]
    key = body.get("key")
    if isinstance(key, str) and key.startswith("c/user-a/"):
        _seed_photo(store.s3(), key)
    status, resp, _ = call("POST", "/community/posts", body=body)
    assert status == 400
    assert resp["code"] in {
        "invalid_photo",
        "validation_error",
        "adult_confirmation_required",
    }


@pytest.mark.parametrize("example", [e for e in CONTRACT["invalid"] if "reaction" in e])
def test_invalid_reaction_contract_examples_rejected(call, dynamo, example):
    import os

    os.environ["MODERATION_MODE"] = "off"
    _display_name(call)
    _seed_photo(store.s3())
    status, created, _ = call("POST", "/community/posts", body=CONTRACT["valid"]["post"])
    assert status == 200
    post_id = created["id"]
    status, resp, _ = call(
        "PUT",
        "/community/posts/{id}/reaction",
        path_params={"id": post_id},
        body=example["reaction"],
    )
    assert status == 400
    assert resp["code"] == "validation_error"


@pytest.mark.parametrize("example", [e for e in CONTRACT["invalid"] if "comment" in e])
def test_invalid_comment_contract_examples_rejected(call, dynamo, example):
    import os

    os.environ["MODERATION_MODE"] = "off"
    _display_name(call)
    _seed_photo(store.s3())
    status, created, _ = call("POST", "/community/posts", body=CONTRACT["valid"]["post"])
    assert status == 200
    post_id = created["id"]
    status, resp, _ = call(
        "POST",
        "/community/posts/{id}/comments",
        path_params={"id": post_id},
        body=example["comment"],
    )
    assert status == 400
    assert resp["code"] == "validation_error"
