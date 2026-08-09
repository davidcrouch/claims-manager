# Cross-Tenant Supply Chain Implementation Review

**Date:** 2026-08-09  
**Scope:** Implementation plans 40–44 and their realisation across API services, database schema, workflows, and frontend  
**Goal:** Assess implementation state, design quality, and recommend improvements for the cross-tenant vendor/customer supply chain

---

## Table of Contents

1. [Business Context](#1-business-context)
2. [Implementation Completeness](#2-implementation-completeness)
3. [What Works Well](#3-what-works-well)
4. [Design Flaws](#4-design-flaws)
5. [Recommended Design](#5-recommended-design)
6. [Summary of Recommendations](#6-summary-of-recommendations)

---

## 1. Business Context

The application manages insurance claims (automated via Crunchwork) and private jobs (manual entry). The supply chain flows as:

```
Insurer (Customer)
  └─ Crunchwork automated ──► Prime Contractor (User)
                                  ├─ If vendor is also a user → automated cross-tenant
                                  └─ If vendor is off-platform → manual capture + PDF/email
```

Each participant is simultaneously a **buyer** (upstream) and a **vendor** (downstream). The system models this with four document pairs, where issuing one side automatically creates the corresponding receiver document:

| Buyer issues | Vendor receives | Flow direction |
|-------------|----------------|----------------|
| RFQ | Job | ► Request work |
| — | Estimate (Quote) → Proposal | ◄ Respond with pricing |
| PO | Work Order | ► Authorise work |
| — | Invoice → Bill | ◄ Request payment |

For off-platform counterparties, the system uses **ghost organisations** (placeholder identity records) and **manual capture** (user enters the external document, creating a custodial pair). When a ghost org later subscribes, **custody transfer** moves the issuer-side records to their new tenant.

---

## 2. Implementation Completeness

### 2.1 Gap Matrix

| Capability | PO/WO | Estimate/Proposal | Invoice/Bill | RFQ/Job |
|-----------|-------|-------------------|-------------|---------|
| Schema org/custody fields | Done | Done | Partial | Not done |
| Document issuance (auto create receiver copy) | Done | Done (with line items + privacy filter) | Header only (no line items) | **Broken** — maps `rfq→rfq` instead of `rfq→job` |
| Manual capture endpoint | Done | Done | Not done | Not done |
| Ghost org resolution | Done | Done | — | — |
| Custody transfer | Done | Done (incl. line items) | Not done | Not done |
| Line-item copy on issuance | Full hierarchy | Full hierarchy, strips internal/margin fields | N/A (flat payload) | N/A |
| Cross-tenant event publishing | Infrastructure exists but **not wired** | Infrastructure exists but **not wired** | Infrastructure exists but **not wired** | Not done |
| Workflow engine integration | Defined but **never called** | Defined but **never called** | No definition | No definition |
| Proposal accept → PO creation | Not implemented | Not implemented | — | — |
| Frontend capture UI | Done (CapturePoDrawer) | Done (CaptureEstimateDrawer) | Not done | Not done |
| Version tracking | Schema fields present, versioning service works | Schema fields present, versioning service works | Schema fields present | Not done |

### 2.2 Critical Gaps

**A. Workflow engine is dead code.** Workflow definitions exist for all supply-chain entities (quote, proposal, PO, WO, job) with cross-tenant pub/sub hooks wired to transitions. However, `WorkflowEngineService.advance()` is never called anywhere in the codebase. All services implement lifecycle transitions imperatively by setting lookup status values directly. This means:

- `PublishCrossTenantEventHook` never fires
- Cross-tenant status propagation (e.g. "vendor accepted your WO") doesn't happen
- Workflow guards (e.g. `hasLineItems`, `hasRecipient`) are not enforced
- The `entity_workflow_state` table is never populated

**B. Proposal accept/decline does not trigger downstream actions.** `ProposalsService.accept()` sets a lookup status to "Accepted" and returns. Per doc 44, acceptance should trigger creation of a PO for the vendor — this chain reaction is not implemented. Similarly, no cross-tenant event notifies the vendor that their estimate was accepted or declined.

**C. RFQ→Job issuance is broken.** `RECIPIENT_TYPE_MAP` maps `rfq: 'rfq'` instead of `rfq: 'job'`. The `loadDocumentWithItems` method has no case for `'rfq'` and would throw. `createRecipientEntity` has no `createJobFromRfq` method.

**D. Invoice/Bill manual capture and cross-tenant org fields are missing.** `createBillFromInvoice` copies header fields only; no `sourceTenantId`, `sourceOrganisationId`, or manual capture endpoint exists.

---

## 3. What Works Well

**A. Ghost organisation resolution is solid.** The `GhostOrganisationService` implements a well-ordered resolution cascade (ABN → primary email → legal name + email domain → create new) with proper idempotency and active-tenant rejection.

**B. Manual capture is transactionally correct.** Both PO and Estimate capture create the issuer + receiver document pair atomically within a single DB transaction, with proper duplicate detection using `UNIQUE(issuerOrganisationId, purchaseOrderNumber)`.

**C. Custody transfer is thorough.** PO transfer moves `tenantId`, clears `custodianTenantId`, updates `ownershipStatus`, logs the transfer, and updates the linked WO's `sourceTenantId`. Quote transfer additionally migrates all child line items (groups, combos, items) and updates linked proposals — correctly handling the hierarchical data.

**D. Line-item privacy filtering on estimate→proposal issuance.** The `DocumentIssuanceService.copyQuoteLineItemsToProposal` correctly excludes `internal = true` items and strips margin-sensitive fields (`buyCost`, `markupType`, `markupValue`, `allocatedCost`, `committedCost`).

**E. The document pair pattern is consistent and well-documented.** Doc 41 establishes a repeatable contract (issuer org fields, receiver source fields, version tracking, custody semantics) that docs 42–44 follow uniformly. The implementation of PO/WO and Estimate/Proposal faithfully follows this contract.

**F. Perspective swap is correctly implemented.** PO→WO swaps `poTo`↔`poFrom` into `woFrom`↔`woTo` (the buyer's "to" becomes the vendor's "from"). Quote→Proposal swaps `quoteFrom`→`proposalFrom` and `quoteTo`→`proposalTo`.

---

## 4. Design Flaws

### 4.1 Cross-Tenant Foreign Keys — Appropriate for This Architecture

**Observation:** `proposals.quote_id → quotes.id` and `work_orders.purchase_order_id → purchase_orders.id` are hard FKs that cross tenant boundaries.

**Assessment: This is the correct design for a shared-database multi-tenant architecture.** The proposal IS the buyer-side view of the vendor's quote — the FK captures this intrinsic relationship. It provides:

- **Referential integrity:** No orphaned proposals pointing to non-existent quotes.
- **Version tracking:** The proposal can look up its source quote to check for new versions.
- **Idempotency:** `findByQuote` prevents duplicate proposals per quote.
- **Custody transfer correctness:** When a ghost subscribes and custody transfers move the quote to their new tenant, the FK still points correctly — the quote row changed tenants but kept its ID.

The soft-delete pattern already in use (`deletedAt`) adequately handles the deletion coupling concern. Query leakage is prevented by repository-level `tenantId` filtering, which is appropriate for a shared-database model.

**This would only become a problem** if per-tenant database isolation were required in the future, which is not a current requirement. No change recommended.

### 4.2 Ghost Organisations — Sound Pattern, Minor Schema Hygiene

**Assessment: The ghost org pattern is a well-designed vendor onboarding strategy.** Ghost orgs are not identity placeholders — they are **pre-allocated tenants** whose data is accumulated custodially with the expectation that vendors will subscribe over time. When they do, custody transfer moves their historical documents into their now-active tenant, and the vendor logs in to find their data already there.

This works because ghosts live in the same `organizations` table as real tenants. The ghost→tenant lifecycle (`ghost → claimed → verified → active`) is a simple status transition on the same row — no cross-table migration, no FK re-pointing, no data movement. The fields that are "meaningless" on a ghost (`config`, `provisioningStatus`, filesystem templates) are **not yet populated** — they get filled during onboarding.

**Remaining minor issue:** The dual-status pattern (`status: 'active'` from auth-layer vs `subscriptionStatus: 'ghost'`) is confusing. Auth-layer queries on `organizations.status = 'active'` inadvertently include ghosts unless they also filter by `subscriptionStatus`. Consider unifying into a single lifecycle enum or ensuring the auth-layer `status` is set to a non-`active` value for ghost rows.

**Impact:** Low. The design is correct for the intended use case.

### 4.3 Vendor Entity Not Linked to Organisation

**Problem:** The `vendors` table is strictly per-tenant with no FK to `organizations`. When a vendor is also a platform subscriber (subscribed org), there is no schema-level link. Cross-tenant issuance relies on `recipientOrganisationId` being manually set on the document, not derived from the vendor relationship.

**Impact:** Medium-High.

- No way to answer "which of my vendors are also platform users?" without ad-hoc name/ABN matching.
- RFQ fan-out to on-platform vendors requires manual org ID entry rather than automatic resolution from the vendor record.
- When a ghost org subscribes, existing vendor records referencing that org identity are not automatically linked.
- Duplicate vendor entries across tenants for the same real-world company cannot be reconciled.

### 4.4 Dual Status Systems (Lookups vs Workflow Engine)

**Problem:** Business entity statuses are managed through two parallel, disconnected systems:

1. **Lookup-based status** (`statusLookupId → lookup_values`): Tenant-scoped, string-matched, used by all services and UI today.
2. **Workflow engine** (`entity_workflow_state`, `WorkflowDefinition`): Defines transitions with guards and hooks (including cross-tenant event publishing). Fully built. Never called.

Services like `ProposalsService.accept()` directly set `statusLookupId` without invoking the workflow engine. The cross-tenant pub/sub hooks attached to workflow transitions therefore never fire.

**Impact:** High. The intended cross-tenant status propagation — a core feature of the supply chain — does not function. The workflow engine represents significant engineering effort that delivers zero value in its current state.

### 4.5 Lookup Domain Naming Inconsistency

**Problem:** The same entity uses different lookup domain names in different contexts:

| Context | PO domain | WO domain |
|---------|-----------|-----------|
| Archive UI action | `po_status` | `wo_status` |
| Crunchwork mapper | `purchase_order_status` | `work_order_status` |
| Manual capture | — | `work_order_status` |
| List pages | Mixed | Mixed |

**Impact:** Medium. Lookup resolution silently creates duplicate domains with different values. A PO could have its status set to a `po_status` lookup by the UI and a `purchase_order_status` lookup by the mapper, each with different IDs for the same logical state.

### 4.6 Synchronous Cross-Tenant Writes

**Problem:** `DocumentIssuanceService.execute()` creates receiver-tenant records within the same database transaction as the issuer's operation. The `outbound_sync_queue` and pub/sub infrastructure exist but are used only for post-hoc notifications, not for the actual issuance.

**Impact:** Medium.

- A failure in receiver-side record creation rolls back the issuer's entire transaction (e.g., publishing an estimate fails if proposal creation hits a constraint error in the receiver tenant).
- No retry/replay capability for cross-tenant operations.
- Works adequately for a single-database deployment but does not support per-tenant database isolation.

### 4.7 Parallel Table Hierarchies — Deliberate Privacy Boundaries with Maintenance Cost

**Assessment:** Each document type has its own full table hierarchy (5 document types × 3 levels = 15+ tables). This is a **deliberate design choice for schema-enforced data privacy**, not accidental duplication:

- `quote_items` have `buyCost`, `markupType`, `markupValue`, `allocatedCost`, `committedCost` — vendor margin data that must never reach the buyer
- `proposal_items` physically cannot hold those columns — the schema makes data leakage impossible regardless of application bugs
- `rfq_items` represent requested scope without pricing — structurally different from quote items

The privacy filtering in `copyQuoteLineItemsToProposal` (excluding `internal` items, omitting margin fields) works precisely because the destination table's schema enforces the boundary.

**Remaining issue:** The copy logic between these tables (5+ functions, ~80–160 lines each) is a real maintenance burden. Adding a field to the line-item model touches 5+ tables and 5+ copy functions.

**Recommendation:** Keep separate per-document-type item tables for schema-enforced privacy. Reduce maintenance burden by extracting the common copy mechanics into a shared utility with an explicit field inclusion/exclusion list per document-type pair, rather than writing bespoke nested loops for each issuance path.

**Impact:** Medium — the schema design is right; the copy-logic implementation can be DRYer.

### 4.8 Missing Chain Reactions

**Problem:** The supply chain is a sequence of automated reactions (accepting a proposal triggers PO creation, issuing a PO creates a WO, etc.). Most of these chain reactions are not implemented:

| Trigger | Expected reaction | Status |
|---------|-------------------|--------|
| Proposal accepted | Create PO for vendor | Not implemented |
| PO issued | Create WO in vendor tenant | Implemented |
| WO completed | Allow invoice creation | No enforcement |
| Invoice issued | Create bill in buyer tenant | Header only |
| Estimate published | Create proposal in buyer tenant | Implemented |

The supply chain is essentially two isolated steps (estimate→proposal, PO→WO) rather than a connected pipeline.

---

## 5. Recommended Design

These recommendations assume greenfield — no migration constraints.

### 5.1 Event-Driven Cross-Tenant Communication

Replace synchronous cross-tenant writes with an event-driven pattern:

```
Issuer Tenant                    Event Bus                    Receiver Tenant
─────────────                    ─────────                    ───────────────
publish(estimate)
  ├─ set status = published
  ├─ create version snapshot
  └─ emit EstimatePublished ─────► queue ──────────────────► handleEstimatePublished()
                                                               ├─ create proposal
                                                               ├─ copy line items
                                                               └─ emit ProposalCreated ──► (notify issuer)
```

For a single-database deployment, this can use a transactional outbox pattern with an in-process dispatcher (effectively synchronous with retry capability). The architecture remains the same if you later need separate databases or external message queues.

**Benefits:**
- Issuer transaction succeeds or fails independently of receiver-side processing.
- Built-in retry and dead-letter handling for failed cross-tenant operations.
- Audit trail of all cross-tenant events for free.
- Decouples issuer and receiver code — each side only knows about its own documents.
- The chain reactions (proposal accepted → create PO → create WO) become event handlers, not nested service calls.

### 5.2 Single Workflow Engine for Status Management

Eliminate the lookup-based status system for supply-chain entities. Use the workflow engine exclusively:

```typescript
// One system, one way to change status:
await workflowEngine.advance({
  entityType: 'proposal',
  entityId: proposalId,
  action: 'accept',
  tenantId,
  userId,
});
// Guards validate preconditions
// Status transitions atomically
// onEnter hooks fire (cross-tenant events, document generation, chain reactions)
```

The workflow engine already defines the right transitions and hooks. The fix is to remove the imperative status-setting code in services and call `advance()` instead.

For Crunchwork-sourced statuses (inbound webhook projections), the workflow engine should support a `project` action that maps external status strings to workflow steps without enforcing transition guards (since the external system is authoritative).

**Benefits:**
- Cross-tenant events fire automatically on every relevant transition.
- Guards prevent invalid transitions (e.g. accepting a proposal that hasn't been reviewed).
- Chain reactions are defined declaratively in workflow definitions, not scattered across services.
- Single source of truth for "what status is this entity in?"

### 5.3 Link Vendors to Organisations

```sql
ALTER TABLE vendors ADD COLUMN organisation_id UUID REFERENCES organizations(id);
```

When creating a vendor record, resolve or create the corresponding organisation (ghost or active). When issuing documents cross-tenant, look up the vendor's organisation to determine whether they are an active tenant. This replaces the current pattern of manually setting `recipientOrganisationId` on each document.

```typescript
async issueRfqToVendor(rfqId: string, vendorId: string) {
  const vendor = await vendors.findOne(vendorId);
  const org = await organizations.findOne(vendor.organisationId);
  
  if (org.subscriptionStatus === 'active') {
    // Automated: create job in vendor's tenant
    await documentIssuance.execute({ ... recipientTenantId: org.id });
  } else {
    // Manual: generate PDF, send email
    await documentGeneration.generate({ type: 'rfq', id: rfqId });
  }
}
```

This also answers "which of my vendors are on the platform?" — a simple filter on `vendors JOIN organizations WHERE subscriptionStatus = 'active'`.

### 5.4 Extract Shared Line-Item Copy Utility

The separate per-document-type item tables are the correct design for schema-enforced privacy. However, the 5+ copy functions (each 80–160 lines of nearly identical nested loops) should be consolidated into a shared utility:

```typescript
async copyLineItemHierarchy(params: {
  sourceGroups: SourceGroup[];
  targetDocumentId: string;
  targetTenantId: string;
  targetTables: { groups: PgTable; combos: PgTable; items: PgTable };
  fieldMap: FieldCopyMap;       // explicit inclusion list per target type
  privacyFilter?: (item: unknown) => boolean;  // e.g. exclude internal items
  tx: DrizzleDbOrTx;
}): Promise<void>
```

One function replaces `copyQuoteLineItemsToProposal`, `copyLineItemsToWorkOrder`, and future copy paths for Invoice/Bill and RFQ/Job — while each call site still specifies its own field map and privacy filter.

---

## 6. Summary of Recommendations

### Design Decisions Validated

The following design choices were initially questioned but are confirmed as correct after deeper analysis:

| Design | Rationale |
|--------|-----------|
| **Cross-tenant FKs** (`proposals.quote_id → quotes.id`) | Correct for shared-database multi-tenant architecture. Provides referential integrity, version tracking, and idempotency. |
| **Ghost orgs in `organizations` table** | Pre-allocated tenants for vendor onboarding. Ghost→active is a status transition on the same row — no cross-table migration needed. Historical data is ready when the vendor subscribes. |
| **Separate per-document-type line-item tables** | Schema-enforced privacy boundaries between commercial counterparties. Proposal items physically cannot hold vendor margin data. |

### Priority 1 — Unblock the Supply Chain

These address broken or missing functionality that prevents the intended workflow from operating:

| # | Issue | Recommendation |
|---|-------|----------------|
| 1 | Workflow engine is never called | Wire `WorkflowEngineService.advance()` into all supply-chain services. Remove imperative status-setting. |
| 2 | Proposal accept doesn't create PO | Implement as a workflow `onEnter` hook on the `accepted` step. |
| 3 | RFQ→Job issuance is broken | Fix `RECIPIENT_TYPE_MAP` (`rfq: 'job'`), implement `createJobFromRfq()`, add RFQ to `loadDocumentWithItems`. |
| 4 | Invoice/Bill missing cross-tenant fields and capture | Add org/custody schema fields, implement manual capture endpoint, add source fields to `createBillFromInvoice`. |
| 5 | Lookup domain naming inconsistent | Standardise to underscore-delimited entity names (`purchase_order_status`, `work_order_status`) everywhere and migrate existing data. |

### Priority 2 — Structural Improvements

| # | Issue | Recommendation |
|---|-------|----------------|
| 6 | Vendors not linked to organisations | Add `organisation_id` FK on vendors for automatic cross-tenant routing. |
| 7 | Duplicated line-item copy logic | Extract shared `copyLineItemHierarchy` utility with per-pair field maps and privacy filters. |
| 8 | Synchronous cross-tenant writes | Implement transactional outbox with event-driven receiver-side processing. |
| 9 | Ghost org dual-status confusion | Unify `status`/`subscriptionStatus` into a single lifecycle enum, or ensure auth-layer `status` is non-`active` for ghosts. |

### Priority 3 — Extended Supply Chain

| # | Feature | Scope |
|---|---------|-------|
| 10 | Chain reactions | Proposal accepted → PO → WO → Invoice → Bill, each as workflow hook events. |
| 11 | Recursive sub-contracting depth tracking | Add `depth` counter; configurable maximum per tenant. |
| 12 | Cross-tenant version sync UI | "New version available" banner when `latestAvailableVersion > sourceVersionNumber` with pull action. |
| 13 | Competitive bid comparison | Multiple proposals per RFQ with comparison view and selection. |

### Impact vs Effort Matrix

```
                    High Impact
                        │
   ┌────────────────────┼────────────────────┐
   │                    │                    │
   │  [8] Event-driven  │  [1] Wire workflow │
   │                    │  [2] Proposal→PO   │
   │                    │  [3] Fix RFQ→Job   │
   │                    │  [5] Fix domains   │
   │                    │  [6] Vendor→org    │
   │                    │  [7] Copy utility  │
   │                    │                    │
High Effort ────────────┼──────────────── Low Effort
   │                    │                    │
   │  [11] Depth track  │  [4] Invoice/Bill  │
   │  [13] Bid compare  │      fields        │
   │                    │  [9] Dual-status   │
   │                    │  [12] Version UI   │
   │                    │                    │
   └────────────────────┼────────────────────┘
                        │
                    Low Impact
```

Items 1, 2, 3, 5, 6, and 7 are high-impact and relatively low effort — they should be addressed first. Item 8 (event-driven communication) is the only high-impact, high-effort item remaining; the transactional outbox infrastructure (`outbound_sync_queue`) already exists, so the effort is primarily in wiring it into the issuance path.
