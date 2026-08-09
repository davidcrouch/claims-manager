# 48 — Cross-Tenant Infrastructure Foundation

**Series:** 48 (Cross-Tenant Supply Chain Completion)  
**Review reference:** `docs/reviews/cross-tenant-supply-chain-review.md` items #1, #5, #7, #9  
**Depends on:** None (foundation for 48a–48e)  
**Status:** Planned

---

## Overview

This document addresses four foundational issues that must be resolved before the remaining cross-tenant document pairs (RFQ/Job, Invoice/Bill) and chain reactions can be completed:

1. **Lookup domain naming inconsistency** — PO and WO statuses use different domain names in different contexts, causing duplicate lookups and silent data corruption.
2. **Ghost organisation visibility gap** — `findGhostsByTenant` only finds ghosts via purchase orders, missing ghosts created through manual estimate capture.
3. **Duplicated line-item copy logic** — 5+ functions (80–160 lines each) of near-identical nested-loop copy code across services.
4. **Workflow engine is never invoked** — definitions, guards, and hooks (including cross-tenant pub/sub) are fully built but `advance()` has zero callers, so cross-tenant status propagation does not function.

---

## Phase 1 — Lookup Domain Standardisation

### Problem

The same entity uses different lookup domain strings in different code paths:

| Entity | Frontend (archive/list) | Backend (CW mapper) | Other |
|--------|------------------------|---------------------|-------|
| Purchase Order | `po_status` | `purchase_order_status` | `work_order_status` (PO transformer — **bug**) |
| Work Order | `wo_status` (archive), `work_order_status` (list) | `work_order_status` | `wo_status` (QuotesService WO creation) |

`DashboardService` loads **both** `work_order_status` and `wo_status` to paper over the split. Lookup resolution with `autoCreate: true` silently creates duplicate domain entries with different lookup IDs for the same logical status.

### Changes

#### 1.1 — Canonical domain constant

Create `apps/api/src/modules/domain/constants/lookup-domains.ts`:

```typescript
export const LOOKUP_DOMAINS = {
  CLAIM_STATUS: 'claim_status',
  JOB_STATUS: 'job_status',
  QUOTE_STATUS: 'quote_status',
  PROPOSAL_STATUS: 'proposal_status',
  PURCHASE_ORDER_STATUS: 'purchase_order_status',
  WORK_ORDER_STATUS: 'work_order_status',
  INVOICE_STATUS: 'invoice_status',
  BILL_STATUS: 'bill_status',
  RFQ_STATUS: 'rfq_status',
} as const;

export type LookupDomain = (typeof LOOKUP_DOMAINS)[keyof typeof LOOKUP_DOMAINS];
```

All domain string references must use this constant instead of inline strings.

#### 1.2 — Data migration (0049)

Migration `0049_lookup_domain_standardisation.sql`:

```sql
-- Merge po_status → purchase_order_status
-- For each po_status value, find or create a matching purchase_order_status row,
-- then update all entities referencing the po_status lookup ID.

WITH po_lookups AS (
  SELECT id, tenant_id, name, external_reference
  FROM lookup_values
  WHERE domain = 'po_status'
),
target_lookups AS (
  INSERT INTO lookup_values (tenant_id, domain, name, external_reference)
  SELECT p.tenant_id, 'purchase_order_status', p.name, p.external_reference
  FROM po_lookups p
  WHERE NOT EXISTS (
    SELECT 1 FROM lookup_values t
    WHERE t.tenant_id = p.tenant_id
      AND t.domain = 'purchase_order_status'
      AND t.external_reference = p.external_reference
  )
  RETURNING id, tenant_id, external_reference
),
id_map AS (
  SELECT p.id AS old_id, COALESCE(t.id, e.id) AS new_id
  FROM po_lookups p
  LEFT JOIN target_lookups t
    ON t.tenant_id = p.tenant_id AND t.external_reference = p.external_reference
  LEFT JOIN lookup_values e
    ON e.tenant_id = p.tenant_id AND e.domain = 'purchase_order_status'
    AND e.external_reference = p.external_reference
)
UPDATE purchase_orders po
SET status_lookup_id = m.new_id
FROM id_map m
WHERE po.status_lookup_id = m.old_id;

DELETE FROM lookup_values WHERE domain = 'po_status';

-- Repeat for wo_status → work_order_status (same pattern)
-- [analogous SQL omitted for brevity — same structure, targeting work_orders table]
```

**Rollback:** Reverse migration recreates `po_status` and `wo_status` domains from `purchase_order_status` / `work_order_status` rows and re-maps FKs. Non-destructive since all data is preserved under the canonical domain.

#### 1.3 — Fix PO transformer bug

**File:** `apps/api/src/modules/domain/transformers/purchase-order.transformer.ts`

Line 56 currently declares `domain: 'work_order_status'` for PO status lookup resolution. Change to:

```typescript
domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS
```

#### 1.4 — Update all consumers

| File | Change |
|------|--------|
| `apps/frontend/src/app/(app)/mutations-archive.ts` | `purchase_order: 'purchase_order_status'`, `work_order: 'work_order_status'` |
| `apps/frontend/src/app/(app)/purchase-orders/page.tsx` | `getLookupsByDomain('purchase_order_status')` |
| `apps/frontend/src/app/(app)/work-orders/page.tsx` | Already `'work_order_status'` — no change |
| `apps/api/src/modules/quotes/quotes.service.ts` | `resolveWoStatus` → use `LOOKUP_DOMAINS.WORK_ORDER_STATUS` |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | Remove duplicate `wo_status` domain load (line 220); keep only `work_order_status` |
| `apps/api/src/modules/domain/services/manual-capture.service.ts` | Already uses `work_order_status` — import constant |
| `apps/api/src/modules/domain/services/document-issuance.service.ts` | `proposal_status` reference → import constant |
| `apps/api/src/database/seeds/entries/sample-data.seed.ts` | Consolidate `po_status` + `purchase_order_status` → single `purchase_order_status` block; consolidate `wo_status` + `work_order_status` → single `work_order_status` block |
| `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` | Already `purchase_order_status` — import constant |

All inline domain strings across the codebase should be replaced with `LOOKUP_DOMAINS.*` imports. Run a codebase-wide search for the deprecated strings `'po_status'` and `'wo_status'` after migration to confirm zero remaining references.

---

## Phase 2 — Ghost Organisation Cleanup

### 2.1 — Fix `findGhostsByTenant` to include quote-based ghosts

**File:** `apps/api/src/modules/domain/services/ghost-organisation.service.ts`  
**Method:** `findGhostsByTenant` (lines 233–260)

**Problem:** Currently only JOINs on `purchase_orders.issuerOrganisationId`. Ghost orgs created via manual estimate capture (`captureEstimate` → ghost issuer on `quotes.issuerOrganisationId`) are invisible.

**Fix:** UNION the PO-based query with a quotes-based query:

```typescript
async findGhostsByTenant(params: {
  tenantId: string;
}): Promise<GhostOrganisation[]> {
  const poGhosts = this.db
    .selectDistinctOn([organizations.id], { /* same columns */ })
    .from(organizations)
    .innerJoin(
      purchaseOrders,
      and(
        eq(purchaseOrders.issuerOrganisationId, organizations.id),
        eq(purchaseOrders.custodianTenantId, params.tenantId),
      ),
    )
    .where(eq(organizations.subscriptionStatus, 'ghost'));

  const quoteGhosts = this.db
    .selectDistinctOn([organizations.id], { /* same columns */ })
    .from(organizations)
    .innerJoin(
      quotes,
      and(
        eq(quotes.issuerOrganisationId, organizations.id),
        eq(quotes.custodianTenantId, params.tenantId),
      ),
    )
    .where(eq(organizations.subscriptionStatus, 'ghost'));

  const [poRows, quoteRows] = await Promise.all([poGhosts, quoteGhosts]);

  // Deduplicate by org ID
  const seen = new Set<string>();
  const result: GhostOrganisation[] = [];
  for (const row of [...poRows, ...quoteRows]) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      result.push(row);
    }
  }
  return result;
}
```

Future extension: when Invoice and RFQ cross-tenant fields are added (docs 48b, 48c), add those tables to the UNION as well.

### 2.2 — Ghost org auth-layer status

**Problem:** Ghost orgs have `status: 'active'` (auth-layer field) alongside `subscriptionStatus: 'ghost'`. Auth queries filtering on `organizations.status = 'active'` inadvertently include ghosts.

**Changes:**

1. In `GhostOrganisationService.resolveOrCreate`, set `status: 'inactive'` (not `'active'`) when creating ghost rows.

2. In `apps/api/src/database/seeds/entries/sample-data.seed.ts`, ensure any ghost seed rows use `status: 'inactive'`.

3. In `CustodyTransferService.transferCustodialPurchaseOrders` and `transferCustodialQuotes`, when updating the ghost org to `subscriptionStatus: 'verified'`, also set `status: 'active'`.

4. Add application-layer validation in `GhostOrganisationService.resolveOrCreate`:
   ```typescript
   if (org.subscriptionStatus === 'ghost' && org.status === 'active') {
     this.logger.warn(`Ghost org ${org.id} has status='active' — correcting`);
     await tx.update(organizations)
       .set({ status: 'inactive' })
       .where(eq(organizations.id, org.id));
   }
   ```

---

## Phase 3 — Shared Line-Item Copy Utility

### Problem

The following functions contain near-identical nested-loop copy logic:

| Function | File | Lines | Purpose |
|----------|------|-------|---------|
| `copyQuoteLineItemsToProposal` | `document-issuance.service.ts` | ~80 | Quote → Proposal (strips margin fields, filters internal items) |
| `copyLineItemsToWorkOrder` | `quotes.service.ts` | ~160 | Quote → Work Order (all fields) |
| `transferCustodialQuotes` (line-item section) | `custody-transfer.service.ts` | ~40 | Updates `tenantId` on quote groups/combos/items |

Each function independently iterates groups → combos → items, inserts into target tables, and maintains ID mappings. Adding a field to the line-item model requires changes across all of them.

### New service: `LineItemCopyService`

**File:** `apps/api/src/modules/domain/services/line-item-copy.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export type FieldMap = Record<string, string | ((row: Record<string, unknown>) => unknown)>;

export interface CopyConfig {
  sourceGroupTable: PgTable;
  sourceComboTable: PgTable;
  sourceItemTable: PgTable;
  targetGroupTable: PgTable;
  targetComboTable: PgTable;
  targetItemTable: PgTable;
  sourceParentFk: string;        // column on source groups, e.g. 'quoteId'
  targetParentFk: string;        // column on target groups, e.g. 'proposalId'
  sourceGroupFkOnCombo: string;  // column on source combos, e.g. 'quoteGroupId'
  targetGroupFkOnCombo: string;  // column on target combos, e.g. 'proposalGroupId'
  sourceGroupFkOnItem: string;   // column on source items (group parent), e.g. 'quoteGroupId'
  targetGroupFkOnItem: string;   // column on target items (group parent), e.g. 'proposalGroupId'
  sourceComboFkOnItem: string;   // column on source items (combo parent), e.g. 'quoteComboId'
  targetComboFkOnItem: string;   // column on target items (combo parent), e.g. 'proposalComboId'
  groupFieldMap: FieldMap;
  comboFieldMap: FieldMap;
  itemFieldMap: FieldMap;
  itemFilter?: (item: Record<string, unknown>) => boolean;
}

export interface CopyResult {
  groups: number;
  combos: number;
  items: number;
  groupIdMap: Map<string, string>;
  comboIdMap: Map<string, string>;
}

@Injectable()
export class LineItemCopyService {
  private readonly logger = new Logger('LineItemCopyService');

  async copyHierarchy(params: {
    sourceParentId: string;
    targetParentId: string;
    targetTenantId: string;
    config: CopyConfig;
    tx: DrizzleDbOrTx;
  }): Promise<CopyResult> {
    // 1. Load source groups
    // 2. For each group: map fields via groupFieldMap, insert into target, record ID mapping
    // 3. Load source combos for all groups
    // 4. For each combo: map fields via comboFieldMap, insert into target using mapped group ID
    // 5. Load source items (group-level and combo-level)
    // 6. For each item: apply itemFilter, map fields via itemFieldMap, insert using mapped IDs
    // 7. Return counts and ID maps
  }
}
```

### Pre-defined copy configs

**File:** `apps/api/src/modules/domain/services/line-item-copy.configs.ts`

```typescript
import {
  quoteGroups, quoteCombos, quoteItems,
  proposalGroups, proposalCombos, proposalItems,
  workOrderGroups, workOrderCombos, workOrderItems,
  rfqGroups, rfqCombos, rfqItems,
} from '../../../database/schema';
import type { CopyConfig } from './line-item-copy.service';

export const QUOTE_TO_PROPOSAL_CONFIG: CopyConfig = {
  sourceGroupTable: quoteGroups,
  sourceComboTable: quoteCombos,
  sourceItemTable: quoteItems,
  targetGroupTable: proposalGroups,
  targetComboTable: proposalCombos,
  targetItemTable: proposalItems,
  sourceParentFk: 'quoteId',
  targetParentFk: 'proposalId',
  sourceGroupFkOnCombo: 'quoteGroupId',
  targetGroupFkOnCombo: 'proposalGroupId',
  sourceGroupFkOnItem: 'quoteGroupId',
  targetGroupFkOnItem: 'proposalGroupId',
  sourceComboFkOnItem: 'quoteComboId',
  targetComboFkOnItem: 'proposalComboId',
  groupFieldMap: {
    groupLabelLookupId: 'groupLabelLookupId',
    description: 'description',
    dimensions: 'dimensions',
    sortIndex: 'sortIndex',
    totals: 'totals',
  },
  comboFieldMap: {
    name: 'name',
    description: 'description',
    category: 'category',
    subCategory: 'subCategory',
    quantity: 'quantity',
    sortIndex: 'sortIndex',
    totals: 'totals',
    comboPayload: 'comboPayload',
  },
  itemFieldMap: {
    unitTypeLookupId: 'unitTypeLookupId',
    name: 'name',
    description: 'description',
    category: 'category',
    subCategory: 'subCategory',
    itemType: 'itemType',
    quantity: 'quantity',
    tax: 'tax',
    unitCost: 'unitCost',
    sortIndex: 'sortIndex',
    note: 'note',
    totals: 'totals',
    // buyCost, markupType, markupValue, allocatedCost, committedCost intentionally excluded
  },
  itemFilter: (item) => item.internal !== true,
};

export const QUOTE_TO_WORK_ORDER_CONFIG: CopyConfig = {
  sourceGroupTable: quoteGroups,
  sourceComboTable: quoteCombos,
  sourceItemTable: quoteItems,
  targetGroupTable: workOrderGroups,
  targetComboTable: workOrderCombos,
  targetItemTable: workOrderItems,
  sourceParentFk: 'quoteId',
  targetParentFk: 'workOrderId',
  sourceGroupFkOnCombo: 'quoteGroupId',
  targetGroupFkOnCombo: 'workOrderGroupId',
  sourceGroupFkOnItem: 'quoteGroupId',
  targetGroupFkOnItem: 'workOrderGroupId',
  sourceComboFkOnItem: 'quoteComboId',
  targetComboFkOnItem: 'workOrderComboId',
  groupFieldMap: {
    groupLabelLookupId: 'groupLabelLookupId',
    description: 'description',
    dimensions: 'dimensions',
    sortIndex: 'sortIndex',
    totals: 'totals',
  },
  comboFieldMap: {
    catalogComboId: 'catalogComboId',
    name: 'name',
    description: 'description',
    category: 'category',
    subCategory: 'subCategory',
    quantity: 'quantity',
    sortIndex: 'sortIndex',
    totals: 'totals',
    comboPayload: 'comboPayload',
  },
  itemFieldMap: {
    catalogItemId: 'catalogItemId',
    unitTypeLookupId: 'unitTypeLookupId',
    name: 'name',
    description: 'description',
    category: 'category',
    subCategory: 'subCategory',
    itemType: 'itemType',
    quantity: 'quantity',
    tax: 'tax',
    unitCost: 'unitCost',
    buyCost: 'buyCost',
    markupType: 'markupType',
    markupValue: 'markupValue',
    sortIndex: 'sortIndex',
    note: 'note',
    tags: 'tags',
    totals: 'totals',
  },
};
```

### Refactor existing callers

1. **`DocumentIssuanceService.copyQuoteLineItemsToProposal`** → Replace body with:
   ```typescript
   await this.lineItemCopy.copyHierarchy({
     sourceParentId: params.sourceDocumentId,
     targetParentId: params.proposalId,
     targetTenantId: params.recipientTenantId,
     config: QUOTE_TO_PROPOSAL_CONFIG,
     tx: params.tx,
   });
   ```
   Remove the private `mapQuoteItemToProposalItem` method.

2. **`QuotesService.copyLineItemsToWorkOrder`** → Replace body with delegation to `LineItemCopyService` using `QUOTE_TO_WORK_ORDER_CONFIG`.

3. **`CustodyTransferService.transferCustodialQuotes`** line-item section → Extract into a `updateTenantOnHierarchy` method on `LineItemCopyService` that updates `tenantId` on all child rows for a given parent.

### Registration

Add `LineItemCopyService` to `DomainModule` providers and exports. Inject into `DocumentIssuanceService`, `QuotesService`, and `CustodyTransferService`.

---

## Phase 4 — Workflow Engine Integration

### Problem

`WorkflowEngineService.advance()` has zero callers in application code. All supply-chain services set `statusLookupId` imperatively via lookup resolution. The workflow definitions — including `publishCrossTenantEvent`, `issueDocument`, and guard hooks — never execute.

This means:
- Cross-tenant status propagation does not function
- Workflow guards (`hasLineItems`, `hasRecipient`) are not enforced
- The `entity_workflow_state` table is never populated
- `maybeIssueCrossTenantProposal` in `QuotesService` duplicates what the `issueDocument` hook would do

### Sub-phase 4a — Bridge workflow steps to lookup status

**Problem:** `advance()` persists to `entity_workflow_state` but does not update the entity's `statusLookupId`. Services and UI read status from `statusLookupId`, not from `entity_workflow_state`.

**Solution:** New hook `SyncStatusLookupHook` that fires on every transition and updates the entity row's `statusLookupId` to match the target workflow step.

**File:** `apps/api/src/modules/domain/workflows/hooks/sync-status-lookup.hook.ts`

```typescript
import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../../database/drizzle.module';
import {
  quotes, proposals, purchaseOrders, workOrders,
  invoices, bills, rfqs, jobs,
} from '../../../../database/schema';
import { LookupResolutionService } from '../../services/lookup-resolution.service';
import { LOOKUP_DOMAINS } from '../../constants/lookup-domains';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

const STEP_TO_LOOKUP: Record<string, Record<string, { domain: string; name: string }>> = {
  quote: {
    draft:     { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Draft' },
    approved:  { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Approved' },
    published: { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Pending' },
  },
  proposal: {
    received:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Received' },
    under_review: { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Under Review' },
    accepted:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Accepted' },
    declined:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Declined' },
  },
  purchase_order: {
    draft:            { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Draft' },
    pending_approval: { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Pending Approval' },
    approved:         { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Approved' },
    issued:           { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Issued' },
    acknowledged:     { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Acknowledged' },
    closed:           { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Closed' },
  },
  work_order: {
    received:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Received' },
    accepted:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Accepted' },
    scheduled:   { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Scheduled' },
    in_progress: { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'In Progress' },
    completed:   { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Completed' },
    declined:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Declined' },
  },
  job: {
    received:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Received' },
    accepted:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Accepted' },
    in_progress:        { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'In Progress' },
    on_hold:            { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'On Hold' },
    pending_completion: { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Pending Completion' },
    completed:          { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Completed' },
    declined:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Declined' },
  },
};

const ENTITY_TABLE_MAP: Record<string, any> = {
  quote: quotes,
  proposal: proposals,
  purchase_order: purchaseOrders,
  work_order: workOrders,
  invoice: invoices,
  bill: bills,
  rfq: rfqs,
  job: jobs,
};

@Injectable()
export class SyncStatusLookupHook implements OnEnterHook {
  name = 'syncStatusLookup';
  private readonly logger = new Logger('SyncStatusLookupHook');

  constructor(
    private readonly lookupResolution: LookupResolutionService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async execute(context: WorkflowContext): Promise<void> {
    const mapping = STEP_TO_LOOKUP[context.entityType]?.[context.targetStep];
    if (!mapping) {
      this.logger.debug(
        `SyncStatusLookupHook.execute — no mapping for ${context.entityType}:${context.targetStep}`,
      );
      return;
    }

    const lookupId = await this.lookupResolution.resolve({
      tenantId: context.tenantId,
      domain: mapping.domain,
      externalReference: mapping.name,
      name: mapping.name,
      autoCreate: true,
      tx: context.tx,
    });

    if (!lookupId) {
      this.logger.warn(
        `SyncStatusLookupHook.execute — failed to resolve lookup for ${mapping.domain}:${mapping.name}`,
      );
      return;
    }

    const table = ENTITY_TABLE_MAP[context.entityType];
    if (!table) return;

    await context.tx
      .update(table)
      .set({ statusLookupId: lookupId, updatedAt: new Date() })
      .where(eq(table.id, context.entityId));
  }
}
```

**Registration:** Add `SyncStatusLookupHook` to `WorkflowModule` providers and register in `onModuleInit`:

```typescript
this.engine.registerHook(this.syncStatusLookupHook);
```

**Workflow definitions update:** Add `'syncStatusLookup'` to the `onEnter` array of **every** transition in all workflow definitions. This ensures `statusLookupId` stays synchronised with `entity_workflow_state.currentStep` on every transition.

Example for `quoteStandard`:

```typescript
export const quoteStandard: WorkflowDefinition = {
  entity: 'quote',
  name: 'standard',
  initialStep: 'draft',
  steps: [
    {
      id: 'draft',
      transitions: [
        { to: 'approved', action: 'approve', guards: ['hasLineItems'],
          onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'approved',
      transitions: [
        { to: 'published', action: 'publish',
          onEnter: ['syncStatusLookup', 'issueDocument', 'publishCrossTenantEvent'] },
      ],
    },
    { id: 'published', isFinal: true, transitions: [] },
  ],
};
```

Apply the same pattern to `proposalStandard`, `purchaseOrderStandard`, `workOrderStandard`, and `jobStandard`.

### Sub-phase 4b — Make `persistStep` public and initialize workflow state at entity creation

**File:** `apps/api/src/modules/domain/workflows/workflow-engine.service.ts`

Change `private async persistStep` → `async initializeState` (public, with a clearer name for external callers):

```typescript
async initializeState(params: {
  tenantId: string;
  entityType: string;
  entityId: string;
  workflowName: string;
  initialStep: string;
  userId: string;
  tx: DrizzleDbOrTx;
}): Promise<void> {
  await this.persistStep({
    tenantId: params.tenantId,
    entityType: params.entityType,
    entityId: params.entityId,
    workflowName: params.workflowName,
    step: params.initialStep,
    userId: params.userId,
    tx: params.tx,
  });
}
```

### Sub-phase 4c — Migrate services to use `advance()`

Each supply-chain service must:
1. Inject `WorkflowEngineService`
2. Call `initializeState` at entity creation
3. Replace imperative `statusLookupId` setting with `advance()`
4. Let `SyncStatusLookupHook` handle the lookup update

#### QuotesService

| Current method | Current behaviour | New behaviour |
|---------------|-------------------|---------------|
| `create` | Resolves Draft lookup, sets `statusLookupId` | After `quotesRepo.create`, call `workflowEngine.initializeState({ entityType: 'quote', initialStep: 'draft', ... })`. `SyncStatusLookupHook` sets the lookup. |
| `approve` | Resolves Approved lookup, sets `statusLookupId`, creates WO | Call `advance({ action: 'approve', currentStep: 'draft' })`. Keep WO creation (not a workflow concern). Remove manual lookup resolution. |
| `publish` (internal) | Resolves Pending lookup, sets `statusLookupId`, calls `maybeIssueCrossTenantProposal` | Call `advance({ action: 'publish', currentStep: 'approved' })`. The `issueDocument` hook replaces `maybeIssueCrossTenantProposal`. Remove that private method. |
| `publish` (external/CW) | CW API call, then sets Pending lookup | CW API call first, then `advance({ action: 'publish', currentStep: 'approved' })`. If CW call fails, `advance` is never called — status stays Approved. |
| `update` (status passthrough) | Sets arbitrary `statusLookupId` | Keep for CW webhook projection path. Add `workflowEngine.project()` call (see 4d). |

#### ProposalsService

| Current method | New behaviour |
|---------------|---------------|
| (created via DocumentIssuanceService) | After proposal creation, call `initializeState({ entityType: 'proposal', initialStep: 'received' })` |
| `accept` | `advance({ action: 'accept' })`. Triggers `publishCrossTenantEvent`. Remove manual lookup resolution. |
| `decline` | `advance({ action: 'decline' })`. Triggers `publishCrossTenantEvent`. Remove manual lookup resolution. |
| (new) `review` | `advance({ action: 'review' })` for `received → under_review`. Add controller endpoint `POST /proposals/:id/review`. |

#### PurchaseOrdersService

Currently has no lifecycle methods — only passthrough create/update. Add:

| New method | Workflow action | Triggers |
|-----------|----------------|----------|
| `submit` | `submit` (draft → pending_approval) | `syncStatusLookup` |
| `approve` | `approve` (pending_approval → approved) | `syncStatusLookup` |
| `issue` | `issue` (approved → issued) | `syncStatusLookup`, `issueDocument` (creates WO), `publishCrossTenantEvent` |
| `acknowledge` | `acknowledge` (issued → acknowledged) | `syncStatusLookup`, `publishCrossTenantEvent` |
| `close` | `close` (acknowledged → closed) | `syncStatusLookup`, `publishCrossTenantEvent` |
| `revise` | `revise` (issued/acknowledged → draft) | `syncStatusLookup` |

Add corresponding controller endpoints: `POST /purchase-orders/:id/{submit,approve,issue,acknowledge,close,revise}`.

#### WorkOrdersService

Currently has no lifecycle methods. Add:

| New method | Workflow action | Triggers |
|-----------|----------------|----------|
| `accept` | `accept` (received → accepted) | `syncStatusLookup`, `publishCrossTenantEvent` |
| `decline` | `decline` (received/accepted → declined) | `syncStatusLookup`, `publishCrossTenantEvent` |
| `schedule` | `schedule` (accepted → scheduled) | `syncStatusLookup` |
| `start` | `start` (accepted/scheduled → in_progress) | `syncStatusLookup` |
| `complete` | `complete` (in_progress → completed) | `syncStatusLookup`, `publishCrossTenantEvent` |
| `pause` | `pause` (in_progress → accepted) | `syncStatusLookup` |

Add corresponding controller endpoints.

### Sub-phase 4d — Crunchwork projection bypass

Inbound webhook projections (via transformers/mappers) set status from the external system, which is authoritative. These must bypass guards and hooks.

**New method on `WorkflowEngineService`:**

```typescript
async project(params: {
  entityType: string;
  entityId: string;
  tenantId: string;
  workflowName: string;
  targetStep: string;
  userId: string;
  tx: DrizzleDbOrTx;
}): Promise<void> {
  await this.persistStep({
    tenantId: params.tenantId,
    entityType: params.entityType,
    entityId: params.entityId,
    workflowName: params.workflowName,
    step: params.targetStep,
    userId: params.userId,
    tx: params.tx,
  });

  this.logger.log(
    `WorkflowEngine.project — ${params.entityType}:${params.entityId} projected to step '${params.targetStep}'`,
  );
}
```

Transformers/mappers should call `project()` after setting `statusLookupId` from CW payload, to keep `entity_workflow_state` in sync. This requires a CW status → workflow step mapping per entity type (the inverse of `STEP_TO_LOOKUP`).

---

## Testing Strategy

### Phase 1 (Lookup domains)

- Verify migration: after running, zero rows exist with `domain IN ('po_status', 'wo_status')`.
- Verify all entity queries return correct status after FK remapping.
- Frontend smoke test: archive/unarchive PO and WO.

### Phase 2 (Ghost org)

- Create a ghost via manual estimate capture. Verify `findGhostsByTenant` returns it.
- Verify ghost rows have `status: 'inactive'`.
- Verify custody transfer sets `status: 'active'`.

### Phase 3 (Copy utility)

- Publish an estimate with a recipient org → verify proposal line items match (same assertion as current test but using new code path).
- Approve an internal estimate → verify WO line items match.
- Compare line-item counts before/after refactor — must be identical.

### Phase 4 (Workflow engine)

- Create a quote → verify `entity_workflow_state` row exists with `currentStep = 'draft'`.
- Approve → verify step advances to `'approved'` and `statusLookupId` updated.
- Publish with on-platform recipient → verify proposal created in recipient tenant (via `issueDocument` hook).
- Accept a proposal → verify `publishCrossTenantEvent` enqueues event.
- Verify CW projection: inbound webhook sets status without triggering hooks.

---

## File Impact Summary

| Category | Files |
|----------|-------|
| **New files** | `lookup-domains.ts`, `line-item-copy.service.ts`, `line-item-copy.configs.ts`, `sync-status-lookup.hook.ts` |
| **Migration** | `0049_lookup_domain_standardisation.sql` |
| **Modified (backend)** | `workflow-engine.service.ts`, `workflow.module.ts`, all 5 workflow definitions, `document-issuance.service.ts`, `quotes.service.ts`, `proposals.service.ts`, `purchase-orders.service.ts`, `work-orders.service.ts`, `custody-transfer.service.ts`, `ghost-organisation.service.ts`, `manual-capture.service.ts`, `dashboard.service.ts`, `purchase-order.transformer.ts`, `sample-data.seed.ts` |
| **Modified (frontend)** | `mutations-archive.ts`, `purchase-orders/page.tsx` |
| **Controllers** | `purchase-orders.controller.ts` (6 new endpoints), `work-orders.controller.ts` (6 new endpoints), `proposals.controller.ts` (1 new endpoint) |
