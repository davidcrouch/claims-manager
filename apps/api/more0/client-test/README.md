# claims-manager-webhook More0 client tests

Smoke-test the `claims-manager-webhook` More0 app (workflow + tools) by
dispatching an existing `inbound_webhook_events` row through the HTTP gateway.

## Prerequisites

- More0 stack running (registry, gateway, worker). Gateway defaults to
  `http://localhost:3205`.
- The `claims-manager-webhook` app imported into the registry:

```bash
pnpm --filter @more0ai/client-tests run import ./apps/api/more0/definitions
```

- The claims-manager API running (default `http://localhost:3000`) with:
  - `MORE0_TOOL_SECRET` set on both API and worker (worker uses it to sign
    outbound requests to the HTTP tools via the `TOOL_SECRET` env substitution).
  - `WEBHOOK_PROCESSING_MODE=more0` (optional — not required for this script,
    it invokes the workflow directly).
- A row in `inbound_webhook_events` you want to process (its UUID).

## Invoke the workflow

```powershell
$env:GATEWAY_URL = "http://localhost:3205"
$env:MORE0_ORGANIZATION_ID = "claims-manager-webhook"
$env:EVENT_ID = "<uuid of inbound_webhook_events row>"
pnpm --filter api exec tsx apps/api/more0/client-test/invoke-webhook-workflow.ts
```

The script POSTs to `${GATEWAY_URL}/api/v1/invoke` with:

```json
{
  "cap": "claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event",
  "method": "execute",
  "params": { "eventId": "<uuid>" }
}
```

## Expected side effects

After the workflow finishes successfully you should see:

1. `inbound_webhook_events.processing_status` → `processed`.
2. `external_processing_log` row with `status='completed'` and
   `workflow_run_id` populated.
3. `external_objects` + `external_object_versions` rows upserted, with
   `archive_object_uri` pointing at the S3/MinIO object.
4. The matching internal entity row written by the entity mapper
   (`jobs`, `claims`, etc).
5. An S3 object at
   `s3://${S3_BUCKET_PAYLOADS}/${S3_ARCHIVE_PREFIX}/<tenant>/<type>/<id>/<hash>.json`.
