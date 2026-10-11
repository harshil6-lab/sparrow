# Community v1 runbook

## Moderation

Posts are checked with Rekognition `DetectModerationLabels` before they become
visible. Labels at confidence 80 or higher for explicit nudity, violence,
visually disturbing content, hate symbols, or drugs reject the upload and
delete the object. Three distinct reports hide a post automatically.

For an emergency only, set the Lambda `MODERATION_MODE` environment variable
to `off`, then restore `on` as soon as possible. This bypass is auditable and
does not change report handling. Operators can use `scripts/admin_post.py` with
`TABLE` and `BUCKET` to hide, unhide, or delete a post.

## Costs and availability

Community uses on-demand DynamoDB, S3, presigned URLs, and Rekognition. Costs
scale with reads/writes, stored photos, requests, and moderation calls.
Rekognition availability in `ap-south-1` is unverified until deployment.

## Data deletion

`DELETE /me` removes the user's community posts, comments, reactions, reports,
photos under `c/<sub>/`, and household data. Counter repairs are performed
atomically where possible; operators should verify the user's GSI2 partition
is empty after a large deletion.
