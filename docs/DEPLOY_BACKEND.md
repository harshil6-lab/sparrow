# Deploying the Sparrow backend

Cognito (email sign-in, optional Google), a JWT-protected HTTP API and one
DynamoDB table. Everything lives in one stack, `sparrow-dev`, in `ap-south-1`.

Do not edit `backend/`, `infra/` or the template by hand for a deploy - just
rebuild and deploy.

## 1. Build

```powershell
cd D:\sparrow_main
sam build -t infra\template.yaml
```

`CodeUri` is `../backend`, so the Lambda artifact contains only the handler code
plus its bundled `data/config.json` (about 50 KB per function). Do not change
`CodeUri` back to the repo root: that would ship `frontend/node_modules`.

## 2. Deploy

The table's logical id (`HouseholdsTable`) and the API's (`Api`) are unchanged,
so this is an in-place update and every stored bill survives.

```powershell
sam deploy `
  --template-file .aws-sam\build\template.yaml `
  --stack-name sparrow-dev `
  --region ap-south-1 `
  --capabilities CAPABILITY_IAM `
  --resolve-s3 `
  --parameter-overrides `
    CognitoDomainPrefix="sparrow-dev-harsh" `
    AllowedOrigins="https://main.d27dxqpx3jzuju.amplifyapp.com,http://localhost:5173" `
    CallbackUrls="https://main.d27dxqpx3jzuju.amplifyapp.com/,http://localhost:5173/" `
    LogoutUrls="https://main.d27dxqpx3jzuju.amplifyapp.com/,http://localhost:5173/" `
    GoogleClientId="<YOUR_GOOGLE_CLIENT_ID>" `
    GoogleClientSecret="<YOUR_GOOGLE_CLIENT_SECRET>"
```

Parameters:

| Parameter | Meaning |
| --- | --- |
| `CognitoDomainPrefix` | Hosted UI domain prefix. Must be globally unique within the region; the domain becomes `<prefix>.auth.ap-south-1.amazoncognito.com`. |
| `AllowedOrigins` | Comma-separated CORS origins allowed to call the API. |
| `CallbackUrls` | Comma-separated OAuth callback URLs for the SPA. |
| `LogoutUrls` | Comma-separated OAuth logout URLs for the SPA. |
| `GoogleClientId` | Google OAuth client id. Empty = no Google sign-in. |
| `GoogleClientSecret` | Google OAuth client secret (`NoEcho`). Empty = no Google sign-in. |

Add the deployed origin to `AllowedOrigins`, `CallbackUrls` and `LogoutUrls`
when the SPA has a stable URL, then redeploy.

If CloudFormation complains about named IAM roles, re-run with
`--capabilities CAPABILITY_NAMED_IAM` instead.

## 3. Where the Google values come from

`GoogleClientId` / `GoogleClientSecret` come from a Google Cloud **OAuth 2.0
client ID** of type *Web application*. Both must be set for the stack to create
the identity provider; if either is empty the provider and the hosted-UI button
are skipped entirely.

### Manual Google Cloud steps

1. Google Cloud Console -> create (or pick) a project.
2. *APIs & Services -> OAuth consent screen*: User type **External**, app name,
   support email, developer contact.
3. Add scopes `openid`, `email`, `profile`. While the app is in **Testing**, add
   every Google account you want to sign in with under *Test users*.
4. *APIs & Services -> Credentials -> Create credentials -> OAuth client ID*.
5. Application type **Web application**.
6. Authorised JavaScript origins: `http://localhost:5173` (and the deployed SPA origin).
7. Authorised redirect URIs:
   `https://<CognitoDomainPrefix>.auth.ap-south-1.amazoncognito.com/oauth2/idpresponse`
8. Create, then copy the **Client ID** and **Client secret** into the two
   `--parameter-overrides` above.
9. Publish the consent screen when you are ready to leave *Testing*.

## 4. After deploying

Stack outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `CognitoDomain`, `Region`.
Point the frontend at them (`VITE_USE_MOCK=false` plus the API URL / pool /
client id env vars) once the real API client is built.

## 5. Smoke test

```powershell
# public
curl "$API_URL/hello"

# protected: without a token the API answers 401
curl -i "$API_URL/me"
```

## Routes

| Method | Path | Handler | Notes |
| --- | --- | --- | --- |
| GET | `/hello` | `handlers.api.hello` | Public, no authorizer. |
| GET | `/me` | `handlers.api.get_me` | Creates the default profile on first call. |
| PUT | `/me` | `handlers.api.put_me` | Validated partial update. |
| POST | `/me/intro-seen` | `handlers.api.post_intro_seen` | `introSeen = true`. |
| DELETE | `/me` | `handlers.api.delete_me` | 204; removes every `USER#<sub>` item. |
| GET | `/bills` | `handlers.api.get_bills` | Oldest month first. |
| POST | `/bills` | `handlers.api.post_bills` | Upsert; returns `{bill, verification}`. |
| GET | `/missions` | `handlers.api.get_missions` | Completed missions only. |
| POST | `/missions/{id}/complete` | `handlers.api.complete_mission` | Id must be in the allowlist. |

Every route except `/hello` requires a Cognito JWT. The user id is always
`claims.sub`; a user id sent by the client is ignored. Items are stored as
`pk = USER#<sub>`, `sk = PROFILE | BILL#YYYY-MM | MISSION#<id>#<YYYY-MM-DD>`.

`POST /bills` verification: `kwh_saved`, `drop_pct`, `verified` (>= 5%),
`co2_kg` (from `data/config.json`, omitted when the factor is null) and
`rupees_saved` (the previous bill's own rate, null when it had no amount). The
first bill for a user answers `{"bill": {...}, "verification": {"baseline": true}}`.

## Tests

```powershell
pip install -r backend\requirements-dev.txt
python -m pytest backend\tests -q
```
