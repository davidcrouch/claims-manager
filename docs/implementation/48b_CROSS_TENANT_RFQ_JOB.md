# 48b — RFQ → Job Cross-Tenant Completion

**Series:** 48 (Cross-Tenant Supply Chain Completion)  
**Review reference:** `docs/reviews/cross-tenant-supply-chain-review.md` item #3  
**Depends on:** 48 (copy utility, workflow engine), 48a (vendor→org for recipient resolution)  
**Status:** Planned

---

## Overview

RFQ (Request for Quotation) is the first document in the buyer→vendor supply chain. A buyer creates an RFQ, scopes it from a quote, and issues it to a vendor. The vendor receives it as a **Job** — mirroring how the insurer→contractor flow works via Crunchwork.

Today, RFQ is single-tenant CRUD with quote-derived scope cloning. Cross-tenant issuance is declared in types but **not implemented**: `loadDocumentWithItems` throws for `rfq`, `createRecipientEntity` has no RFQ case, there are no cross-tenant columns on `rfqs` or `jobs`, no RFQ workflow definition, no manual capture, no custody transfer, and no pub/sub topics.

This document completes the RFQ→Job cross-tenant pipeline.

---

## Schema Migration (0051)

**File:** `apps/api/src/database/migrations-drizzle/0051_rfq_job_cross_tenant.sql`

### RFQ cross-tenant columns

```sql
ALTER TABLE rfqs
  ADD COLUMN issuer_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN recipient_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN custodian_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN capture_method TEXT,
  ADD COLUMN ownership_status TEXT DEFAULT 'owned';

CREATE INDEX idx_rfqs_issuer_org ON rfqs(issuer_organisation_id) WHERE issuer_organisation_id IS NOT NULL;
CREATE INDEX idx_rfqs_recipient_org ON rfqs(recipient_organisation_id) WHERE recipient_organisation_id IS NOT NULL;
CREATE INDEX idx_rfqs_custodian ON rfqs(custodian_tenant_id) WHERE custodian_tenant_id IS NOT NULL;
```

### Job source-tracking columns

```sql
ALTER TABLE jobs
  ADD COLUMN source_rfq_id UUID REFERENCES rfqs(id),
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_version_number INTEGER DEFAULT 1,
  ADD COLUMN latest_available_version INTEGER DEFAULT 1,
  ADD COLUMN version_acknowledged BOOLEAN DEFAULT true;

CREATE INDEX idx_jobs_source_rfq ON jobs(source_rfq_id) WHERE source_rfq_id IS NOT NULL;
CREATE INDEX idx_jobs_source_tenant ON jobs(source_tenant_id) WHERE source_tenant_id IS NOT NULL;
```

### Schema update

**File:** `apps/api/src/database/schema/index.ts`

Add to `rfqs` table:

```typescript
issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
captureMethod: text('capture_method'),
ownershipStatus: text('ownership_status').default('owned'),
```

Add to `jobs` table:

```typescript
sourceRfqId: uuid('source_rfq_id').references(() => rfqs.id),
sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
sourceVersionNumber: integer('source_version_number').default(1),
latestAvailableVersion: integer('latest_available_version').default(1),
versionAcknowledged: boolean('version_acknowledged').default(true),
```

### Rollback

```sql
ALTER TABLE rfqs
  DROP COLUMN IF EXISTS issuer_organisation_id,
  DROP COLUMN IF EXISTS recipient_organisation_id,
  DROP COLUMN IF EXISTS custodian_tenant_id,
  DROP COLUMN IF EXISTS capture_method,
  DROP COLUMN IF EXISTS ownership_status;

ALTER TABLE jobs
  DROP COLUMN IF EXISTS source_rfq_id,
  DROP COLUMN IF EXISTS source_tenant_id,
  DROP COLUMN IF EXISTS source_organisation_id,
  DROP COLUMN IF EXISTS source_version_number,
  DROP COLUMN IF EXISTS latest_available_version,
  DROP COLUMN IF EXISTS version_acknowledged;
```

---

## DocumentIssuanceService — RFQ Support

**File:** `apps/api/src/modules/domain/services/document-issuance.service.ts`

### Fix `RECIPIENT_TYPE_MAP`

Current mapping is `rfq: 'rfq'` (identity). Change to:

```typescript
const RECIPIENT_TYPE_MAP: Record<string, string> = {
  purchase_order: 'work_order',
  quote: 'proposal',
  invoice: 'bill',
  rfq: 'job',          // ← FIX: RFQ produces a Job in the recipient tenant
};
```

### Add RFQ to `loadDocumentWithItems`

Currently throws `unsupported documentType=rfq`. Add:

```typescript
case 'rfq': {
  const [rfq] = await tx
    .select()
    .from(rfqs)
    .where(and(eq(rfqs.id, documentId), eq(rfqs.tenantId, tenantId)));

  if (!rfq) throw new NotFoundException(`RFQ ${documentId} not found`);

  const groups = await tx
    .select()
    .from(rfqGroups)
    .where(eq(rfqGroups.rfqId, documentId));

  const combos = await tx
    .select()
    .from(rfqCombos)
    .where(
      inArray(rfqCombos.rfqGroupId, groups.map((g) => g.id)),
    );

  const items = await tx
    .select()
    .from(rfqItems)
    .where(
      or(
        inArray(rfqItems.rfqGroupId, groups.map((g) => g.id)),
        inArray(rfqItems.rfqComboId, combos.map((c) => c.id)),
      ),
    );

  return {
    document: rfq,
    lineItems: { groups, combos, items },
  };
}
```

### Add org stamping in `execute()`

In the issuer/recipient stamping section, add the RFQ case:

```typescript
case 'rfq': {
  await tx
    .update(rfqs)
    .set({
      issuerOrganisationId: issuerOrganisationId,
      recipientOrganisationId: recipientOrganisationId,
    })
    .where(eq(rfqs.id, documentId));
  break;
}
```

### Add `createJobFromRfq` in `createRecipientEntity`

```typescript
case 'rfq': {
  return this.createJobFromRfq({
    rfq: document,
    lineItems,
    recipientTenantId,
    recipientOrganisationId,
    issuerOrganisationId,
    tx,
  });
}
```

Implementation:

```typescript
private async createJobFromRfq(params: {
  rfq: RfqRow;
  lineItems: { groups: any[]; combos: any[]; items: any[] };
  recipientTenantId: string;
  recipientOrganisationId: string;
  issuerOrganisationId: string;
  tx: DrizzleDbOrTx;
}): Promise<{ recipientEntityId: string }> {
  const { rfq, recipientTenantId, issuerOrganisationId, tx } = params;

  // Resolve 'Received' job status in recipient tenant
  const statusLookupId = await this.lookupResolution.resolve({
    tenantId: recipientTenantId,
    domain: LOOKUP_DOMAINS.JOB_STATUS,
    externalReference: 'Received',
    name: 'Received',
    autoCreate: true,
    tx,
  });

  // Resolve 'RFQ' job type in recipient tenant
  const jobTypeLookupId = await this.lookupResolution.resolve({
    tenantId: recipientTenantId,
    domain: 'job_type',
    externalReference: 'RFQ',
    name: 'RFQ',
    autoCreate: true,
    tx,
  });

  // Perspective swap: buyer's rfqTo → vendor's customer, buyer's rfqFrom → vendor's assignee
  const [job] = await tx
    .insert(jobs)
    .values({
      tenantId: recipientTenantId,
      name: rfq.name ?? `Job from RFQ ${rfq.rfqNumber}`,
      externalReference: `rfq-${rfq.id}`,
      jobTypeLookupId,
      statusLookupId,
      requestDate: rfq.sentDate ? new Date(rfq.sentDate) : new Date(),
      sourceRfqId: rfq.id,
      sourceTenantId: rfq.tenantId,
      sourceOrganisationId: issuerOrganisationId,
      sourceVersionNumber: 1,
      latestAvailableVersion: 1,
      versionAcknowledged: true,
      apiPayload: {
        rfqPayload: {
          rfqId: rfq.id,
          rfqNumber: rfq.rfqNumber,
          rfqFrom: rfq.rfqFrom,
          rfqTo: rfq.rfqTo,
          note: rfq.note,
          dueDate: rfq.dueDate,
          includePricing: rfq.includePricing,
          includeQuantities: rfq.includeQuantities,
        },
      },
    })
    .returning();

  // Initialize workflow state
  await this.workflowEngine.initializeState({
    tenantId: recipientTenantId,
    entityType: 'job',
    entityId: job.id,
    workflowName: 'standard',
    initialStep: 'received',
    userId: 'system',
    tx,
  });

  // Copy RFQ scope items to job line-items
  // RFQ scope is informational for the vendor — they use it to create their estimate
  // Stored in job's apiPayload.rfqPayload rather than as separate job line-item tables
  // (Jobs don't have their own line-item tables — line items belong to estimates/quotes)

  return { recipientEntityId: job.id };
}
```

**Note on line items:** Jobs do not have their own groups/combos/items tables in the current schema. The RFQ scope is stored as a snapshot in `apiPayload.rfqPayload` on the job, consistent with how Crunchwork job data is stored. The vendor creates an estimate (quote) against the job, which has its own line-item hierarchy. If the business requires job-level scope tables in the future, that would be a separate schema addition.

---

## RFQ Workflow Definition

**New file:** `apps/api/src/modules/domain/workflows/definitions/rfq.workflows.ts`

```typescript
import type { WorkflowDefinition } from '../workflow.interface';

export const rfqStandard: WorkflowDefinition = {
  entity: 'rfq',
  name: 'standard',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      transitions: [
        {
          to: 'sent',
          action: 'send',
          guards: ['hasLineItems'],
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'sent',
      transitions: [
        {
          to: 'responded',
          action: 'respond',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'cancelled',
          action: 'cancel',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'expired',
          action: 'expire',
          onEnter: ['syncStatusLookup'],
        },
      ],
    },
    {
      id: 'responded',
      transitions: [
        {
          to: 'closed',
          action: 'close',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    { id: 'closed', isFinal: true, transitions: [] },
    { id: 'cancelled', isFinal: true, transitions: [] },
    { id: 'expired', isFinal: true, transitions: [] },
  ],
};
```

**Registration:** Add to `WorkflowModule.onModuleInit()`:

```typescript
this.engine.registerDefinition(rfqStandard);
```

**Step → lookup mapping** (added to `SyncStatusLookupHook` STEP_TO_LOOKUP):

```typescript
rfq: {
  draft:     { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Draft' },
  sent:      { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Sent' },
  responded: { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Responded' },
  closed:    { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Closed' },
  cancelled: { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Cancelled' },
  expired:   { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Expired' },
},
```

---

## RFQsService — Workflow Integration

**File:** `apps/api/src/modules/rfqs/rfqs.service.ts`

### `create` enhancement

After creating the RFQ (existing logic), initialize workflow state:

```typescript
await this.workflowEngine.initializeState({
  tenantId,
  entityType: 'rfq',
  entityId: rfq.id,
  workflowName: 'standard',
  initialStep: 'draft',
  userId,
  tx,
});
```

### New method: `send`

Issue the RFQ to the vendor. This is the primary cross-tenant action.

```typescript
async send(params: { rfqId: string; userId: string }) {
  const tenantId = this.tenantContext.getTenantId();
  const rfq = await this.rfqsRepo.findOne({ id: params.rfqId, tenantId });
  if (!rfq) throw new NotFoundException('RFQ not found');

  // Resolve recipient org from vendor if not already set
  let recipientOrganisationId = rfq.recipientOrganisationId;
  if (!recipientOrganisationId && rfq.vendorId) {
    const vendor = await this.vendorsRepo.findOne({ id: rfq.vendorId, tenantId });
    if (vendor?.organisationId) {
      recipientOrganisationId = vendor.organisationId;
      await this.rfqsRepo.update({
        id: params.rfqId,
        data: { recipientOrganisationId },
      });
    }
  }

  // Set sentDate
  await this.rfqsRepo.update({
    id: params.rfqId,
    data: { sentDate: new Date() },
  });

  // Advance workflow — triggers issueDocument + publishCrossTenantEvent hooks
  await this.workflowEngine.advance({
    tenantId,
    entityType: 'rfq',
    entityId: params.rfqId,
    workflowName: 'standard',
    action: 'send',
    currentStep: 'draft',
    userId: params.userId,
  });
}
```

### New method: `markResponded`

Called when a proposal is received for this RFQ (cross-tenant or manual capture).

```typescript
async markResponded(params: { rfqId: string; userId: string }) {
  const tenantId = this.tenantContext.getTenantId();
  await this.workflowEngine.advance({
    tenantId,
    entityType: 'rfq',
    entityId: params.rfqId,
    workflowName: 'standard',
    action: 'respond',
    currentStep: 'sent',
    userId: params.userId,
  });
}
```

### New methods: `cancel`, `close`, `expire`

Each follows the same pattern — call `workflowEngine.advance()` with the appropriate action.

### Controller endpoints

Add to `apps/api/src/modules/rfqs/rfqs.controller.ts`:

```typescript
@Post(':id/send')
async send(@Param('id') id: string, @Request() req) {
  return this.rfqsService.send({ rfqId: id, userId: req.user.id });
}

@Post(':id/respond')
async markResponded(@Param('id') id: string, @Request() req) {
  return this.rfqsService.markResponded({ rfqId: id, userId: req.user.id });
}

@Post(':id/cancel')
async cancel(@Param('id') id: string, @Request() req) {
  return this.rfqsService.cancel({ rfqId: id, userId: req.user.id });
}

@Post(':id/close')
async close(@Param('id') id: string, @Request() req) {
  return this.rfqsService.close({ rfqId: id, userId: req.user.id });
}
```

---

## Manual Capture — `captureRfq`

**File:** `apps/api/src/modules/domain/services/manual-capture.service.ts`

New method mirroring `capturePurchaseOrder` and `captureEstimate` patterns:

```typescript
async captureRfq(params: {
  tenantId: string;
  userId: string;
  dto: {
    issuerName: string;
    issuerEmail?: string;
    issuerAbn?: string;
    rfqNumber?: string;
    name?: string;
    note?: string;
    dueDate?: string;
    jobId?: string;
    claimId?: string;
    includePricing?: boolean;
    includeQuantities?: boolean;
  };
}): Promise<{ rfqId: string; jobId: string; ghostOrganisationId: string }> {
  return this.db.transaction(async (tx) => {
    // 1. Resolve or create ghost issuer organisation
    const ghostOrg = await this.ghostOrgService.resolveOrCreate({
      name: params.dto.issuerName,
      primaryEmail: params.dto.issuerEmail,
      abn: params.dto.issuerAbn,
      tenantId: params.tenantId,
      tx,
    });

    // 2. Resolve statuses
    const rfqStatusId = await this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: LOOKUP_DOMAINS.RFQ_STATUS,
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    const jobStatusId = await this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: LOOKUP_DOMAINS.JOB_STATUS,
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    const jobTypeId = await this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: 'job_type',
      externalReference: 'RFQ',
      name: 'RFQ',
      autoCreate: true,
      tx,
    });

    // 3. Create custodial RFQ (owned by ghost issuer, stored in user's tenant)
    const [rfq] = await tx
      .insert(rfqs)
      .values({
        tenantId: params.tenantId,
        name: params.dto.name ?? `RFQ from ${params.dto.issuerName}`,
        rfqNumber: params.dto.rfqNumber,
        note: params.dto.note,
        dueDate: params.dto.dueDate ? new Date(params.dto.dueDate) : null,
        jobId: params.dto.jobId,
        claimId: params.dto.claimId,
        includePricing: params.dto.includePricing ?? false,
        includeQuantities: params.dto.includeQuantities ?? true,
        statusLookupId: rfqStatusId,
        issuerOrganisationId: ghostOrg.id,
        recipientOrganisationId: params.tenantId,
        custodianTenantId: params.tenantId,
        captureMethod: 'manual',
        ownershipStatus: 'externally_captured',
        rfqFrom: {
          name: params.dto.issuerName,
          email: params.dto.issuerEmail,
          abn: params.dto.issuerAbn,
        },
        createdByUserId: params.userId,
      })
      .returning();

    // 4. Create linked Job (the user's response to the received RFQ)
    const [job] = await tx
      .insert(jobs)
      .values({
        tenantId: params.tenantId,
        name: params.dto.name ?? `Job from RFQ ${rfq.rfqNumber ?? rfq.id}`,
        externalReference: `captured-rfq-${rfq.id}`,
        jobTypeLookupId: jobTypeId,
        statusLookupId: jobStatusId,
        claimId: params.dto.claimId,
        sourceRfqId: rfq.id,
        sourceOrganisationId: ghostOrg.id,
        apiPayload: {
          rfqPayload: {
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            rfqFrom: rfq.rfqFrom,
            note: rfq.note,
            dueDate: rfq.dueDate,
          },
        },
      })
      .returning();

    // 5. Link RFQ to Job
    await tx
      .update(rfqs)
      .set({ jobId: job.id })
      .where(eq(rfqs.id, rfq.id));

    // 6. Initialize workflow states
    await this.workflowEngine.initializeState({
      tenantId: params.tenantId,
      entityType: 'rfq',
      entityId: rfq.id,
      workflowName: 'standard',
      initialStep: 'sent',
      userId: params.userId,
      tx,
    });

    await this.workflowEngine.initializeState({
      tenantId: params.tenantId,
      entityType: 'job',
      entityId: job.id,
      workflowName: 'standard',
      initialStep: 'received',
      userId: params.userId,
      tx,
    });

    return {
      rfqId: rfq.id,
      jobId: job.id,
      ghostOrganisationId: ghostOrg.id,
    };
  });
}
```

### Controller endpoint

**File:** `apps/api/src/modules/rfqs/rfqs.controller.ts`

```typescript
@Post('capture')
async captureRfq(@Body() body: CaptureRfqDto, @Request() req) {
  return this.manualCaptureService.captureRfq({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    dto: body,
  });
}
```

**DTO:** `CaptureRfqDto` requires `issuerName`, optional `issuerEmail`, `issuerAbn`, `rfqNumber`, `name`, `note`, `dueDate`, `jobId`, `claimId`, `includePricing`, `includeQuantities`.

---

## Custody Transfer — RFQ

**File:** `apps/api/src/modules/domain/services/custody-transfer.service.ts`

New method following the established PO and quote transfer patterns:

```typescript
async transferCustodialRfqs(params: {
  ghostOrganisationId: string;
  issuerTenantId: string;
  recipientTenantId: string;
  tx: DrizzleDbOrTx;
}): Promise<{ transferred: number }> {
  const { ghostOrganisationId, issuerTenantId, recipientTenantId, tx } = params;

  // Find custodial RFQs where the ghost is the issuer
  const custodialRfqs = await tx
    .select()
    .from(rfqs)
    .where(
      and(
        eq(rfqs.issuerOrganisationId, ghostOrganisationId),
        eq(rfqs.ownershipStatus, 'externally_captured'),
        eq(rfqs.custodianTenantId, recipientTenantId),
      ),
    );

  if (custodialRfqs.length === 0) return { transferred: 0 };

  for (const rfq of custodialRfqs) {
    // Move RFQ to issuer tenant
    await tx
      .update(rfqs)
      .set({
        tenantId: issuerTenantId,
        custodianTenantId: null,
        ownershipStatus: 'transferred',
        updatedAt: new Date(),
      })
      .where(eq(rfqs.id, rfq.id));

    // Update RFQ line-item tables tenant
    await tx
      .update(rfqGroups)
      .set({ tenantId: issuerTenantId })
      .where(eq(rfqGroups.rfqId, rfq.id));

    // Update combos via group join
    const groups = await tx
      .select({ id: rfqGroups.id })
      .from(rfqGroups)
      .where(eq(rfqGroups.rfqId, rfq.id));

    if (groups.length > 0) {
      const groupIds = groups.map((g) => g.id);
      await tx
        .update(rfqCombos)
        .set({ tenantId: issuerTenantId })
        .where(inArray(rfqCombos.rfqGroupId, groupIds));

      await tx
        .update(rfqItems)
        .set({ tenantId: issuerTenantId })
        .where(inArray(rfqItems.rfqGroupId, groupIds));
    }

    // Update linked jobs' sourceTenantId
    await tx
      .update(jobs)
      .set({ sourceTenantId: issuerTenantId })
      .where(eq(jobs.sourceRfqId, rfq.id));
  }

  this.logger.log(
    `CustodyTransferService.transferCustodialRfqs — transferred ${custodialRfqs.length} RFQs from ghost ${ghostOrganisationId}`,
  );

  return { transferred: custodialRfqs.length };
}
```

**Integration:** Call from the main `executeCustodyTransfer` method:

```typescript
await this.transferCustodialRfqs({ ghostOrganisationId, issuerTenantId, recipientTenantId, tx });
```

---

## PubSub — RFQ and Job Topics

### Topic configuration

**File:** `apps/api/src/config/pubsub.config.ts`

Add:

```typescript
topics: {
  // ... existing ...
  rfqs: `claims.rfqs-${env}`,
  jobs: `claims.jobs-${env}`,
},
subscriptions: {
  // ... existing ...
  rfqEvents: `claims.rfqs-api-sub-${env}`,
  jobEvents: `claims.jobs-api-sub-${env}`,
},
```

### Topic resolver

**File:** `apps/api/src/modules/pubsub/topic-resolver.ts`

Add to `ENTITY_TO_TOPIC`:

```typescript
rfq: 'rfqs',
job: 'jobs',
```

### Event handlers

**New file:** `apps/api/src/modules/pubsub/handlers/rfq-event.handler.ts`

```typescript
@Injectable()
export class RfqEventHandler implements PubSubEventHandler {
  readonly entityType = 'rfq';

  async handle(event: DomainEventEnvelope): Promise<void> {
    switch (event.action) {
      case 'cancel':
        // When buyer cancels RFQ, update the corresponding Job in vendor tenant
        // Mark job as cancelled/declined
        break;
      case 'expire':
        // Notify vendor that RFQ has expired
        break;
    }
  }
}
```

**New file:** `apps/api/src/modules/pubsub/handlers/job-event.handler.ts`

```typescript
@Injectable()
export class JobEventHandler implements PubSubEventHandler {
  readonly entityType = 'job';

  async handle(event: DomainEventEnvelope): Promise<void> {
    switch (event.action) {
      case 'decline':
        // Vendor declined job → update RFQ status in buyer tenant
        break;
      case 'accept':
        // Vendor accepted job → buyer receives acknowledgment
        break;
      case 'complete':
        // Vendor completed job → update RFQ to responded/closed
        break;
    }
  }
}
```

**Registration:** Add both handlers to `PubSubModule` providers and inject into `PubSubSubscriberService`.

---

## Ghost Organisation Extension

**File:** `apps/api/src/modules/domain/services/ghost-organisation.service.ts`

Update `findGhostsByTenant` to also include RFQ-based ghosts (per doc 48 Phase 2 which adds quote-based ghosts):

```typescript
const rfqGhosts = this.db
  .selectDistinctOn([organizations.id], { /* same columns */ })
  .from(organizations)
  .innerJoin(
    rfqs,
    and(
      eq(rfqs.issuerOrganisationId, organizations.id),
      eq(rfqs.custodianTenantId, params.tenantId),
    ),
  )
  .where(eq(organizations.subscriptionStatus, 'ghost'));
```

Add to the UNION in the combined query.

---

## Frontend

### CaptureRfqDrawer

**New file:** `apps/frontend/src/components/rfqs/CaptureRfqDrawer.tsx`

Drawer/dialog component mirroring `CapturePurchaseOrderDrawer` and `CaptureEstimateDrawer`:

- **Fields:** Issuer Name (required), Issuer Email, Issuer ABN, RFQ Number, Name, Note, Due Date, Include Pricing, Include Quantities
- **Job/Claim selector:** optional link to existing job or claim
- **Submit action:** calls `POST /rfqs/capture`
- **Success:** navigates to the created Job detail page

### RFQ detail — "Issue to Vendor" button

**File:** `apps/frontend/src/components/rfqs/RfqDetail.tsx` (or equivalent)

When RFQ is in `draft` status:
- Show "Issue to Vendor" button
- Button resolves vendor org from `vendorId` and calls `POST /rfqs/:id/send`
- If vendor has no `organisationId` (off-platform), show "Send as PDF" option instead (existing PDF generation flow)
- If vendor is on-platform, show "Issue Digitally" with a confirmation dialog

### RFQ status actions

Status-based action buttons matching the workflow transitions:
- `draft` → "Send" button
- `sent` → "Cancel" button
- `responded` → "Close" button

---

## RFQ ↔ Proposal/Estimate Linkage

When a vendor receives a Job (from RFQ issuance) and creates an estimate (quote) against it, the existing quote→proposal cross-tenant flow (doc 41) handles the return path:

1. Vendor creates quote against `jobId`
2. Vendor publishes quote → `DocumentIssuanceService` creates proposal in buyer tenant
3. The proposal's `rfqId` should be set from the job's `sourceRfqId`:

**Enhancement in `DocumentIssuanceService.createProposalFromQuote`:**

```typescript
// If the source quote is linked to a job that was created from an RFQ,
// link the proposal back to the original RFQ
if (quote.jobId) {
  const [job] = await tx
    .select({ sourceRfqId: jobs.sourceRfqId })
    .from(jobs)
    .where(eq(jobs.id, quote.jobId));

  if (job?.sourceRfqId) {
    await tx
      .update(proposals)
      .set({ rfqId: job.sourceRfqId })
      .where(eq(proposals.id, proposal.id));
  }
}
```

When a proposal is created with `rfqId` set, automatically advance the RFQ to `responded` status:

```typescript
if (rfqId) {
  await this.rfqsService.markResponded({ rfqId, userId: 'system' });
}
```

---

## Testing Strategy

- **Issuance:** Create RFQ with on-platform vendor → send → verify Job created in vendor tenant with `sourceRfqId`, `sourceTenantId`, `sourceOrganisationId`.
- **Manual capture:** Call `POST /rfqs/capture` → verify RFQ + Job created with ghost org, custody fields set.
- **Custody transfer:** Create ghost via RFQ capture. Subscribe ghost → verify RFQ transferred, job `sourceTenantId` updated.
- **Round-trip:** Issue RFQ → vendor creates estimate → publishes → buyer receives proposal with `rfqId` set → RFQ status advances to `responded`.
- **Workflow:** Verify all RFQ transitions fire `syncStatusLookup` and cross-tenant events.

---

## File Impact Summary

| Category | Files |
|----------|-------|
| **Migration** | `0051_rfq_job_cross_tenant.sql` |
| **Schema** | `schema/index.ts` (rfqs + jobs tables) |
| **New files** | `rfq.workflows.ts`, `rfq-event.handler.ts`, `job-event.handler.ts`, `CaptureRfqDrawer.tsx` |
| **Modified (backend)** | `document-issuance.service.ts`, `rfqs.service.ts`, `rfqs.controller.ts`, `manual-capture.service.ts`, `custody-transfer.service.ts`, `ghost-organisation.service.ts`, `workflow.module.ts`, `pubsub.config.ts`, `topic-resolver.ts`, `sync-status-lookup.hook.ts` |
| **Modified (frontend)** | RFQ detail component (status actions, issue button) |
| **New endpoints** | `POST /rfqs/capture`, `POST /rfqs/:id/send`, `POST /rfqs/:id/cancel`, `POST /rfqs/:id/close`, `POST /rfqs/:id/respond` |
