# 35d — Document Issuance: Lifecycle, Versioning & Visibility

**Parent:** [35 — Domain Layer Architecture](./35_DOMAIN_LAYER_ARCHITECTURE.md)
**Phase:** 3

---

## 0. Purpose

Document issuance is the central business operation in EnsureOS. When a user "sends" or "issues" a document, it crosses a tenant boundary — creating the recipient's perspective of that document. This sub-document covers:

1. The issuance lifecycle (draft → issued → received)
2. Document versioning (reissue creates new version)
3. Line item snapshotting (copy to recipient's tables)
4. Association visibility and copy-on-issue
5. Item lineage (WO items → PO items provenance)

---

## 1. Document Pairs (Dual Perspective)

| Creator Creates | Gate Action | Recipient Receives | Creator's Table | Recipient's Table |
|---|---|---|---|---|
| Purchase Order | Issue | Work Order | `purchase_orders` | `work_orders` |
| Quote / Estimate | Send | Proposal | `quotes` | `proposals` |
| Invoice | Issue | Bill | `invoices` | `bills` |
| RFQ | Send | (Inbound RFQ) | `rfqs` | *(vendor sees RFQ directly)* |

Each pair shares a lineage but lives in separate tables with independent lifecycles and entity-specific columns.

---

## 2. Issuance Lifecycle

```
Creator:   Draft → [internal approval] → Approved → ISSUE → Issued → (amendments) → v2 Draft → v2 Issued
                                                       │
                                                       ▼
Recipient:                                          Received → Accepted → In Progress → Complete
```

### States

**Creator-side states:**
- `draft` — Being composed, not visible to recipient
- `approved` — Passed internal approval (optional step, workflow-driven)
- `issued` — Sent to recipient; immutable until re-versioned

**Recipient-side states:**
- `received` — Document arrived, awaiting acknowledgement
- `accepted` — Recipient acknowledged and will act on it
- `in_progress` — Work underway (for WOs)
- `complete` — Work finished / document settled

These are tracked via `status_lookup_id` on each entity and driven by the workflow engine (see 35e).

---

## 3. Document Versioning

### Schema Addition

```sql
CREATE TABLE document_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES organizations(id),
  document_type   TEXT NOT NULL,      -- 'purchase_order', 'quote', 'invoice', 'rfq'
  document_id     UUID NOT NULL,      -- FK to the source document
  version_number  INTEGER NOT NULL,
  snapshot        JSONB NOT NULL,     -- Full entity state + line items at time of issue
  line_item_snapshot JSONB NOT NULL DEFAULT '[]',  -- Hierarchical line items
  issued_at       TIMESTAMPTZ NOT NULL,
  issued_by_user_id TEXT,
  superseded_at   TIMESTAMPTZ,       -- Set when next version is issued
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, document_type, document_id, version_number)
);

CREATE INDEX idx_doc_versions_doc ON document_versions(tenant_id, document_type, document_id);
```

### Column Additions to Recipient Entities

```sql
-- On work_orders, proposals, bills:
ALTER TABLE work_orders ADD COLUMN source_version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN latest_available_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE work_orders ADD COLUMN version_acknowledged BOOLEAN NOT NULL DEFAULT true;
```

When `latest_available_version > source_version_number` and `version_acknowledged = false`, the recipient has a pending update to review.

---

## 4. VersioningService

```typescript
// apps/api/src/modules/domain/services/versioning.service.ts

@Injectable()
export class VersioningService {
  /**
   * Create a version snapshot for a document about to be issued.
   * Freezes the current state of the entity + line items.
   */
  async createSnapshot(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    entitySnapshot: Record<string, unknown>;
    lineItemSnapshot: unknown[];
    issuedByUserId?: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ versionNumber: number }> {
    // 1. Find current max version for this document
    // 2. Supersede previous version (set superseded_at)
    // 3. Insert new version row with version_number = max + 1
    // 4. Return the new version number
  }

  /**
   * Get the latest version snapshot for a document.
   */
  async getLatestVersion(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentVersionRow | null> { /* ... */ }

  /**
   * Get version history for a document.
   */
  async getVersionHistory(params: {
    tenantId: string;
    documentType: string;
    documentId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<DocumentVersionRow[]> { /* ... */ }
}
```

---

## 5. DocumentIssuanceService

The core service that executes the "issue" action:

```typescript
// apps/api/src/modules/domain/services/document-issuance.service.ts

@Injectable()
export class DocumentIssuanceService {
  constructor(
    private readonly versioning: VersioningService,
    private readonly lineItemSync: LineItemSyncService,
    private readonly visibility: VisibilityService,
    private readonly outboundSync: OutboundSyncService,
  ) {}

  /**
   * Issue a document — creates version snapshot, copies to recipient,
   * and (optionally) enqueues for external system sync.
   */
  async execute(params: {
    tenantId: string;
    userId: string;
    documentType: 'purchase_order' | 'quote' | 'invoice' | 'rfq';
    documentId: string;
    recipientTenantId?: string;       // On-platform recipient
    recipientConnectionId?: string;    // External system recipient
    tx: DrizzleDbOrTx;
  }): Promise<IssuanceResult> {
    const { tenantId, documentType, documentId, tx } = params;

    // 1. Load the document + its line items
    const { entity, lineItems } = await this.loadDocumentWithItems(documentType, documentId, tx);

    // 2. Create version snapshot
    const { versionNumber } = await this.versioning.createSnapshot({
      tenantId,
      documentType,
      documentId,
      entitySnapshot: entity,
      lineItemSnapshot: lineItems,
      issuedByUserId: params.userId,
      tx,
    });

    // 3. If on-platform recipient: create/update recipient's entity
    let recipientEntityId: string | undefined;
    if (params.recipientTenantId) {
      recipientEntityId = await this.createRecipientEntity({
        sourceDocumentType: documentType,
        sourceDocumentId: documentId,
        sourceEntity: entity,
        sourceLineItems: lineItems,
        sourceTenantId: tenantId,
        recipientTenantId: params.recipientTenantId,
        versionNumber,
        tx,
      });

      // 4. Copy 'parties' visibility associations to recipient
      const recipientEntityType = this.getRecipientEntityType(documentType);
      await this.visibility.copyPartiesAssociations({
        sourceEntityType: documentType,
        sourceEntityId: documentId,
        targetEntityType: recipientEntityType,
        targetEntityId: recipientEntityId,
        targetTenantId: params.recipientTenantId,
        tx,
      });
    }

    // 5. If external recipient: enqueue for outbound sync
    let outboundQueueId: string | undefined;
    if (params.recipientConnectionId) {
      outboundQueueId = await this.outboundSync.enqueue({
        tenantId,
        connectionId: params.recipientConnectionId,
        entityType: documentType,
        entityId: documentId,
        action: 'issue',
        payload: { versionNumber, entity, lineItems },
        tx,
      });
    }

    return { versionNumber, recipientEntityId, outboundQueueId };
  }

  /**
   * Create the recipient's perspective entity.
   * PO → WO, Quote → Proposal, Invoice → Bill
   */
  private async createRecipientEntity(params: {
    sourceDocumentType: string;
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceLineItems: unknown[];
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const recipientType = this.getRecipientEntityType(params.sourceDocumentType);

    // Map source fields to recipient fields
    // (PO fields → WO fields, Quote fields → Proposal fields, etc.)
    const recipientData = this.mapToRecipientShape(params);

    // Add version tracking columns
    recipientData.sourceVersionNumber = params.versionNumber;
    recipientData.latestAvailableVersion = params.versionNumber;
    recipientData.versionAcknowledged = false;

    // Upsert recipient entity
    const recipientId = await this.upsertRecipientEntity(recipientType, recipientData, params.tx);

    // Copy line items into recipient's tables (snapshot)
    await this.snapshotLineItems({
      sourceType: params.sourceDocumentType,
      recipientType,
      recipientId,
      tenantId: params.recipientTenantId,
      lineItems: params.sourceLineItems,
      tx: params.tx,
    });

    return recipientId;
  }

  /**
   * Snapshot line items from source entity tables into recipient entity tables.
   * Groups, combos, and items are copied with structure preserved.
   */
  private async snapshotLineItems(params: {
    sourceType: string;
    recipientType: string;
    recipientId: string;
    tenantId: string;
    lineItems: unknown[];
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    // Uses LineItemSyncService with the recipient's repos
    // Items are copies — independent of source
  }

  private getRecipientEntityType(sourceType: string): string {
    const map: Record<string, string> = {
      purchase_order: 'work_order',
      quote: 'proposal',
      invoice: 'bill',
      rfq: 'rfq',  // RFQs may not have a distinct recipient type
    };
    return map[sourceType] ?? sourceType;
  }

  private mapToRecipientShape(params: {
    sourceDocumentType: string;
    sourceEntity: Record<string, unknown>;
    sourceTenantId: string;
    recipientTenantId: string;
  }): Record<string, unknown> {
    // Transform PO fields → WO fields:
    // po_to → wo_from (sender becomes "from" in recipient's view)
    // po_from → wo_to (creator becomes "to" in recipient's view)
    // etc.
    // This is entity-pair-specific mapping logic
    return {};
  }
}
```

---

## 6. Reissue Flow

When a creator revises and reissues:

1. Creator edits the PO (now back in "draft" for new version)
2. Creator triggers "reissue" (workflow transition: `draft → issued`)
3. `DocumentIssuanceService.execute()` runs again:
   - Creates version N+1 snapshot
   - Updates recipient's WO: sets `latest_available_version = N+1`, `version_acknowledged = false`
   - Copies updated line items to recipient's tables (replacing previous version's items)
4. Recipient sees "New version available" indicator
5. Recipient acknowledges → `version_acknowledged = true`, `source_version_number = N+1`

---

## 7. Item Lineage (WO → PO Allocation)

When a contractor creates a PO from Work Order items:

### Schema Addition

```sql
CREATE TABLE item_allocations (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   UUID NOT NULL REFERENCES organizations(id),
  source_work_order_item_id   UUID NOT NULL REFERENCES work_order_items(id) ON DELETE CASCADE,
  target_purchase_order_item_id UUID NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
  allocated_quantity           NUMERIC(14, 4),
  allocated_amount             NUMERIC(14, 2),
  allocation_type              TEXT NOT NULL DEFAULT 'full',
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_allocation_type CHECK (allocation_type IN ('full', 'partial', 'split'))
);

CREATE INDEX idx_item_alloc_source ON item_allocations(tenant_id, source_work_order_item_id);
CREATE INDEX idx_item_alloc_target ON item_allocations(tenant_id, target_purchase_order_item_id);
```

### UX Flow

1. Contractor views Work Order items
2. Selects items to outsource → "Create Purchase Order from selected"
3. System copies selected items into new PO's line item tables
4. Creates `item_allocations` rows linking WO items ↔ PO items
5. PO items can be edited independently (different quantities, descriptions for subcontractor)
6. Lineage preserved for audit and coverage tracking

---

## 8. Visibility & Copy-on-Issue

### Association Visibility Levels

| Level | Description | Copied on issue? |
|---|---|---|
| `private` | Only the creating user sees it | No |
| `org` | All users in the tenant see it | No |
| `parties` | Both immediate parties see it | Yes — copied to recipient as `org` |

### Schema Changes

Add to all association/join tables:

```sql
ALTER TABLE claim_contacts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'org'
  CHECK (visibility IN ('private', 'org', 'parties'));
ALTER TABLE claim_contacts ADD COLUMN created_by_user_id TEXT;

ALTER TABLE job_contacts ADD COLUMN visibility TEXT NOT NULL DEFAULT 'org';
ALTER TABLE job_contacts ADD COLUMN created_by_user_id TEXT;

ALTER TABLE tasks ADD COLUMN visibility TEXT NOT NULL DEFAULT 'org';
-- tasks already has created_by_user_id

ALTER TABLE messages ADD COLUMN visibility TEXT NOT NULL DEFAULT 'org';
-- messages already has created_by_user_id

ALTER TABLE attachments ADD COLUMN visibility TEXT NOT NULL DEFAULT 'org';
-- attachments already has created_by_user_id
```

### Copy Behaviour on Issue

When `DocumentIssuanceService` creates the recipient's entity:

1. Query all associations on the source entity WHERE `visibility = 'parties'`
2. For each association, create a copy on the recipient's entity with:
   - `visibility = 'org'` (visible in recipient's org, won't propagate further)
   - `tenant_id = recipientTenantId`
   - All other fields preserved (contact details, sort_index, etc.)

This ensures the recipient sees shared contacts/tasks without needing cross-tenant queries.

---

## 9. Summary: What Happens on "Issue PO"

Complete sequence when a contractor clicks "Issue Purchase Order":

```
1. WorkflowEngine validates transition: approved → issued
2. WorkflowEngine fires onEnter hook → IssueDocumentUseCase.execute()
3. IssueDocumentUseCase:
   a. Load PO + its groups/combos/items
   b. VersioningService.createSnapshot() → version N
   c. If recipient on-platform:
      i.   Map PO fields → WO fields (perspective swap)
      ii.  Create/update WO row in recipient tenant
      iii. Copy PO line items → WO line item tables (snapshot)
      iv.  Copy 'parties' associations → recipient (contacts, tasks)
      v.   Set WO.source_version_number = N
   d. If recipient off-platform:
      i.   OutboundSyncService.enqueue('purchase_order', poId, 'issue')
   e. If WO items originated from upstream WO:
      i.   ItemLineageService — allocations already tracked from creation
4. WorkflowEngine updates PO status to 'issued'
5. TX commits
```
