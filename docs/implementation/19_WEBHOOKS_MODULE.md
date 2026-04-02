# 19 — Webhook Ingestion Module

## Objective

Implement the inbound webhook ingestion system that receives events from the Crunchwork platform, verifies HMAC signatures, persists raw events, and dispatches them to the appropriate sync services for local data updates.

---

## Steps

### 19.1 Module Structure

```
src/modules/webhooks/
├── webhooks.module.ts
├── webhooks.controller.ts
├── webhooks.service.ts
├── webhook-processor.service.ts
├── webhook-hmac.service.ts
├── dto/
│   └── webhook-event.dto.ts
├── interfaces/
│   ├── webhook-event.interface.ts
│   └── webhook-event-type.enum.ts
└── handlers/
    ├── job-event.handler.ts
    ├── quote-event.handler.ts
    ├── purchase-order-event.handler.ts
    ├── invoice-event.handler.ts
    ├── message-event.handler.ts
    ├── task-event.handler.ts
    ├── report-event.handler.ts
    └── attachment-event.handler.ts
```

### 19.2 Webhook Event Types

From the API spec (Section 2.2.2):

```typescript
export enum WebhookEventType {
  NEW_JOB = 'NEW_JOB',
  UPDATE_JOB = 'UPDATE_JOB',
  NEW_PURCHASE_ORDER = 'NEW_PURCHASE_ORDER',
  UPDATE_PURCHASE_ORDER = 'UPDATE_PURCHASE_ORDER',
  NEW_INVOICE = 'NEW_INVOICE',
  UPDATE_INVOICE = 'UPDATE_INVOICE',
  NEW_MESSAGE = 'NEW_MESSAGE',
  NEW_TASK = 'NEW_TASK',
  UPDATE_TASK = 'UPDATE_TASK',
  NEW_ATTACHMENT = 'NEW_ATTACHMENT',
  UPDATE_ATTACHMENT = 'UPDATE_ATTACHMENT',
  NEW_QUOTE = 'NEW_QUOTE',
  NEW_REPORT = 'NEW_REPORT',
}
```

### 19.3 Controller

The webhook endpoint must be **public** (no OAuth2 auth) but HMAC-protected:

```typescript
@Controller('webhooks')
export class WebhooksController {
  @Post('crunchwork')
  @Public()  // bypass JWT auth
  @HttpCode(200)
  async handleWebhook(
    @Headers('event-signature') signature: string,
    @Body() body: any,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    // 1. Verify HMAC
    // 2. Persist raw event
    // 3. Queue for processing
    // 4. Return 200 immediately
  }
}
```

### 19.4 HMAC Verification

Per the API spec (Section 2.1.1):

```typescript
@Injectable()
export class WebhookHmacService {
  constructor(
    @Inject(crunchworkConfig.KEY) private readonly config: CrunchworkConfig,
  ) {}

  verify(params: { rawBody: Buffer; signature: string }): boolean {
    const hmac = crypto
      .createHmac('sha256', this.config.hmacKey)
      .update(params.rawBody)
      .digest('base64');
    return crypto.timingSafeEqual(
      Buffer.from(hmac),
      Buffer.from(params.signature),
    );
  }
}
```

**Critical**: The raw request body must be used (byte-for-byte), not a re-serialized JSON object. NestJS's `ValidationPipe` and JSON body parser will parse the body, so the raw bytes must be preserved separately.

**NestJS raw body configuration:**

```typescript
// main.ts — enable rawBody globally
const app = await NestFactory.create(AppModule, {
  rawBody: true,          // makes req.rawBody available as Buffer
  bodyParser: true,       // still parse JSON normally for other routes
});
```

**Accessing raw body in the controller:**

```typescript
import { RawBodyRequest } from '@nestjs/common';

@Post('crunchwork')
@Public()
@HttpCode(200)
async handleWebhook(
  @Headers('event-signature') signature: string,
  @Req() req: RawBodyRequest<Request>,
): Promise<{ received: true }> {
  const rawBody: Buffer = req.rawBody;  // raw bytes, not re-serialized
  const parsedBody = JSON.parse(rawBody.toString());
  // ...
}
```

**Why this matters:** If the framework parses JSON and you re-serialize it, whitespace, key order, or unicode escaping may differ from the original, causing HMAC verification to fail. Always use `req.rawBody` for HMAC input.

### 19.5 Event Persistence

Store every inbound event in `inbound_webhook_events`:

```typescript
async persistEvent(params: {
  rawBody: string;
  rawHeaders: Record<string, string>;
  signature: string;
  hmacVerified: boolean;
}): Promise<InboundWebhookEvent> {
  const payload = JSON.parse(params.rawBody);
  return this.webhookRepo.save({
    externalEventId: payload.id,
    eventType: payload.type,
    eventTimestamp: payload.timestamp,
    payloadEntityId: payload.payload?.id,
    payloadTeamIds: payload.payload?.teamIds || [],
    payloadTenantId: payload.payload?.tenantId,
    payloadClient: payload.payload?.client,
    payloadProjectExternalReference: payload.payload?.projectExternalReference,
    signatureHeader: params.signature,
    hmacVerified: params.hmacVerified,
    rawHeaders: params.rawHeaders,
    rawBodyText: params.rawBody,
    rawBodyJson: payload,
    processingStatus: 'pending',
  });
}
```

### 19.6 Event Processing

Process events asynchronously (immediately or via a queue):

```typescript
@Injectable()
export class WebhookProcessorService {
  async processEvent(params: { event: InboundWebhookEvent }): Promise<void> {
    const handler = this.getHandler(params.event.eventType);
    try {
      await handler.handle({
        event: params.event,
        tenantId: params.event.payloadTenantId,
        entityId: params.event.payloadEntityId,
      });
      await this.markProcessed({ eventId: params.event.id });
    } catch (error) {
      await this.markFailed({
        eventId: params.event.id,
        error: error.message,
      });
    }
  }

  private getHandler(eventType: string): WebhookEventHandler {
    switch (eventType) {
      case 'NEW_JOB':
      case 'UPDATE_JOB':
        return this.jobEventHandler;
      case 'NEW_PURCHASE_ORDER':
      case 'UPDATE_PURCHASE_ORDER':
        return this.purchaseOrderEventHandler;
      // ... etc.
    }
  }
}
```

### 19.7 Event Handlers

Each handler:
1. Resolves the tenant from `payloadTenantId`
2. Fetches the full entity from Crunchwork API (using `entityId`)
3. Calls the appropriate sync service to update local DB
4. **For job events:** Also fetches and syncs the parent claim (Phase 3+)

Example — Job Event Handler with parent claim cascade:

```typescript
@Injectable()
export class JobEventHandler implements WebhookEventHandler {
  private readonly logger = new Logger('JobEventHandler');

  async handle(params: {
    event: InboundWebhookEvent;
    tenantId: string;
    entityId: string;
  }): Promise<void> {
    // 1. Fetch and sync the job
    const apiJob = await this.crunchworkService.getJob({
      tenantId: params.tenantId,
      jobId: params.entityId,
    });
    await this.jobsSyncService.syncFromApi({
      tenantId: params.tenantId,
      apiJob,
    });

    // 2. Cascade: fetch and sync the parent claim (Phase 3+)
    // The webhook payload also contains projectExternalReference (claim ref)
    const claimId = apiJob.claimId || apiJob.parentClaimId;
    if (claimId) {
      try {
        const apiClaim = await this.crunchworkService.getClaim({
          tenantId: params.tenantId,
          claimId,
        });
        await this.claimsSyncService.syncFromApi({
          tenantId: params.tenantId,
          apiClaim,
        });
      } catch (error) {
        // GET /claims/{id} is Phase 3 — may not be available yet
        this.logger.warn(
          `JobEventHandler.handle - could not sync parent claim ${claimId}: ${error.message}`
        );
      }
    }
  }
}
```

Other handlers (quote, PO, invoice, etc.) follow the simpler pattern — fetch entity, sync locally.

### 19.8 Idempotency

The API spec notes that `id` remains the same on retries. Use `externalEventId` unique constraint to prevent duplicate processing:

```typescript
// Before persisting, check if already processed
const existing = await this.webhookRepo.findOne({
  where: { externalEventId: payload.id },
});
if (existing) {
  return { received: true }; // acknowledge but don't reprocess
}
```

### 19.9 Error Handling & Retry

- Always return 200 to the webhook sender (acknowledge receipt)
- Failed processing should be retried via background job/cron
- Store error details in `processing_error` column
- Add a cron job or scheduled task to retry `pending` events older than N minutes

---

## Acceptance Criteria

- [ ] Webhook endpoint accepts POST at `/api/v1/webhooks/crunchwork`
- [ ] HMAC signature verified using raw request body
- [ ] Invalid signatures rejected with 401 (or logged and ignored)
- [ ] All events persisted in `inbound_webhook_events` table
- [ ] Events dispatched to correct handler by type
- [ ] Handlers fetch full entity from API and sync locally
- [ ] Duplicate events (same `id`) are idempotently handled
- [ ] Failed events can be retried
- [ ] Endpoint returns 200 immediately (processing is async)
