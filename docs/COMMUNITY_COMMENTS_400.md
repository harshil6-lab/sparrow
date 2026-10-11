# Community comment 400 regression

## Cause

The request body was never the problem. The frontend builds
`{"text": "..."}` for a comment (`frontend/src/lib/api/http.ts`), the shared
contract documents `{"text": "Nice work"}` (`contracts/community-payloads.json`)
and the backend validator accepts the same shape, so `{"text": "hi"}` passes
body validation untouched.

The 400 came from account state. `community.add_comment` resolved the author
name with `_profile_name`, which raises
`400 needs_display_name` when the caller's profile has no stored
`displayName`. Display-name onboarding lives inside the create-post sheet, so a
signed-in user who had only ever browsed the feed could not comment at all:
`POST /community/posts/{id}/comments` failed for `"hi"` *before* any DynamoDB
write. That is also why the missing-IAM 500 (reactions) never surfaced on this
route - the request died one line earlier.

## Fix

`add_comment` now resolves the author through `_comment_author`: the profile's
`displayName` when set, otherwise the neutral label `Sparrow user`. Post
creation still requires a display name, so the existing onboarding is unchanged.
No frontend change is required to clear the 400. A follow-up worth doing: prompt
for the display name before the first comment, so commenters are not shown as
`Sparrow user`.

## Body comparison

| Endpoint | Frontend body (`http.ts`) | Contract | Backend |
| --- | --- | --- | --- |
| `POST .../comments` | `{"text": "hi"}` | `{"text": "..."}` | accepted |
| `PUT .../reaction` | `{"type": "grow"}` / `{"type": null}` to clear | `{"type": "grow"}` | accepted |
| `POST .../report` | `{"reason": "spam"}` | `{"reason": "spam"}` | accepted |
| `POST /community/posts` | `{"key", "caption", "tag", "confirmAdult"}` | same keys | accepted |
| `POST /community/upload-ticket` | `{"contentType", "size"}` | same keys | accepted |

Field names match on every endpoint; the reaction `null` (clear) is the only
value not spelled out in the contract examples.

## Why tests missed it

Every backend contract test calls `_display_name(call)` first, so no test
exercised a comment from an account without a display name, and the frontend
HTTP provider had no comment test at all.
