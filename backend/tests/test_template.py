"""Guards on infra/template.yaml.

These keep the CloudFormation template and the Python routes in step, and pin
the security-critical wiring: the JWT authorizer is the default, /hello is the
only public route, the table logical id is unchanged (so the data survives an
in-place update) and every role is scoped to that one table.
"""

import ast

from pathlib import Path

import pytest
import yaml
from conftest import ROUTES

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_PATH = ROOT / "infra" / "template.yaml"


class SamLoader(yaml.SafeLoader):
    """SafeLoader that keeps short-form intrinsics (!Ref, !Sub, !GetAtt) as data."""


def _intrinsic(loader, tag_suffix, node):
    if isinstance(node, yaml.ScalarNode):
        return {tag_suffix: loader.construct_scalar(node)}
    if isinstance(node, yaml.SequenceNode):
        return {tag_suffix: loader.construct_sequence(node, deep=True)}
    return {tag_suffix: loader.construct_mapping(node, deep=True)}


SamLoader.add_multi_constructor("!", _intrinsic)


@pytest.fixture(scope="module")
def template():
    return yaml.load(TEMPLATE_PATH.read_text(encoding="utf-8"), Loader=SamLoader)


def resources(template, kind):
    return {name: body for name, body in template["Resources"].items() if body.get("Type") == kind}


def routes(template):
    """(method, path) -> (handler, auth) for every HttpApi event."""
    found = {}
    for name, body in resources(template, "AWS::Serverless::Function").items():
        function = body["Properties"]
        for event in (function.get("Events") or {}).values():
            if event.get("Type") != "HttpApi":
                continue
            props = event["Properties"]
            auth = (props.get("Auth") or {}).get("Authorizer")
            found[(props["Method"], props["Path"])] = (function["Handler"], auth)
    return found


def test_routes_match_the_handlers_under_test(template):
    declared = routes(template)
    assert set(declared) == set(ROUTES), "template and conftest.ROUTES disagree"
    for key, handler in ROUTES.items():
        assert declared[key][0] == f"handlers.api.{handler}"


def test_only_hello_is_public(template):
    for key, (_, auth) in routes(template).items():
        if key == ("GET", "/hello"):
            assert auth == "NONE"
        else:
            assert auth is None, f"{key} must fall through to the default authorizer"


def test_the_old_unauthenticated_mission_route_is_gone(template):
    assert all(path != "/mission" for _, path in routes(template))


def test_jwt_authorizer_is_the_default(template):
    auth = template["Resources"]["Api"]["Properties"]["Auth"]
    assert auth["DefaultAuthorizer"] == "CognitoAuthorizer"
    jwt = auth["Authorizers"]["CognitoAuthorizer"]["JwtConfiguration"]
    assert "https://cognito-idp.${AWS::Region}.amazonaws.com/${UserPool}" in jwt["issuer"]["Sub"]
    assert jwt["audience"] == [{"Ref": "UserPoolClient"}]
    assert auth["Authorizers"]["CognitoAuthorizer"]["IdentitySource"] == "$request.header.Authorization"


def test_cors_comes_from_a_parameter(template):
    cors = template["Resources"]["Api"]["Properties"]["CorsConfiguration"]
    assert cors["AllowOrigins"] == {"Ref": "AllowedOrigins"}
    assert set(cors["AllowMethods"]) == {"GET", "POST", "PUT", "DELETE", "OPTIONS"}
    assert set(cors["AllowHeaders"]) == {"Authorization", "Content-Type"}


def test_table_logical_id_and_keys_are_unchanged(template):
    """The logical id is what keeps the existing table - and its data - in place."""
    table = template["Resources"]["HouseholdsTable"]
    assert table["Properties"]["BillingMode"] == "PAY_PER_REQUEST"
    assert [(a["AttributeName"], a["AttributeType"]) for a in table["Properties"]["AttributeDefinitions"]] == [
        ("pk", "S"),
        ("sk", "S"),
    ]
    assert [k["KeyType"] for k in table["Properties"]["KeySchema"]] == ["HASH", "RANGE"]


def test_functions_are_scoped_to_the_table(template):
    for name, body in resources(template, "AWS::Serverless::Function").items():
        properties = body["Properties"]
        env = properties.get("Environment", {}).get("Variables", {})
        if "TABLE" not in env:
            continue  # hello does not touch the table
        statements = [s for policy in properties["Policies"] for s in policy["Statement"]]
        for statement in statements:
            assert statement["Effect"] == "Allow"
            resources_for_statement = statement["Resource"] if isinstance(statement["Resource"], list) else [statement["Resource"]]
            if name == "CommunityFn" and statement["Action"] == ["rekognition:DetectModerationLabels"]:
                assert resources_for_statement == ["*"]  # Rekognition does not support resource-level scoping.
            else:
                assert "*" not in resources_for_statement
            assert not any(action.endswith(":*") for action in statement["Action"])
            if name not in ("PhotoFn", "CommunityFn") and "s3:" not in str(statement["Action"]):
                assert "HouseholdsTable.Arn" in str(statement["Resource"])
            if name == "CommunityFn" and "dynamodb:" in str(statement["Action"]):
                assert "CommunityTable.Arn" in str(statement["Resource"]) or "HouseholdsTable.Arn" in str(statement["Resource"])
        actions = {action for statement in statements for action in statement["Action"]}
        assert actions <= {
            "dynamodb:GetItem",
            "dynamodb:PutItem",
            "dynamodb:Query",
            "dynamodb:DeleteItem",
            "dynamodb:BatchWriteItem",
            "dynamodb:TransactWriteItems",
            "s3:PutObject",
            "s3:GetObject",
            "s3:DeleteObject",
            "s3:ListBucket",
            "rekognition:DetectModerationLabels",
        }
        assert actions, f"{name} has a table but no DynamoDB permissions"


def test_function_policies_cover_source_storage_calls(template):
    """Derive required IAM actions from the handler and store source graph."""
    api_tree = ast.parse((ROOT / "backend" / "handlers" / "api.py").read_text(encoding="utf-8"))
    store_tree = ast.parse((ROOT / "backend" / "store.py").read_text(encoding="utf-8"))
    api_functions = {node.name: node for node in api_tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    store_functions = {node.name: node for node in store_tree.body if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))}
    dynamo_actions = {
        "get_item": "dynamodb:GetItem",
        "query": "dynamodb:Query",
        "put_item": "dynamodb:PutItem",
        "batch_write_item": "dynamodb:BatchWriteItem",
    }
    s3_actions = {
        "generate_presigned_post": "s3:PutObject",
        "generate_presigned_url": "s3:GetObject",
        "head_object": "s3:GetObject",
        "list_objects_v2": "s3:ListBucket",
        "delete_objects": "s3:DeleteObject",
        "delete_object": "s3:DeleteObject",
    }

    def called_store_functions(node):
        return {
            call.func.attr
            for call in ast.walk(node)
            if isinstance(call, ast.Call)
            and isinstance(call.func, ast.Attribute)
            and isinstance(call.func.value, ast.Name)
            and call.func.value.id == "store"
            and call.func.attr in store_functions
        }

    def direct_storage_actions(node):
        actions = set()
        for call in ast.walk(node):
            if not isinstance(call, ast.Call) or not isinstance(call.func, ast.Attribute):
                continue
            if call.func.attr in dynamo_actions:
                actions.add(dynamo_actions[call.func.attr])
            if call.func.attr in s3_actions:
                actions.add(s3_actions[call.func.attr])
        return actions

    def required(handler_name, seen=None):
        seen = set() if seen is None else seen
        if handler_name in seen:
            return set()
        seen.add(handler_name)
        node = api_functions.get(handler_name) or store_functions.get(handler_name)
        if node is None:
            return set()
        actions = direct_storage_actions(node)
        for child in called_store_functions(node):
            actions |= required(child, seen)
        for call in ast.walk(node):
            if isinstance(call, ast.Call) and isinstance(call.func, ast.Name):
                if call.func.id in store_functions or call.func.id in api_functions:
                    actions |= required(call.func.id, seen)
            if isinstance(call, ast.Call) and isinstance(call.func, ast.Attribute):
                value = call.func.value
                if call.func.attr == "__wrapped__" and isinstance(value, ast.Name) and value.id in api_functions:
                    actions |= required(value.id, seen)
        return actions

    policies_by_handler = {}
    for name, body in resources(template, "AWS::Serverless::Function").items():
        properties = body["Properties"]
        handler = properties["Handler"].rsplit(".", 1)[-1]
        statements = [s for policy in properties.get("Policies", []) for s in policy.get("Statement", [])]
        policies_by_handler.setdefault(handler, set()).update(
            action for statement in statements for action in statement.get("Action", [])
        )

    for handler, actions in ((handler, required(handler)) for handler in policies_by_handler):
        missing = actions - policies_by_handler[handler]
        assert not missing, f"{handler} source calls require missing IAM actions: {sorted(missing)}"


def test_code_root_excludes_the_rest_of_the_repo(template):
    """CodeUri must not be the repo root: that bundles frontend/node_modules."""
    for body in resources(template, "AWS::Serverless::Function").values():
        code_uri = body["Properties"]["CodeUri"]
        assert code_uri == "../backend", f"{code_uri} would ship the whole repo to Lambda"


def test_cognito_user_pool_is_email_based(template):
    pool = template["Resources"]["UserPool"]["Properties"]
    assert pool["UsernameAttributes"] == ["email"]
    assert pool["AutoVerifiedAttributes"] == ["email"]
    assert pool["Policies"]["PasswordPolicy"]["MinimumLength"] == 8
    mechanisms = pool["AccountRecoverySetting"]["RecoveryMechanisms"]
    assert mechanisms == [{"Name": "verified_email", "Priority": 1}]


def test_spa_client_flows_and_oauth(template):
    client = template["Resources"]["UserPoolClient"]["Properties"]
    assert client["GenerateSecret"] is False
    assert set(client["ExplicitAuthFlows"]) == {"ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"}
    assert client["AllowedOAuthFlows"] == ["code"]
    assert set(client["AllowedOAuthScopes"]) == {"openid", "email", "profile"}
    assert client["CallbackURLs"] == {"Ref": "CallbackUrls"}
    assert client["LogoutURLs"] == {"Ref": "LogoutUrls"}
    assert "http://localhost:5173/" in template["Parameters"]["CallbackUrls"]["Default"]


def test_hosted_ui_domain_comes_from_a_parameter(template):
    domain = template["Resources"]["UserPoolDomain"]["Properties"]
    assert domain["Domain"] == {"Ref": "CognitoDomainPrefix"}


def test_google_provider_is_conditional_and_secret_is_hidden(template):
    google = template["Resources"]["GoogleIdP"]
    assert google["Condition"] == "UseGoogle"
    conditions = template["Conditions"]["UseGoogle"]["And"]
    checked = {arm["Not"][0]["Equals"][0]["Ref"] for arm in conditions}
    assert checked == {"GoogleClientId", "GoogleClientSecret"}
    parameters = template["Parameters"]
    assert parameters["GoogleClientSecret"]["NoEcho"] is True
    assert parameters["GoogleClientId"]["Default"] == ""
    assert parameters["GoogleClientSecret"]["Default"] == ""
    # the provider is only offered to the client when it exists
    providers = template["Resources"]["UserPoolClient"]["Properties"]["SupportedIdentityProviders"]
    assert "GoogleIdP" in str(providers)


def test_outputs_are_present(template):
    assert set(template["Outputs"]) >= {
        "ApiUrl", "UserPoolId", "UserPoolClientId", "CognitoDomain", "Region", "PhotoBucketName",
    }


def test_photo_bucket_is_private_and_configured(template):
    bucket = template["Resources"]["PhotoBucket"]["Properties"]
    assert bucket["PublicAccessBlockConfiguration"] == {
        "BlockPublicAcls": True,
        "BlockPublicPolicy": True,
        "IgnorePublicAcls": True,
        "RestrictPublicBuckets": True,
    }
    assert bucket["BucketEncryption"]["ServerSideEncryptionConfiguration"][0][
        "ServerSideEncryptionByDefault"
    ]["SSEAlgorithm"] == "AES256"
    rule = bucket["LifecycleConfiguration"]["Rules"][0]
    assert rule["AbortIncompleteMultipartUpload"]["DaysAfterInitiation"] == 1
    cors = bucket["CorsConfiguration"]["CorsRules"][0]
    assert cors["AllowedOrigins"] == {"Ref": "AllowedOrigins"}
    assert set(cors["AllowedMethods"]) == {"GET", "POST", "PUT"}
    assert cors["AllowedHeaders"] == ["*"]
    assert cors["ExposedHeaders"] == ["ETag"]


def test_photo_roles_are_scoped_to_user_prefix(template):
    photo = template["Resources"]["PhotoFn"]["Properties"]["Policies"][0]["Statement"]
    delete = template["Resources"]["DeleteMeFn"]["Properties"]["Policies"][0]["Statement"]
    for statement in photo + delete:
        assert "*" not in str(statement["Resource"]) or "u/*" in str(statement["Resource"])
    assert "s3:*" not in str(photo + delete)
