"""Shared test fixtures: a moto DynamoDB table and a fake API Gateway event.

The handlers are plain functions of (event, context), so the tests call them
directly with an event shaped like the payload-format 2.0 request an HTTP API
JWT authorizer produces.
"""
import json
import os
import sys
from pathlib import Path

import boto3
import pytest
from moto import mock_aws

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
for path in (str(ROOT), str(BACKEND)):
    if path not in sys.path:
        sys.path.insert(0, path)

import store  # noqa: E402
from backend.handlers import api  # noqa: E402

REGION = "ap-south-1"
TABLE_NAME = "sparrow-test"
COMMUNITY_TABLE_NAME = "sparrow-community-test"

#: Mirrors the HttpApi events in infra/template.yaml. test_template.py checks
#: that the two stay in step.
ROUTES = {
    ("GET", "/hello"): "hello",
    ("GET", "/me"): "get_me",
    ("PUT", "/me"): "put_me",
    ("POST", "/me/intro-seen"): "post_intro_seen",
    ("DELETE", "/me"): "delete_me",
    ("GET", "/bills"): "get_bills",
    ("POST", "/bills"): "post_bills",
    ("POST", "/bills/{month}/photo/upload"): "photo",
    ("POST", "/bills/{month}/photo"): "photo",
    ("GET", "/bills/{month}/photo"): "photo",
    ("DELETE", "/bills/{month}/photo"): "photo",
    ("GET", "/missions"): "get_missions",
    ("POST", "/missions/{id}/complete"): "complete_mission",
    ("GET", "/community/feed"): "community",
    ("POST", "/community/upload-ticket"): "community",
    ("POST", "/community/posts"): "community",
    ("GET", "/community/posts/{id}"): "community",
    ("DELETE", "/community/posts/{id}"): "community",
    ("PUT", "/community/posts/{id}/reaction"): "community",
    ("GET", "/community/posts/{id}/comments"): "community",
    ("POST", "/community/posts/{id}/comments"): "community",
    ("DELETE", "/community/posts/{id}/comments/{cid}"): "community",
    ("POST", "/community/posts/{id}/report"): "community",
}


def make_event(method, path, sub="user-a", body=None, path_params=None, claims=True, query=None):
    """An HTTP API v2 event with a Cognito JWT authorizer context."""
    event = {
        "version": "2.0",
        "routeKey": f"{method} {path}",
        "rawPath": path,
        "requestContext": {"http": {"method": method, "path": path}, "authorizer": {}},
        "pathParameters": path_params,
        "headers": {"content-type": "application/json"},
        "body": None if body is None else json.dumps(body),
    }
    if claims:
        event["requestContext"]["authorizer"] = {
            "jwt": {
                "claims": {"sub": sub, "email": f"{sub}@example.com", "token_use": "id"},
                "scopes": ["openid", "email", "profile"],
            }
        }
    if query is not None:
        event["queryStringParameters"] = query
    return event


@pytest.fixture
def dynamo():
    with mock_aws():
        resource = boto3.resource("dynamodb", region_name=REGION)
        resource.create_table(
            TableName=TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
            ],
            KeySchema=[
                {"AttributeName": "pk", "KeyType": "HASH"},
                {"AttributeName": "sk", "KeyType": "RANGE"},
            ],
        )
        community_resource = boto3.resource("dynamodb", region_name=REGION)
        community_resource.create_table(
            TableName=COMMUNITY_TABLE_NAME,
            BillingMode="PAY_PER_REQUEST",
            AttributeDefinitions=[
                {"AttributeName": "pk", "AttributeType": "S"},
                {"AttributeName": "sk", "AttributeType": "S"},
                {"AttributeName": "gsi1pk", "AttributeType": "S"},
                {"AttributeName": "gsi1sk", "AttributeType": "S"},
                {"AttributeName": "gsi2pk", "AttributeType": "S"},
                {"AttributeName": "gsi2sk", "AttributeType": "S"},
            ],
            KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}, {"AttributeName": "sk", "KeyType": "RANGE"}],
            GlobalSecondaryIndexes=[
                {"IndexName": "GSI1", "KeySchema": [{"AttributeName": "gsi1pk", "KeyType": "HASH"}, {"AttributeName": "gsi1sk", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
                {"IndexName": "GSI2", "KeySchema": [{"AttributeName": "gsi2pk", "KeyType": "HASH"}, {"AttributeName": "gsi2sk", "KeyType": "RANGE"}], "Projection": {"ProjectionType": "ALL"}},
            ],
        )
        boto3.client("s3", region_name=REGION).create_bucket(
            Bucket="sparrow-photos",
            CreateBucketConfiguration={"LocationConstraint": REGION},
        )
        os.environ["BUCKET"] = "sparrow-photos"
        os.environ["COMMUNITY_TABLE"] = COMMUNITY_TABLE_NAME
        store.set_table(resource.Table(TABLE_NAME))
        store.set_s3(boto3.client("s3", region_name=REGION))
        store.set_community_table(community_resource.Table(COMMUNITY_TABLE_NAME))
        yield store.table()
        store.set_table(None)
        store.set_s3(None)
        store.set_community_table(None)
        store.set_rekognition(None)
        os.environ.pop("BUCKET", None)
        os.environ.pop("COMMUNITY_TABLE", None)


@pytest.fixture
def call():
    """call("GET", "/bills", sub="user-a") -> (status, parsed_body, headers)."""

    def _call(method, path, sub="user-a", body=None, path_params=None, claims=True, query=None):
        handler = getattr(api, ROUTES[method, path])
        raw_path = path
        for name, value in (path_params or {}).items():
            raw_path = raw_path.replace("{" + name + "}", value)
        response = handler(
            make_event(method, raw_path, sub=sub, body=body, path_params=path_params, claims=claims, query=query),
            None,
        )
        text = response.get("body") or ""
        return response["statusCode"], (json.loads(text) if text else None), response.get("headers", {})

    return _call