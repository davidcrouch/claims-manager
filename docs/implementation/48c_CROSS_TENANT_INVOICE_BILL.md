# 48c — Invoice / Bill Cross-Tenant Completion

**Series:** 48 (Cross-Tenant Supply Chain Completion)  
**Review reference:** `docs/reviews/cross-tenant-supply-chain-review.md` item #4  
**Depends on:** 48 (workflow engine, lookup standardisation)  
**Status:** Planned

---

## Overview

Invoices and bills are the final step in the supply chain cycle: the vendor submits an invoice, and the buyer receives it as a bill. The issuance skeleton exists (`RECIPIENT_TYPE_MAP` maps `invoice → bill`, `createBillFromInvoice` copies headers, topic mappings are declared), but cross-tenant fields, status resolution, manual capture, custody transfer, workflow definitions, and pub/sub handlers are all missing.

### Key architectural note

Unlike quotes/proposals and POs/WOs, invoices and bills are **flat header tables** — they have no normalised line-item child tables (`invoice_groups`, `invoice_items`, etc.). Line-item detail lives in `invoicePayload` / `billPayload` JSONB columns. This means the `LineItemCopyService` (doc 48) is not needed here; payload JSON is copied directly during issuance.

---

## Schema Migration (0052)

**File:** `apps/api/src/database/migrations-drizzle/0052_invoice_bill_cross_tenant.sql`

### Invoice cross-tenant columns

```sql
ALTER TABLE invoices
  ADD COLUMN issuer_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN recipient_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN custodian_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN capture_method TEXT,
  ADD COLUMN ownership_status TEXT DEFAULT 'owned';

CREATE INDEX idx_invoices_issuer_org ON invoices(issuer_organisation_id) WHERE issuer_organisation_id IS NOT NULL;
CREATE INDEX idx_invoices_recipient_org ON invoices(recipient_organisation_id) WHERE recipient_organisation_id IS NOT NULL;
CREATE INDEX idx_invoices_custodian ON invoices(custodian_tenant_id) WHERE custodian_tenant_id IS NOT NULL;
```

### Bill source-tracking columns

```sql
ALTER TABLE bills
  ADD COLUMN source_tenant_id UUID REFERENCES organizations(id),
  ADD COLUMN source_organisation_id UUID REFERENCES organizations(id),
  ADD COLUMN source_external_reference TEXT;

CREATE INDEX idx_bills_source_tenant ON bills(source_tenant_id) WHERE source_tenant_id IS NOT NULL;
```

### Schema update

**File:** `apps/api/src/database/schema/index.ts`

Add to `invoices` table:

```typescript
issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
captureMethod: text('capture_method'),
ownershipStatus: text('ownership_status').default('owned'),
```

Add to `bills` table:

```typescript
sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
sourceExternalReference: text('source_external_reference'),
```

### Rollback

```sql
ALTER TABLE invoices
  DROP COLUMN IF EXISTS issuer_organisation_id,
  DROP COLUMN IF EXISTS recipient_organisation_id,
  DROP COLUMN IF EXISTS custodian_tenant_id,
  DROP COLUMN IF EXISTS capture_method,
  DROP COLUMN IF EXISTS ownership_status;

ALTER TABLE bills
  DROP COLUMN IF EXISTS source_tenant_id,
  DROP COLUMN IF EXISTS source_organisation_id,
  DROP COLUMN IF EXISTS source_external_reference;
```

---

## DocumentIssuanceService — Invoice Enhancements

**File:** `apps/api/src/modules/domain/services/document-issuance.service.ts`

### Add org stamping in `execute()` for invoices

Currently, issuer/recipient org stamping runs only for `purchase_order` and `quote`. Add the invoice case:

```typescript
case 'invoice': {
  await tx
    .update(invoices)
    .set({
      issuerOrganisationId: issuerOrganisationId,
      recipientOrganisationId: recipientOrganisationId,
    })
    .where(eq(invoices.id, documentId));
  break;
}
```

### Enhance `createBillFromInvoice`

The existing method copies basic header fields but is missing cross-tenant data propagation and proper status resolution. Update to:

```typescript
private async createBillFromInvoice(params: {
  sourceDocumentId: string;
  sourceEntity: Record<string, unknown>;
  sourceTenantId: string;
  recipientTenantId: string;
  recipientOrganisationId: string;
  issuerOrganisationId: string;
  versionNumber: number;
  tx: DrizzleDbOrTx;
}): Promise<string> {
  const src = params.sourceEntity;

  // Resolve 'Received' bill status in recipient tenant
  const statusLookupId = await this.lookupResolution.resolve({
    tenantId: params.recipientTenantId,
    domain: LOOKUP_DOMAINS.BILL_STATUS,
    externalReference: 'Received',
    name: 'Received',
    autoCreate: true,
    tx: params.tx,
  });

  // Resolve recipient-side PO from the source PO's cross-tenant relationship
  let recipientPurchaseOrderId: string | undefined;
  const sourcePurchaseOrderId = src.purchaseOrderId as string | undefined;
  if (sourcePurchaseOrderId) {
    const [recipientWo] = await params.tx
      .select({ id: workOrders.id, purchaseOrderId: workOrders.purchaseOrderId })
      .from(workOrders)
      .where(
        and(
          eq(workOrders.sourcePurchaseOrderId, sourcePurchaseOrderId),
          eq(workOrders.tenantId, params.recipientTenantId),
        ),
      )
      .limit(1);
    // If buyer has a PO that sourced this vendor's WO, use it for the bill
    // Otherwise, try to find PO in buyer tenant via source tracking
    if (recipientWo?.purchaseOrderId) {
      recipientPurchaseOrderId = recipientWo.purchaseOrderId;
    }
  }

  // Resolve vendor record in buyer tenant
  let vendorId: string | undefined;
  if (params.issuerOrganisationId) {
    const vendor = await this.vendorsRepo.findByOrganisationId({
      organisationId: params.issuerOrganisationId,
      tenantId: params.recipientTenantId,
    });
    vendorId = vendor?.id;
  }

  const billData: Partial<BillInsert> = {
    tenantId: params.recipientTenantId,
    invoiceId: params.sourceDocumentId,
    purchaseOrderId: recipientPurchaseOrderId,
    claimId: src.claimId as string | undefined,
    jobId: src.jobId as string | undefined,
    vendorId,
    billNumber: src.invoiceNumber as string | undefined,
    issueDate: src.issueDate as Date | undefined,
    receivedDate: new Date(),
    comments: src.comments as string | undefined,
    statusLookupId,
    subTotal: src.subTotal as string | undefined,
    totalTax: src.totalTax as string | undefined,
    totalAmount: src.totalAmount as string | undefined,
    billPayload: (src.invoicePayload as Record<string, unknown>) ?? {},
    sourceTenantId: params.sourceTenantId,
    sourceOrganisationId: params.issuerOrganisationId,
    sourceExternalReference: src.invoiceNumber as string | undefined,
    sourceVersionNumber: params.versionNumber,
    latestAvailableVersion: params.versionNumber,
    versionAcknowledged: false,
  };

  const created = await this.billsRepo.create({
    data: billData as BillInsert,
    tx: params.tx,
  });

  // Initialize workflow state
  await this.workflowEngine.initializeState({
    tenantId: params.recipientTenantId,
    entityType: 'bill',
    entityId: created.id,
    workflowName: 'standard',
    initialStep: 'received',
    userId: 'system',
    tx: params.tx,
  });

  this.logger.log(
    `DocumentIssuanceService.createBillFromInvoice — created bill ${created.id} in tenant ${params.recipientTenantId}`,
  );

  return created.id;
}
```

---

## Workflow Definitions

### `invoiceStandard`

**New file:** `apps/api/src/modules/domain/workflows/definitions/invoice.workflows.ts`

```typescript
import type { WorkflowDefinition } from '../workflow.interface';

export const invoiceStandard: WorkflowDefinition = {
  entity: 'invoice',
  name: 'standard',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      transitions: [
        {
          to: 'submitted',
          action: 'submit',
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'submitted',
      transitions: [
        {
          to: 'approved',
          action: 'approve',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'declined',
          action: 'decline',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'approved',
      transitions: [
        {
          to: 'paid',
          action: 'pay',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    { id: 'paid', isFinal: true, transitions: [] },
    { id: 'declined', isFinal: true, transitions: [] },
  ],
};
```

### `billStandard`

**New file:** `apps/api/src/modules/domain/workflows/definitions/bill.workflows.ts`

```typescript
import type { WorkflowDefinition } from '../workflow.interface';

export const billStandard: WorkflowDefinition = {
  entity: 'bill',
  name: 'standard',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      transitions: [
        {
          to: 'under_review',
          action: 'review',
          onEnter: ['syncStatusLookup'],
        },
        {
          to: 'approved',
          action: 'approve',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'declined',
          action: 'decline',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'under_review',
      transitions: [
        {
          to: 'approved',
          action: 'approve',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'declined',
          action: 'decline',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
        {
          to: 'disputed',
          action: 'dispute',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'approved',
      transitions: [
        {
          to: 'paid',
          action: 'pay',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    {
      id: 'disputed',
      transitions: [
        {
          to: 'under_review',
          action: 'review',
          onEnter: ['syncStatusLookup'],
        },
        {
          to: 'declined',
          action: 'decline',
          onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'],
        },
      ],
    },
    { id: 'paid', isFinal: true, transitions: [] },
    { id: 'declined', isFinal: true, transitions: [] },
  ],
};
```

### Registration

**File:** `apps/api/src/modules/domain/workflows/workflow.module.ts`

```typescript
import { invoiceStandard } from './definitions/invoice.workflows';
import { billStandard } from './definitions/bill.workflows';

// In onModuleInit():
this.engine.registerDefinition(invoiceStandard);
this.engine.registerDefinition(billStandard);
```

### Step → lookup mapping

**File:** `apps/api/src/modules/domain/workflows/hooks/sync-status-lookup.hook.ts`

Add to `STEP_TO_LOOKUP`:

```typescript
invoice: {
  draft:     { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Draft' },
  submitted: { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Submitted' },
  approved:  { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Approved' },
  declined:  { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Declined' },
  paid:      { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Paid' },
},
bill: {
  received:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Received' },
  under_review: { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Under Review' },
  approved:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Approved' },
  declined:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Declined' },
  disputed:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Disputed' },
  paid:         { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Paid' },
},
```

---

## Service Workflow Integration

### InvoicesService

**File:** `apps/api/src/modules/invoices/invoices.service.ts`

Inject `WorkflowEngineService`. Add lifecycle methods:

| New method | Workflow action | Notes |
|-----------|----------------|-------|
| `submit` | `submit` (draft → submitted) | Triggers `issueDocument` + `publishCrossTenantEvent`. For on-platform vendors, creates bill in buyer tenant. |
| `approve` | `approve` (submitted → approved) | Vendor-side: buyer approved the invoice (via cross-tenant event) |
| `markPaid` | `pay` (approved → paid) | Vendor-side: payment received notification (via cross-tenant event) |

For CW-sourced invoices: the existing `create` method comes from CW webhook projection. Add `workflowEngine.project()` call after creation to sync workflow state.

### BillsService

**File:** `apps/api/src/modules/bills/bills.service.ts`

Inject `WorkflowEngineService`. Add lifecycle methods:

| New method | Workflow action | Notes |
|-----------|----------------|-------|
| `review` | `review` (received → under_review) | Internal buyer workflow |
| `approve` | `approve` (received/under_review → approved) | Triggers `publishCrossTenantEvent` (notifies vendor) |
| `decline` | `decline` (received/under_review → declined) | Triggers `publishCrossTenantEvent` |
| `dispute` | `dispute` (under_review → disputed) | Triggers `publishCrossTenantEvent` |
| `pay` | `pay` (approved → paid) | Triggers `publishCrossTenantEvent` (notifies vendor of payment) |

### Controller endpoints

**File:** `apps/api/src/modules/invoices/invoices.controller.ts`

```typescript
@Post(':id/submit')
async submit(@Param('id') id: string, @Request() req) { ... }
```

**File:** `apps/api/src/modules/bills/bills.controller.ts`

```typescript
@Post(':id/review')
async review(@Param('id') id: string, @Request() req) { ... }

@Post(':id/approve')
async approve(@Param('id') id: string, @Request() req) { ... }

@Post(':id/decline')
async decline(@Param('id') id: string, @Request() req) { ... }

@Post(':id/dispute')
async dispute(@Param('id') id: string, @Request() req) { ... }

@Post(':id/pay')
async pay(@Param('id') id: string, @Request() req) { ... }
```

---

## Manual Capture — `captureInvoice`

**File:** `apps/api/src/modules/domain/services/manual-capture.service.ts`

New method for manually capturing an off-platform vendor's invoice:

```typescript
async captureInvoice(params: {
  tenantId: string;
  userId: string;
  dto: {
    issuerName: string;
    issuerEmail?: string;
    issuerAbn?: string;
    invoiceNumber?: string;
    purchaseOrderId: string;      // required — invoices reference a PO
    claimId?: string;
    jobId?: string;
    issueDate?: string;
    comments?: string;
    subTotal?: string;
    totalTax?: string;
    totalAmount?: string;
    lineItems?: Record<string, unknown>[];  // stored in invoicePayload
  };
}): Promise<{ invoiceId: string; billId: string; ghostOrganisationId: string }> {
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
    const invoiceStatusId = await this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: LOOKUP_DOMAINS.INVOICE_STATUS,
      externalReference: 'Submitted',
      name: 'Submitted',
      autoCreate: true,
      tx,
    });

    const billStatusId = await this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: LOOKUP_DOMAINS.BILL_STATUS,
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    // 3. Create custodial invoice (owned by ghost vendor, stored in buyer's tenant)
    const invoicePayload = params.dto.lineItems
      ? { lineItems: params.dto.lineItems }
      : {};

    const [invoice] = await tx
      .insert(invoices)
      .values({
        tenantId: params.tenantId,
        purchaseOrderId: params.dto.purchaseOrderId,
        claimId: params.dto.claimId,
        jobId: params.dto.jobId,
        invoiceNumber: params.dto.invoiceNumber,
        issueDate: params.dto.issueDate ? new Date(params.dto.issueDate) : null,
        receivedDate: new Date(),
        comments: params.dto.comments,
        statusLookupId: invoiceStatusId,
        subTotal: params.dto.subTotal,
        totalTax: params.dto.totalTax,
        totalAmount: params.dto.totalAmount,
        invoicePayload,
        issuerOrganisationId: ghostOrg.id,
        recipientOrganisationId: params.tenantId,
        custodianTenantId: params.tenantId,
        captureMethod: 'manual',
        ownershipStatus: 'externally_captured',
        createdByUserId: params.userId,
      })
      .returning();

    // 4. Resolve vendor in buyer's tenant from the ghost org
    let vendorId: string | undefined;
    const vendor = await this.vendorsRepo.findByOrganisationId({
      organisationId: ghostOrg.id,
      tenantId: params.tenantId,
    });
    vendorId = vendor?.id;

    // 5. Create bill (buyer's view of the received invoice)
    const [bill] = await tx
      .insert(bills)
      .values({
        tenantId: params.tenantId,
        invoiceId: invoice.id,
        purchaseOrderId: params.dto.purchaseOrderId,
        claimId: params.dto.claimId,
        jobId: params.dto.jobId,
        vendorId,
        billNumber: params.dto.invoiceNumber,
        issueDate: params.dto.issueDate ? new Date(params.dto.issueDate) : null,
        receivedDate: new Date(),
        comments: params.dto.comments,
        statusLookupId: billStatusId,
        subTotal: params.dto.subTotal,
        totalTax: params.dto.totalTax,
        totalAmount: params.dto.totalAmount,
        billPayload: invoicePayload,
        sourceTenantId: params.tenantId,
        sourceOrganisationId: ghostOrg.id,
        sourceExternalReference: params.dto.invoiceNumber,
        sourceVersionNumber: 1,
        latestAvailableVersion: 1,
        versionAcknowledged: true,
        createdByUserId: params.userId,
      })
      .returning();

    // 6. Initialize workflow states
    await this.workflowEngine.initializeState({
      tenantId: params.tenantId,
      entityType: 'invoice',
      entityId: invoice.id,
      workflowName: 'standard',
      initialStep: 'submitted',
      userId: params.userId,
      tx,
    });

    await this.workflowEngine.initializeState({
      tenantId: params.tenantId,
      entityType: 'bill',
      entityId: bill.id,
      workflowName: 'standard',
      initialStep: 'received',
      userId: params.userId,
      tx,
    });

    return {
      invoiceId: invoice.id,
      billId: bill.id,
      ghostOrganisationId: ghostOrg.id,
    };
  });
}
```

### Controller endpoint

**File:** `apps/api/src/modules/invoices/invoices.controller.ts`

```typescript
@Post('capture')
async captureInvoice(@Body() body: CaptureInvoiceDto, @Request() req) {
  return this.manualCaptureService.captureInvoice({
    tenantId: req.user.tenantId,
    userId: req.user.id,
    dto: body,
  });
}
```

**DTO:** `CaptureInvoiceDto` requires `issuerName`, `purchaseOrderId`; optional `issuerEmail`, `issuerAbn`, `invoiceNumber`, `claimId`, `jobId`, `issueDate`, `comments`, `subTotal`, `totalTax`, `totalAmount`, `lineItems`.

---

## Custody Transfer — Invoice

**File:** `apps/api/src/modules/domain/services/custody-transfer.service.ts`

```typescript
async transferCustodialInvoices(params: {
  ghostOrganisationId: string;
  issuerTenantId: string;
  recipientTenantId: string;
  tx: DrizzleDbOrTx;
}): Promise<{ transferred: number }> {
  const { ghostOrganisationId, issuerTenantId, recipientTenantId, tx } = params;

  // Find custodial invoices where the ghost is the issuer
  const custodialInvoices = await tx
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.issuerOrganisationId, ghostOrganisationId),
        eq(invoices.ownershipStatus, 'externally_captured'),
        eq(invoices.custodianTenantId, recipientTenantId),
      ),
    );

  if (custodialInvoices.length === 0) return { transferred: 0 };

  for (const invoice of custodialInvoices) {
    // Move invoice to issuer (vendor) tenant
    await tx
      .update(invoices)
      .set({
        tenantId: issuerTenantId,
        custodianTenantId: null,
        ownershipStatus: 'transferred',
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, invoice.id));

    // Update linked bills' sourceTenantId to point to the new tenant
    await tx
      .update(bills)
      .set({ sourceTenantId: issuerTenantId })
      .where(eq(bills.invoiceId, invoice.id));
  }

  this.logger.log(
    `CustodyTransferService.transferCustodialInvoices — transferred ${custodialInvoices.length} invoices from ghost ${ghostOrganisationId}`,
  );

  return { transferred: custodialInvoices.length };
}
```

**Integration:** Call from the main `executeCustodyTransfer` method:

```typescript
await this.transferCustodialInvoices({ ghostOrganisationId, issuerTenantId, recipientTenantId, tx });
```

---

## PubSub — Invoice and Bill Handlers

Topics and subscriptions for invoices and bills already exist in `pubsub.config.ts` and `topic-resolver.ts`. The missing piece is the event handlers.

### InvoiceEventHandler

**New file:** `apps/api/src/modules/pubsub/handlers/invoice-event.handler.ts`

Handles events from the **buyer** (bill actions) that should update the invoice in the **vendor** tenant:

```typescript
@Injectable()
export class InvoiceEventHandler implements PubSubEventHandler {
  readonly entityType = 'invoice';

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<void> {
    switch (event.action) {
      case 'bill.approve':
        // Buyer approved bill → vendor's invoice marked approved
        await this.workflowEngine.project({
          entityType: 'invoice',
          entityId: event.metadata.sourceInvoiceId,
          tenantId: event.metadata.sourceTenantId,
          workflowName: 'standard',
          targetStep: 'approved',
          userId: 'system',
        });
        break;

      case 'bill.pay':
        // Buyer paid bill → vendor's invoice marked paid
        await this.workflowEngine.project({
          entityType: 'invoice',
          entityId: event.metadata.sourceInvoiceId,
          tenantId: event.metadata.sourceTenantId,
          workflowName: 'standard',
          targetStep: 'paid',
          userId: 'system',
        });
        break;

      case 'bill.decline':
        // Buyer declined bill → vendor's invoice marked declined
        await this.workflowEngine.project({
          entityType: 'invoice',
          entityId: event.metadata.sourceInvoiceId,
          tenantId: event.metadata.sourceTenantId,
          workflowName: 'standard',
          targetStep: 'declined',
          userId: 'system',
        });
        break;

      case 'bill.dispute':
        // Buyer disputed bill → vendor receives notification (no status change)
        this.logger.log(
          `InvoiceEventHandler.handle — bill disputed for invoice ${event.metadata.sourceInvoiceId}`,
        );
        break;
    }
  }
}
```

### BillEventHandler

**New file:** `apps/api/src/modules/pubsub/handlers/bill-event.handler.ts`

Handles events from the **vendor** (invoice actions) that should update the bill in the **buyer** tenant:

```typescript
@Injectable()
export class BillEventHandler implements PubSubEventHandler {
  readonly entityType = 'bill';

  constructor(
    private readonly billsService: BillsService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async handle(event: DomainEventEnvelope): Promise<void> {
    switch (event.action) {
      case 'invoice.submit':
        // Vendor submitted invoice → bill already created via issuance
        // This event is for notification only
        break;

      case 'invoice.update':
        // Vendor updated invoice → update bill payload if version changed
        if (event.metadata.billId && event.metadata.versionNumber) {
          await this.billsRepo.update({
            id: event.metadata.billId,
            data: {
              latestAvailableVersion: event.metadata.versionNumber,
              versionAcknowledged: false,
            },
          });
        }
        break;

      case 'invoice.close':
        // Vendor closed/voided invoice → mark bill accordingly
        break;
    }
  }
}
```

### PubSub subscriptions

**File:** `apps/api/src/config/pubsub.config.ts`

Subscriptions for invoices and bills already exist. No config changes needed — just ensure the handlers are registered.

### Registration

**File:** `apps/api/src/modules/pubsub/pubsub.module.ts`

Add `InvoiceEventHandler` and `BillEventHandler` to providers and inject into `PubSubSubscriberService`.

---

## Ghost Organisation Extension

**File:** `apps/api/src/modules/domain/services/ghost-organisation.service.ts`

Add invoice-based ghost discovery to `findGhostsByTenant` (extends the pattern from doc 48 phase 2 and doc 48b):

```typescript
const invoiceGhosts = this.db
  .selectDistinctOn([organizations.id], { /* same columns */ })
  .from(organizations)
  .innerJoin(
    invoices,
    and(
      eq(invoices.issuerOrganisationId, organizations.id),
      eq(invoices.custodianTenantId, params.tenantId),
    ),
  )
  .where(eq(organizations.subscriptionStatus, 'ghost'));
```

Add to the UNION in the combined query.

---

## Frontend

### CaptureInvoiceDrawer

**New file:** `apps/frontend/src/components/invoices/CaptureInvoiceDrawer.tsx`

Drawer/dialog for manually entering a vendor invoice:

- **Required fields:** Issuer Name, Purchase Order (select from existing POs)
- **Optional fields:** Issuer Email, Issuer ABN, Invoice Number, Issue Date, Comments, Sub Total, Tax, Total Amount
- **Line items section:** Simple table for entering line-item detail (stored in JSONB payload)
- **Submit action:** calls `POST /invoices/capture`
- **Success:** navigates to the created Bill detail page

### Invoice/Bill status workflow actions

**Invoice detail view** (vendor-side):
- `draft` → "Submit Invoice" button
- Status indicator showing buyer's response (approved/declined/paid via cross-tenant event)

**Bill detail view** (buyer-side):
- `received` → "Review", "Approve", "Decline" buttons
- `under_review` → "Approve", "Decline", "Dispute" buttons
- `approved` → "Mark Paid" button
- `disputed` → "Review Again", "Decline" buttons

---

## Cross-Tenant Flow Summary

### On-platform vendor submits invoice

1. Vendor creates invoice against their PO (or WO)
2. Vendor calls `POST /invoices/:id/submit`
3. Workflow `advance('submit')` fires:
   - `syncStatusLookup` — sets invoice status to Submitted
   - `issueDocument` — calls `createBillFromInvoice`, creates bill in buyer tenant with `sourceTenantId`, `sourceOrganisationId`
   - `publishCrossTenantEvent` — enqueues `invoice.submit` event
4. Buyer sees new bill in their bills list

### Buyer processes the bill

1. Buyer reviews and approves: `POST /bills/:id/approve`
2. Workflow `advance('approve')` fires `publishCrossTenantEvent`
3. `InvoiceEventHandler` receives event, projects vendor's invoice to `approved`
4. Buyer pays: `POST /bills/:id/pay`
5. Event propagates → vendor's invoice moves to `paid`

### Off-platform vendor (manual capture)

1. Buyer receives physical/email invoice from off-platform vendor
2. Buyer calls `POST /invoices/capture` with vendor details
3. System creates ghost org, custodial invoice, and bill in one transaction
4. Buyer processes the bill normally
5. If vendor later subscribes → custody transfer moves invoice to vendor's tenant

---

## Testing Strategy

- **Issuance:** Vendor submits invoice with on-platform buyer → verify bill created in buyer tenant with `sourceTenantId`, `sourceOrganisationId`, status = Received.
- **Manual capture:** Call `POST /invoices/capture` → verify invoice + bill created, ghost org resolved.
- **Custody transfer:** Subscribe ghost → verify invoice transferred, bill `sourceTenantId` updated.
- **Cross-tenant status sync:** Buyer approves bill → verify vendor invoice status updated to Approved. Buyer pays → verify vendor invoice status = Paid.
- **Workflow:** Verify all invoice and bill transitions fire `syncStatusLookup` and cross-tenant events.
- **PO linkage:** Verify bill's `purchaseOrderId` resolves to buyer's PO (not vendor's).

---

## File Impact Summary

| Category | Files |
|----------|-------|
| **Migration** | `0052_invoice_bill_cross_tenant.sql` |
| **Schema** | `schema/index.ts` (invoices + bills tables) |
| **New files** | `invoice.workflows.ts`, `bill.workflows.ts`, `invoice-event.handler.ts`, `bill-event.handler.ts`, `CaptureInvoiceDrawer.tsx` |
| **Modified (backend)** | `document-issuance.service.ts`, `invoices.service.ts`, `invoices.controller.ts`, `bills.service.ts`, `bills.controller.ts`, `manual-capture.service.ts`, `custody-transfer.service.ts`, `ghost-organisation.service.ts`, `workflow.module.ts`, `sync-status-lookup.hook.ts`, `pubsub.module.ts` |
| **Modified (frontend)** | Invoice detail component (status actions), Bill detail component (status actions) |
| **New endpoints** | `POST /invoices/capture`, `POST /invoices/:id/submit`, `POST /bills/:id/review`, `POST /bills/:id/approve`, `POST /bills/:id/decline`, `POST /bills/:id/dispute`, `POST /bills/:id/pay` |
