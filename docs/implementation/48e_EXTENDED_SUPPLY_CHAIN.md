# 48e — Extended Supply Chain Features

**Series:** 48 (Cross-Tenant Supply Chain Completion)  
**Review reference:** `docs/reviews/cross-tenant-supply-chain-review.md` items #11, #12, #13  
**Depends on:** 48d (full pipeline operational)  
**Status:** Planned

---

## Overview

With the core supply chain pipeline operational (RFQ → Job → Estimate → Proposal → PO → WO → Invoice → Bill), this document covers three extension features that enhance the platform's supply chain capabilities:

1. **Cross-tenant version sync UI** — when an issuer revises a document, the receiver sees the update and can pull the latest version.
2. **Recursive sub-contracting depth tracking** — tracks and limits how deep the supply chain extends (prime → sub → sub-sub).
3. **Competitive bid comparison** — compare multiple proposals for a single RFQ side-by-side and select a winner.

---

## Feature 1 — Cross-Tenant Version Sync UI

### Problem

Version tracking fields (`sourceVersionNumber`, `latestAvailableVersion`, `versionAcknowledged`) already exist on receiver-side entities (bills, work orders, proposals). However, there is no UI for:
- Indicating that a newer version is available from the issuer
- Pulling the latest version to update the receiver-side entity

### Version badge component

**New file:** `apps/frontend/src/components/shared/VersionSyncBadge.tsx`

A reusable component that renders on any receiver-side entity detail page:

```typescript
interface VersionSyncBadgeProps {
  sourceVersionNumber: number;
  latestAvailableVersion: number;
  versionAcknowledged: boolean;
  entityType: 'proposal' | 'work_order' | 'bill' | 'job';
  entityId: string;
  onPullVersion: () => void;
}
```

**Display states:**
- **Up to date:** `sourceVersionNumber === latestAvailableVersion && versionAcknowledged` → green badge: "Version {n} — Current"
- **Update available:** `latestAvailableVersion > sourceVersionNumber` → amber badge: "Version {latestAvailableVersion} available" with "Pull Latest" button
- **Unacknowledged:** `!versionAcknowledged` → blue badge: "Updated to version {sourceVersionNumber} — Review changes"

### "Pull Latest" API endpoint

**New endpoint on each receiver-side entity:**

```
POST /{entity}/:id/pull-version
```

Where `{entity}` is `proposals`, `work-orders`, `bills`, or `jobs`.

### Backend — Version pull service

**New file:** `apps/api/src/modules/domain/services/version-sync.service.ts`

```typescript
@Injectable()
export class VersionSyncService {
  async pullLatestVersion(params: {
    entityType: string;
    entityId: string;
    tenantId: string;
    userId: string;
  }): Promise<{ previousVersion: number; newVersion: number }> {
    return this.db.transaction(async (tx) => {
      // 1. Load the receiver entity to get source reference
      const entity = await this.loadEntity(params.entityType, params.entityId, tx);

      // 2. Load the source document from the issuer's tenant
      //    (cross-tenant read — permitted in shared-database multi-tenancy)
      const source = await this.loadSourceDocument(entity, tx);

      // 3. Update receiver entity fields from source
      await this.updateFromSource({
        entityType: params.entityType,
        entity,
        source,
        tx,
      });

      // 4. Copy line items if applicable
      //    (proposals, work orders have line-item hierarchies)
      if (['proposal', 'work_order'].includes(params.entityType)) {
        await this.refreshLineItems({
          entityType: params.entityType,
          entityId: params.entityId,
          sourceId: this.getSourceId(entity),
          tenantId: params.tenantId,
          tx,
        });
      }

      // 5. Update version tracking
      const previousVersion = entity.sourceVersionNumber;
      const newVersion = entity.latestAvailableVersion;

      await this.updateVersionFields({
        entityType: params.entityType,
        entityId: params.entityId,
        sourceVersionNumber: newVersion,
        versionAcknowledged: true,
        tx,
      });

      return { previousVersion, newVersion };
    });
  }

  private async refreshLineItems(params: {
    entityType: string;
    entityId: string;
    sourceId: string;
    tenantId: string;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // Delete existing line items on the receiver
    // Re-copy from source using LineItemCopyService
    // Use the appropriate config (QUOTE_TO_PROPOSAL_CONFIG, etc.)
  }
}
```

### Version notification via pub/sub

When an issuer revises a document (e.g., vendor updates an invoice), the `publishCrossTenantEvent` hook enqueues a version-update event. The receiver-side handler updates `latestAvailableVersion` and sets `versionAcknowledged = false`:

**Enhancement to event handlers (per entity):**

```typescript
case 'invoice.update':
  if (event.payload.versionNumber) {
    await tx
      .update(bills)
      .set({
        latestAvailableVersion: event.payload.versionNumber,
        versionAcknowledged: false,
      })
      .where(eq(bills.invoiceId, event.entityId));
  }
  break;
```

### Entities with version sync

| Receiver entity | Source entity | Source FK | Has line items to refresh |
|----------------|-------------|----------|--------------------------|
| Proposal | Quote | `proposals.sourceQuoteId` (via `sourceTenantId`) | Yes (quote → proposal copy) |
| Work Order | Purchase Order | `workOrders.sourcePurchaseOrderId` | Yes (PO/quote → WO copy) |
| Bill | Invoice | `bills.invoiceId` | No (flat JSONB payload copy) |
| Job | RFQ | `jobs.sourceRfqId` | No (scope in apiPayload JSON) |

### Controller endpoints

**File:** `apps/api/src/modules/proposals/proposals.controller.ts`

```typescript
@Post(':id/pull-version')
async pullVersion(@Param('id') id: string, @Request() req) {
  return this.versionSyncService.pullLatestVersion({
    entityType: 'proposal',
    entityId: id,
    tenantId: req.user.tenantId,
    userId: req.user.id,
  });
}
```

Repeat for `work-orders`, `bills`, and `jobs` controllers.

---

## Feature 2 — Recursive Sub-Contracting Depth Tracking

### Problem

When a vendor (tier-1 sub-contractor) receives a job and issues their own RFQ to a tier-2 sub-contractor, the system has no visibility into the depth of the supply chain. There is no mechanism to:
- Track how many sub-contracting levels deep a document is
- Limit recursive sub-contracting to prevent infinite chains
- Display the supply chain depth to users

### Schema migration

**File:** `apps/api/src/database/migrations-drizzle/0053_supply_chain_depth.sql`

```sql
ALTER TABLE rfqs
  ADD COLUMN supply_chain_depth INTEGER NOT NULL DEFAULT 0;

ALTER TABLE purchase_orders
  ADD COLUMN supply_chain_depth INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN rfqs.supply_chain_depth IS
  'How many sub-contracting levels deep this RFQ is. 0 = originated from a direct claim/job.';

COMMENT ON COLUMN purchase_orders.supply_chain_depth IS
  'How many sub-contracting levels deep this PO is. 0 = first-tier PO.';
```

**Schema update:** `apps/api/src/database/schema/index.ts`

Add to `rfqs`:

```typescript
supplyChainDepth: integer('supply_chain_depth').notNull().default(0),
```

Add to `purchaseOrders`:

```typescript
supplyChainDepth: integer('supply_chain_depth').notNull().default(0),
```

### Depth propagation

When a vendor creates an RFQ from a job that was sourced from an upstream RFQ:

```
Upstream RFQ (depth=0) → Job (sourceRfqId) → Vendor creates sub-RFQ (depth=1)
```

**In `RfqsService.create`:**

```typescript
async create({ body }) {
  // ... existing logic ...

  let supplyChainDepth = 0;

  // If this RFQ is being created from a job that originated from an upstream RFQ,
  // inherit and increment the depth
  if (body.jobId) {
    const [job] = await this.db
      .select({ sourceRfqId: jobs.sourceRfqId })
      .from(jobs)
      .where(eq(jobs.id, body.jobId));

    if (job?.sourceRfqId) {
      const [sourceRfq] = await this.db
        .select({ supplyChainDepth: rfqs.supplyChainDepth })
        .from(rfqs)
        .where(eq(rfqs.id, job.sourceRfqId));

      supplyChainDepth = (sourceRfq?.supplyChainDepth ?? 0) + 1;
    }
  }

  // ... insert with supplyChainDepth ...
}
```

Similarly for POs created from accepted proposals — inherit depth from the RFQ that originated the proposal chain.

### Max depth guard

**New guard:** `apps/api/src/modules/domain/workflows/guards/check-max-depth.guard.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { WorkflowGuard, WorkflowContext } from '../workflow.interface';
import { rfqs, purchaseOrders, organizations } from '../../../../database/schema';

const DEFAULT_MAX_DEPTH = 5;

@Injectable()
export class CheckMaxDepthGuard implements WorkflowGuard {
  name = 'checkMaxDepth';
  private readonly logger = new Logger('CheckMaxDepthGuard');

  async evaluate(context: WorkflowContext): Promise<boolean> {
    const tx = context.tx;

    // Determine current depth
    let currentDepth = 0;
    if (context.entityType === 'rfq') {
      const [rfq] = await tx
        .select({ supplyChainDepth: rfqs.supplyChainDepth })
        .from(rfqs)
        .where(eq(rfqs.id, context.entityId));
      currentDepth = rfq?.supplyChainDepth ?? 0;
    } else if (context.entityType === 'purchase_order') {
      const [po] = await tx
        .select({ supplyChainDepth: purchaseOrders.supplyChainDepth })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, context.entityId));
      currentDepth = po?.supplyChainDepth ?? 0;
    }

    // Load tenant config for max depth
    const [org] = await tx
      .select()
      .from(organizations)
      .where(eq(organizations.id, context.tenantId));

    const tenantConfig = (org?.settings as Record<string, unknown>) ?? {};
    const maxDepth = (tenantConfig.maxSupplyChainDepth as number) ?? DEFAULT_MAX_DEPTH;

    if (currentDepth >= maxDepth) {
      this.logger.warn(
        `CheckMaxDepthGuard — blocked issuance of ${context.entityType} ${context.entityId}: depth ${currentDepth} >= max ${maxDepth}`,
      );
      return false;
    }

    return true;
  }
}
```

**Registration:** Add `checkMaxDepth` guard to the `send` transition of `rfqStandard` and the `issue` transition of `purchaseOrderStandard`:

```typescript
{ to: 'sent', action: 'send', guards: ['hasLineItems', 'checkMaxDepth'], onEnter: [...] }
{ to: 'issued', action: 'issue', guards: ['checkMaxDepth'], onEnter: [...] }
```

### Frontend — depth indicator

**New component:** `apps/frontend/src/components/shared/SupplyChainDepthBadge.tsx`

Displays on RFQ and PO detail views:

- **Depth 0:** "Direct" (primary colour)
- **Depth 1:** "Tier 1 Sub" (normal styling)
- **Depth 2+:** "Tier {depth} Sub" (warning colour)
- **Near max:** "Tier {depth} Sub — {remaining} levels remaining" (warning)
- **At max:** "Maximum sub-contracting depth reached" (error colour, issuance blocked)

### Tenant configuration

Add `maxSupplyChainDepth` to tenant settings (stored in `organizations.settings` JSONB):

```typescript
interface TenantSettings {
  maxSupplyChainDepth?: number;  // default: 5
  // ... other settings
}
```

Configurable via an admin settings page or API endpoint:

```
PATCH /organisations/settings
{ "maxSupplyChainDepth": 3 }
```

---

## Feature 3 — Competitive Bid Comparison

### Problem

When a buyer sends an RFQ to multiple vendors, each responds with a proposal. Today, proposals can reference an RFQ via `proposals.rfqId`, but there is no UI to:
- Compare multiple proposals side-by-side
- Align proposal line items back to the original RFQ scope items
- Select a winning proposal (and automatically decline the rest)

### Data model

The schema already supports this:
- `proposals.rfqId` — links proposal to its originating RFQ
- `proposalItems.sourceRfqItemId` — links each proposal line item back to the RFQ item it responds to
- `proposalCombos.sourceRfqComboId` — same for combos
- `proposalGroups.sourceRfqGroupId` — same for groups

No schema changes are needed for this feature.

### Backend — Bid comparison service

**New file:** `apps/api/src/modules/domain/services/bid-comparison.service.ts`

```typescript
@Injectable()
export class BidComparisonService {
  /**
   * Returns a comparison matrix aligning proposals by RFQ scope items.
   */
  async compareProposalsForRfq(params: {
    rfqId: string;
    tenantId: string;
  }): Promise<BidComparisonResult> {
    // 1. Load the RFQ and its scope items
    const rfqItems = await this.loadRfqScope(params.rfqId, params.tenantId);

    // 2. Load all proposals for this RFQ
    const proposals = await this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.rfqId, params.rfqId),
          eq(proposals.tenantId, params.tenantId),
        ),
      );

    // 3. For each proposal, load line items and align to RFQ scope
    const proposalData = await Promise.all(
      proposals.map(async (p) => {
        const items = await this.loadProposalItems(p.id);
        return {
          proposal: p,
          items,
          totals: this.calculateTotals(items),
        };
      }),
    );

    // 4. Build comparison matrix
    return this.buildComparisonMatrix(rfqItems, proposalData);
  }

  /**
   * Accepts one proposal and declines all others for the RFQ.
   */
  async selectWinner(params: {
    rfqId: string;
    proposalId: string;
    tenantId: string;
    userId: string;
  }): Promise<{ accepted: string; declined: string[] }> {
    const allProposals = await this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.rfqId, params.rfqId),
          eq(proposals.tenantId, params.tenantId),
        ),
      );

    const declined: string[] = [];

    for (const proposal of allProposals) {
      if (proposal.id === params.proposalId) {
        // Accept the winner
        await this.workflowEngine.advance({
          tenantId: params.tenantId,
          entityType: 'proposal',
          entityId: proposal.id,
          workflowName: 'standard',
          action: 'accept',
          currentStep: proposal.currentStep,
          userId: params.userId,
        });
      } else {
        // Decline the rest
        await this.workflowEngine.advance({
          tenantId: params.tenantId,
          entityType: 'proposal',
          entityId: proposal.id,
          workflowName: 'standard',
          action: 'decline',
          currentStep: proposal.currentStep,
          userId: params.userId,
        });
        declined.push(proposal.id);
      }
    }

    return { accepted: params.proposalId, declined };
  }
}

interface BidComparisonResult {
  rfq: {
    id: string;
    rfqNumber: string;
    name: string;
  };
  proposals: Array<{
    id: string;
    proposalNumber: string;
    vendorName: string;
    totalAmount: number;
    submittedAt: string;
  }>;
  comparisonMatrix: Array<{
    rfqItem: {
      id: string;
      name: string;
      description: string;
      quantity: number;
      group: string;
    };
    bids: Array<{
      proposalId: string;
      proposalItemId: string | null;
      unitCost: number | null;
      totalCost: number | null;
      deltaPercent: number | null;
    }>;
  }>;
  summary: {
    lowestTotal: { proposalId: string; amount: number };
    highestTotal: { proposalId: string; amount: number };
    averageTotal: number;
    perGroupSummary: Array<{
      groupName: string;
      proposals: Array<{ proposalId: string; groupTotal: number }>;
    }>;
  };
}
```

### Controller endpoints

**File:** `apps/api/src/modules/rfqs/rfqs.controller.ts`

```typescript
@Get(':id/compare-bids')
async compareBids(@Param('id') id: string) {
  return this.bidComparisonService.compareProposalsForRfq({
    rfqId: id,
    tenantId: req.user.tenantId,
  });
}

@Post(':id/select-winner')
async selectWinner(
  @Param('id') id: string,
  @Body() body: { proposalId: string },
  @Request() req,
) {
  return this.bidComparisonService.selectWinner({
    rfqId: id,
    proposalId: body.proposalId,
    tenantId: req.user.tenantId,
    userId: req.user.id,
  });
}
```

### Frontend — comparison view

**New file:** `apps/frontend/src/components/rfqs/BidComparisonTable.tsx`

Accessed from the RFQ detail page when multiple proposals exist for the RFQ.

**Layout:**
- **Header row:** RFQ item columns (name, description, quantity) + one column per proposal (vendor name, total)
- **Body rows:** one row per RFQ scope item, showing each proposal's response (unit cost, total cost, delta from average)
- **Footer row:** Grand totals per proposal, with percentage differences
- **Colour coding:** lowest bid per item highlighted in green, highest in amber
- **"Select Winner" button:** on each proposal column header, triggers `selectWinner` action with confirmation dialog

**Interaction:**
- Click a proposal column to expand its detail (notes, terms, delivery dates)
- Sort by total, by group total, or by individual item cost
- Filter to show only items where bids diverge significantly (> 20% spread)

### Group-level summary

**New component:** `apps/frontend/src/components/rfqs/BidComparisonGroupSummary.tsx`

Accordion panels, one per RFQ scope group, showing:
- Group name and description
- Per-proposal group total
- Per-proposal group delta from average
- Expand to see item-level comparison within the group

---

## Testing Strategy

### Version sync

- Vendor updates an invoice. Verify bill's `latestAvailableVersion` incremented and `versionAcknowledged = false`.
- Buyer clicks "Pull Latest" on bill. Verify `sourceVersionNumber` updated, `versionAcknowledged = true`, payload refreshed.
- Vendor revises a quote. Verify proposal's `latestAvailableVersion` incremented. Buyer pulls → proposal line items refreshed.

### Depth tracking

- Create a direct RFQ (depth=0) → issue → vendor receives job → vendor creates sub-RFQ → verify depth=1.
- Chain to tier-2 → verify depth=2.
- Set `maxSupplyChainDepth = 2` on tenant. Attempt to issue RFQ at depth=2 → verify guard blocks issuance.

### Bid comparison

- Send RFQ to 3 vendors. Each responds with a proposal (different pricing).
- Call `GET /rfqs/:id/compare-bids` → verify comparison matrix aligns items by `sourceRfqItemId`.
- Call `POST /rfqs/:id/select-winner` → verify winner accepted, others declined.
- Verify `createPurchaseOrder` hook fires from the accepted proposal.

---

## File Impact Summary

| Category | Files |
|----------|-------|
| **Migration** | `0053_supply_chain_depth.sql` |
| **Schema** | `schema/index.ts` (rfqs + purchaseOrders depth columns) |
| **New files (backend)** | `version-sync.service.ts`, `bid-comparison.service.ts`, `check-max-depth.guard.ts` |
| **New files (frontend)** | `VersionSyncBadge.tsx`, `SupplyChainDepthBadge.tsx`, `BidComparisonTable.tsx`, `BidComparisonGroupSummary.tsx` |
| **Modified (backend)** | `rfqs.service.ts` (depth propagation), `rfqs.controller.ts` (comparison endpoints, pull-version), `proposals.controller.ts` (pull-version), `work-orders.controller.ts` (pull-version), `bills.controller.ts` (pull-version), `rfq.workflows.ts` (depth guard), `purchase-order.workflows.ts` (depth guard), `workflow.module.ts` (register guard) |
| **Modified (frontend)** | Proposal detail (version badge), WO detail (version badge), Bill detail (version badge), Job detail (version badge), RFQ detail (comparison tab, depth badge), PO detail (depth badge) |
| **New endpoints** | `POST /proposals/:id/pull-version`, `POST /work-orders/:id/pull-version`, `POST /bills/:id/pull-version`, `POST /jobs/:id/pull-version`, `GET /rfqs/:id/compare-bids`, `POST /rfqs/:id/select-winner` |
