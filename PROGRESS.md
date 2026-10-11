## Task 3c

- Fixed the bill-save regression caused by missing `dynamodb:GetItem` permission on `PostBillsFn`.
- Added same-month photo-preservation and source-derived IAM policy regression tests.
- Added constrained bill-photo preview, replacement/removal controls, API error details, and frontend plausibility confirmation.
- Validation: backend `77 passed`; SAM lint passed; frontend lint passed with existing warnings, `145 passed`, build/layout/contrast passed.

## Task 4

- Real-mode reproduction from `/` and `/welcome` now reaches `/app` with no API or Cognito requests; the existing demo stack wiring was already present in this checkout.
- Removed the non-functional Reminders control, persisted real-mode language changes through `PUT /me`, added the Demo/profile identity header, and enforced Wi-Fi-only playback as well as photo upload.
- Added `docs/PROFILE_AUDIT.md`, `scripts/e2e-real.mjs`, and `scripts/button-audit.mjs`.
- Validation: frontend lint (6 pre-existing warnings), `145 passed`, build, layout, contrast, real-mode E2E, and button audit passed.

## Task 5

- Added cited Learn-card sources and structured numeric claims to both facts manifests.
- Updated Learn cards and detail sheets to list source publishers, titles, HTTPS links, and estimate chips; cooling mission reuses the AC guidance.
- Removed the fridge hot-food guidance and added data/source regression coverage.

## Task 6a

- Added the isolated CommunityTable with feed and author indexes, presigned community photo uploads, moderation, reactions, comments, reports, post deletion, and account cleanup.
- Added community payload examples, an admin moderation helper, and the community operations runbook.
- Validation: backend `83 passed`; SAM lint and build passed. Rekognition availability in `ap-south-1` remains unverified until deployment.

## Task 6b

- Added the five-tab Community route with local demo posts, feed filtering, refresh/load-more, reactions, comments, reporting, post creation, and HTTP provider integration.
- Added editable profile display name handling, Community i18n in English and Hindi, compressed photo upload reuse, and Community layout styles.
- Validation: frontend lint passed with six pre-existing warnings; full frontend tests `146 passed`; build passed. Full browser/layout/contrast audits remain to be run.

## Task 6c

- Added Community display-name onboarding, localized moderation/rate-limit error messages, unavailable-post handling, robust share fallback, comment deletion permissions, and consent/guideline copy.
- Validation: frontend lint passed with six pre-existing warnings; full frontend tests `146 passed`; production build passed.
- Dedicated Community tests, button-audit expansion, layout/contrast/browser audits, and a complete deep-link detail implementation remain outstanding.

## Task 6d

- Added shared contract regression tests (`backend/tests/test_community_contract.py`,
  `frontend/src/lib/__tests__/community-contract.test.ts`) for feed, post, reaction,
  comment, and report examples in `contracts/community-payloads.json`.
- Expanded the Playwright button audit to include `/app/community`.
- Aligned invalid comment contract examples with backend empty-text validation.

## Task 7

- Added an in-flight bill submit lock and photo-retry reuse so one submit creates
  exactly one bill POST; documented the source evidence in `docs/BILLS_DUPLICATE.md`.
- Added API Gateway query-string integer coercion for Community feed limits,
  restored the frontend `limit=20` request, and added shared contract examples
  with backend/frontend coverage.
- Live authenticated duplicate reproduction remains unverified because no real
  credentials were available. Deployment was not performed.

- Fixed the live Community feed 400 by omitting the backend-incompatible default string limit from the first-page request; documented the validator boundary in `docs/COMMUNITY_FEED_400.md`.
- Reworked Community post creation with the existing photo compression flow, hidden file inputs, photo preview replacement/removal, caption labels/counter, wrapped topics, custom adult row, upload progress, and a pinned sheet footer.
- Added visible display-name input validation, Profile sheet header/layout corrections, native-language labels, stacked Community errors, and expanded layout assertions for Community create sheets.
- Validation: lint (six existing warnings), 146 frontend tests, build, layout, contrast, real-mode E2E, and button audit passed. Dedicated cross-contract tests and requested c1 screenshot set were not added.