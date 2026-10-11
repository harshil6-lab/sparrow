# Community feed 400 regression

## Cause

The frontend requested `GET /community/feed?limit=20`. API Gateway supplies
query-string values as strings, but the Community handler passes `limit`
directly to `validation.integer`, which accepts only an integer value. The
request therefore failed with the validator's `limit must be an integer`
400 response before DynamoDB was queried.

The backend now accepts API Gateway's digit-string query values through a
query-specific integer coercion helper. The frontend emits its documented
default `limit=20` again; empty optional parameters remain omitted.

## Evidence

- Frontend builder before the fix: `/community/feed?limit=20`.
- Backend route: `query.get("limit", 20)` receives `"20"` for that request.
- Backend validation: `integer(value, "limit", 1, 20)` rejects non-`int` values.
- No tag parameter is accepted by the backend; tag filtering remains client-side.

## Why tests missed it

The existing frontend tests exercised mock providers, while backend tests called
the storage function directly with typed values. Neither test crossed the API
Gateway query-string boundary.
