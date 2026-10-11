# Bill duplicate regression

## Evidence

The real-mode preview was started with the same dummy Cognito configuration used by
the existing E2E harness. A fresh unauthenticated visit stayed on `/welcome`, so a
real authenticated account could not be exercised without live credentials. The
source trace nevertheless reproduces the race: `BillSheet.submit` had no
in-flight guard, so two rapid clicks entered the async handler before React
re-rendered the button. Both handlers called `addBill`, producing two POSTs; the
second upsert then appeared as an update. The photo phase uses separate ticket,
upload, and attach calls and does not call `addBill`.

The photo-error retry also called `addBill` again before retrying the photo, which
could create another bill POST after a successful bill save.

## Fix

`BillSheet` now locks submission before the first async operation, keeps the
loading state active for the whole operation, and reuses the saved bill during a
photo retry. The local mock seeds bills only in its `demo:` namespace; real HTTP
accounts use `HttpDataProvider` and start from the server response without sample
seeding.

The remaining live-account reproduction is unverified because credentials were not
available in this environment.
