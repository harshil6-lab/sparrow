# Bills diagnosis

## Contract comparison

| Field / surface | Frontend currently sends or reads | Backend currently accepts or returns | Mismatch |
|---|---|---|---|
| Request method/path | `POST /bills` through `HttpDataProvider` | `post_bills` on `POST /bills` | Match |
| `month` | `string`, native month input in `YYYY-MM` form | Required string matching `YYYY-MM` | Match |
| `units` | Parsed `number`; decimals are currently allowed by `parseUnits`/`validateUnits` | `number()` accepts integers and floats from 1 to 5000 | Required contract is integer-only; both sides are too permissive |
| `amount` | Optional `number`; omitted by the real provider when empty | Optional number; `null` is treated as absent | Empty omission works over HTTP, but integer-only is not enforced |
| Empty amount | `amount` is omitted by `HttpDataProvider` when `parseAmount` returns `null` | `body.get("amount") is not None` skips validation/storage | Match for real HTTP; the mock also stores no amount |
| Extra photo data | `BillSheet` passes `photoDataUrl` to `addBill`; real provider strips it, while the mock stores it locally | `BILL_FIELDS` rejects unknown fields, including photo fields | The UI/provider interface permits an extra field even though the real contract must contain no extra fields; product rules also prohibit photographs |
| Other request fields | Real provider sends only `month`, `units`, and optional `amount` | `only_fields` accepts exactly those three names | Match on the wire, but not guaranteed by the shared input type |
| Authentication | `HttpProvider` currently has a malformed `Authorization` assignment, so a token is not sent as `Bearer <token>` | API Gateway requires the Cognito JWT authorizer | **Highest-likelihood root cause:** authenticated bills calls fail before Lambda |
| POST response | `AddBillResult` reads `{ bill, verification }` | Returns `{ bill, verification }` | Shape matches |
| Bill response fields | `billFromServer` reads `month`, `units`, optional `amount`, `verified`, `createdAt`; synthesizes `id` from month | `bill_view` returns those fields and no `id` | Match after client-side `id` synthesis |
| Verification baseline | First response has `{ baseline: true }`; later responses omit `baseline` | Same | Runtime works, but the TypeScript type requires `baseline` even when absent |
| Verification figures | `VerificationResult` prefers server `kwh_saved`, `drop_pct`, `verified`, `co2_kg`, and `rupees_saved` | Later response returns those snake-case fields | Match |
| Bill ordering | UI comments and `BillsSheet` assume newest-first (`bills[0]` is latest) | `store.list_bills` explicitly returns oldest-first | **High-likelihood data/UI bug:** real mode compares and displays the wrong adjacent bills |
| Upsert | UI posts the selected month again | DynamoDB `put_item` replaces `BILL#YYYY-MM` and returns the new saved bill | Match for the submitted bill; a later bill's stored `verified` value can become stale after an earlier-month replacement |
| Per-bill status | List renders stored `bill.verified`; selected result recomputes only when a previous bill exists | Server stores only the status calculated at POST time | UI can show stale status after an upsert; consecutive-bill computation is needed as the display fallback/source of truth |
| World state | `worldState` uses `bills[0]` and `bills[1]` | Backend has no world-state response | Depends on ordering; real mode currently violates the frontend assumption |
| Errors | `BillSheet` catches every error and shows one generic translation; it does not inspect `HttpError.status/message` | Returns JSON `{"error": ...}` for 400/401/500 | **High-likelihood UX bug:** validation, expired session, server, and network failures are indistinguishable |
| Dev diagnostics | No status/body logging in the bill flow | Error body is available to `HttpProvider` | Required status/body console logging is missing |

## Infrastructure check

| Check | Finding |
|---|---|
| Bills Lambda table env var | `GetBillsFn` and `PostBillsFn` both set `TABLE: !Ref HouseholdsTable` |
| GET permissions | `GetBillsFn` has `dynamodb:Query` on `HouseholdsTable.Arn` |
| POST permissions | `PostBillsFn` has `dynamodb:Query` and `dynamodb:PutItem` on `HouseholdsTable.Arn` |
| POST `GetItem` permission | Not present, but the current POST implementation reads the user's bills with `Query`; it does not call `get_bill`/`GetItem`, so this is not a runtime mismatch |
| Route/auth | Both `/bills` routes are declared and use the API's default Cognito authorizer |

## Ranked mismatches

1. Malformed/missing `Bearer` authorization header prevents API Gateway JWT authentication.
2. Real API returns oldest-first while all bill-dependent frontend logic assumes newest-first.
3. Bill UI swallows structured server/network errors and gives no useful retry diagnosis.
4. Units and amount accept decimals despite the required integer contract.
5. Photo data is exposed by the bill input/UI contract even though POST must have no extra fields and photographs are disallowed.
6. Stored per-bill verification can be stale for a later consecutive bill after an earlier-month upsert; the list must compute status from consecutive bills when needed.
