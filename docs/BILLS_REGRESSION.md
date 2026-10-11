# Bills regression

## Cause

The photo release changed `post_bills` to read the existing bill before its
upsert so that `photoKey` and `photoAt` survive a same-month save. The deployed
`PostBillsFn` role still allowed only `dynamodb:Query` and `dynamodb:PutItem`;
it did not allow the new `dynamodb:GetItem` call.

## Evidence

The approved `sam logs` command for `sparrow-dev` reported:

`botocore.exceptions.ClientError: An error occurred (AccessDeniedException) when calling the GetItem operation ... is not authorized to perform: dynamodb:GetItem ...`

The stack points to `handlers/api.py`, line 311, in `post_bills`. The fix adds
`dynamodb:GetItem` to `PostBillsFn` and keeps the existing table resource scope.

## Why tests missed it

The moto handler tests exercised the code with an unrestricted in-memory
DynamoDB client. The template test checked broad policy shape and allowed
action names, but did not derive each function's required actions from the
source, so it could not detect a missing `GetItem` permission.
