# 35 — Domain Layer Architecture

**Date:** 2026-06-14
**Status:** Implementation Plan
**Depends on:** Existing NestJS API (`apps/api`), Drizzle schema, webhook projection pipeline
**Sub-documents:**

| Doc | Title |
|-----|-------|
| [35a](./35a_TRANSFORMERS.md) | Transformers — Pure Data Mapping |
| [35b](./35b_USE_CASES.md) | Use Cases — Projection & Command Orchestration |
| [35c](./35c_DOMAIN_SERVICES.md) | Domain Services — Cross-Cutting Business Logic |
| [35d](./35d_DOCUMENT_ISSUANCE.md) | Document Issuance — Lifecycle, Versioning, Visibility |
| [35e](./35e_WORKFLOW_ENGINE.md) | Workflow Engine — State Machines & Step Definitions |
| [35f](./35f_OUTBOUND_SYNC.md) | Outbound Sync — Transactional Outbox & Async Workers |

---

## 0. Purpose

Introduce a structured domain layer into the EnsureOS API that cleanly separates:

1. **Data transformation** (external payload → internal entity shape)
2. **Business orchestration** (multi-entity coordination, transaction management)
3. **Cross-cutting domain logic** (contact sync, line item management, lookup resolution)
4. **Document lifecycle** (issuance, versioning, dual-perspective entities)
5. **Workflow management** (state machine transitions with defined steps)
6. **External system sync** (async outbound queue to Crunchwork and future integrations)

---

## 1. Context & Motivation

### Current State

The existing architecture uses a **mapper-as-orchestrator** pattern:

```
InProcessProjectionService → EntityMapperRegistry → CrunchworkXxxMapper → Repositories
```

Mappers combine three responsibilities: data transformation, parent/child resolution, and persistence orchestration. This works for simple entities but breaks down as the system grows because:

- Cross-cutting logic (contact sync, assignee sync) is duplicated or absent across mappers
- Transformation rules are untestable without mocking repositories
- No support for outbound operations (creating + issuing documents)
- No state machine enforcement
- No concept of document versioning or dual-perspective entities

### EnsureOS Domain Model

EnsureOS is a **multi-tenant claims management platform** with an infinitely recursive supply chain model:

```
Insurer → Head Contractor → Subcontractor → Sub-subcontractor → ...
```

Each tenant services upstream customers and manages downstream vendors. The same document appears in two perspectives depending on role:

| Creator's View | Gate Action | Recipient's View |
|---|---|---|
| Purchase Order | Issue | Work Order |
| Estimate / Quote | Send | Proposal |
| Invoice | Issue | Bill |
| RFQ | Send | (Inbound request) |

EnsureOS is the **system of record**. Crunchwork is an optional integration adapter relevant only for insurer-initiated insurance claim repair jobs.

### Entity Hierarchy

```
Claim (top-level project)
├── Job (work assignment)
│   ├── Quote / Estimate (upstream: pricing for customer)
│   ├── Work Order (upstream: received from customer's PO)
│   │   └── Invoice (upstream: billing to customer)
│   ├── RFQ (downstream: request to vendor)
│   │   └── Proposal (downstream: vendor response)
│   ├── Purchase Order (downstream: order to vendor)
│   │   └── Bill (downstream: vendor's invoice received)
│   ├── Task (polymorphic attachable)
│   ├── Message (communication)
│   ├── Appointment (schedule)
│   ├── Report
│   └── Attachment (polymorphic attachable)
└── Contacts (linked via join tables)
```

### Cross-Cutting Concerns

Every entity type potentially requires:

| Concern | Entities Affected |
|---|---|
| Contact sync | Claim, Job, Quote, PO, WO |
| Assignee sync | Claim, Job, Task |
| Lookup resolution | All entities (status, type, subtype lookups) |
| Parent chain resolution | All child entities |
| Line item hierarchy (groups → combos → items) | Quote, PO, WO, RFQ, Proposal |
| Visibility (private / org / parties) | All associations (contacts, tasks, messages, attachments) |
| Document versioning | PO, WO, Quote, Proposal, Invoice, Bill |
| Outbound sync queue | Any entity connected to Crunchwork |

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENTRY POINTS                                  │
│  Webhook Controller │ REST Controllers │ Workflow Triggers           │
└──────────┬──────────┴────────┬─────────┴────────────┬───────────────┘
           │                   │                      │
           ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     WORKFLOW ENGINE (35e)                             │
│  Step definitions │ Guard conditions │ onEnter hooks                 │
│  Multiple workflows per entity (scenario-based)                      │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       USE CASES (35b)                                 │
│  ProjectJobUseCase │ ProjectClaimUseCase │ IssueDocumentUseCase      │
│  Owns TX boundary │ Calls transformer + domain services              │
└──────┬───────────────────────┬──────────────────────────────────────┘
       │                       │
       ▼                       ▼
┌──────────────────┐  ┌──────────────────────────────────────────────┐
│ TRANSFORMERS(35a)│  │           DOMAIN SERVICES (35c)               │
│ Pure functions   │  │ ContactSyncService │ AssigneeSyncService      │
│ CW→Ensure shape  │  │ LineItemSyncService │ EntityRelationshipSvc   │
│ No DB, no IO    │  │ LookupResolutionService │ VisibilityService    │
└──────────────────┘  └──────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     DOCUMENT ISSUANCE (35d)                           │
│ Version snapshots │ Line item copy │ Association copy (visibility)   │
│ Dual-perspective entity creation │ Item lineage tracking             │
└──────────┬──────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    OUTBOUND SYNC (35f)                                │
│ Transactional outbox table │ Async worker │ Retry logic              │
│ Crunchwork adapter │ Future integration adapters                     │
└─────────────────────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      REPOSITORIES (existing)                         │
│ Pure data access │ Drizzle queries │ Tenant-scoped                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Directory Structure

```
apps/api/src/modules/domain/
├── domain.module.ts                    # NestJS module wiring
│
├── transformers/                       # Layer 1: Pure mapping
│   ├── transformer.interface.ts
│   ├── claim.transformer.ts
│   ├── job.transformer.ts
│   ├── quote.transformer.ts
│   ├── purchase-order.transformer.ts
│   ├── work-order.transformer.ts
│   ├── invoice.transformer.ts
│   ├── bill.transformer.ts
│   ├── rfq.transformer.ts
│   ├── proposal.transformer.ts
│   ├── task.transformer.ts
│   ├── message.transformer.ts
│   ├── appointment.transformer.ts
│   ├── report.transformer.ts
│   ├── attachment.transformer.ts
│   └── contact.transformer.ts
│
├── use-cases/                          # Layer 2: Orchestration
│   ├── use-case.interface.ts
│   ├── use-case.registry.ts
│   ├── project-claim.use-case.ts
│   ├── project-job.use-case.ts
│   ├── project-quote.use-case.ts
│   ├── project-purchase-order.use-case.ts
│   ├── project-work-order.use-case.ts
│   ├── project-invoice.use-case.ts
│   ├── project-bill.use-case.ts
│   ├── project-rfq.use-case.ts
│   ├── project-proposal.use-case.ts
│   ├── project-task.use-case.ts
│   ├── project-message.use-case.ts
│   ├── project-appointment.use-case.ts
│   ├── project-report.use-case.ts
│   ├── project-attachment.use-case.ts
│   └── issue-document.use-case.ts
│
├── services/                           # Layer 3: Shared domain logic
│   ├── contact-sync.service.ts
│   ├── assignee-sync.service.ts
│   ├── line-item-sync.service.ts
│   ├── entity-relationship.service.ts
│   ├── lookup-resolution.service.ts
│   ├── visibility.service.ts
│   ├── item-lineage.service.ts
│   └── versioning.service.ts
│
├── workflows/                          # Layer 4: State machines
│   ├── workflow-engine.service.ts
│   ├── workflow.interface.ts
│   ├── definitions/
│   │   ├── claim.workflows.ts
│   │   ├── job.workflows.ts
│   │   ├── purchase-order.workflows.ts
│   │   ├── work-order.workflows.ts
│   │   ├── quote.workflows.ts
│   │   ├── invoice.workflows.ts
│   │   ├── contact.workflows.ts
│   │   └── task.workflows.ts
│   └── guards/
│       ├── has-line-items.guard.ts
│       ├── has-required-fields.guard.ts
│       └── guard.interface.ts
│
└── outbound/                           # Layer 5: External sync
    ├── outbound-sync.service.ts
    ├── outbound-worker.service.ts
    └── adapters/
        └── crunchwork-outbound.adapter.ts
```

---

## 4. Key Design Principles

### 4.1 EnsureOS Is the System of Record

Crunchwork is one inbound/outbound adapter among potentially many. The domain layer operates independently of any external system. External sync is always async via the outbound queue.

### 4.2 Transformers Are Pure

No database access, no side effects. Given a payload, return a typed shape plus declarations of what needs resolving (lookups, parents, contacts). Unit-testable with plain objects.

### 4.3 Use Cases Own Transaction Boundaries

Each use case wraps its work in a single database transaction. All domain services receive `tx` and operate within it. If any step fails, everything rolls back.

### 4.4 Domain Services Are Composable

Services are injected into use cases via NestJS DI. A use case composes exactly the services it needs. No inheritance hierarchies — pure composition.

### 4.5 Workflows Drive Lifecycle

Status changes go through the workflow engine, not direct field updates. The engine validates transitions and fires hooks (which may call domain services like issuance).

### 4.6 Visibility Is a First-Class Concept

Every association (contact, task, message, attachment linked to an entity) carries a visibility level (`private`, `org`, `parties`). Read queries filter by visibility. The issuance process respects visibility when copying associations to the recipient.

### 4.7 Dual-Perspective Entities Share Lineage

PO and WO are separate tables (different lifecycle, different columns). They share lineage via FKs and document version history. Issuance creates the recipient's entity as a snapshot.

### 4.8 Backward Compatibility via Fallback

The `InProcessProjectionService` tries the new `UseCaseRegistry` first, falls back to the existing `EntityMapperRegistry`. Old mappers continue working until replaced. Migration is incremental.

---

## 5. Migration Strategy

### Phase 1 — Foundation (this implementation)

- Domain module skeleton with interfaces
- `EntityRelationshipService` (parent chain resolution + ancestor denormalization)
- `ContactSyncService` (generic, entity-type-aware)
- `LookupResolutionService` (migrate from current location)
- `JobContactsRepository` (new — populates existing `job_contacts` table)
- `ClaimTransformer` + `ProjectClaimUseCase` (proof of pattern)
- `JobTransformer` + `ProjectJobUseCase` (exercises nested projection + contact sync)
- `UseCaseRegistry` + fallback wiring in `InProcessProjectionService`

### Phase 2 — Line Items & Remaining Entities

- `LineItemSyncService` (groups → combos → items, generic over entity type)
- Migrate quote, PO, invoice, task, message, appointment, report, attachment mappers to use cases
- `AssigneeSyncService`

### Phase 3 — Issuance & Versioning

- `VersioningService` + schema additions (version tracking)
- `DocumentIssuanceService` (issue command, snapshot, dual-perspective creation)
- `ItemLineageService` (WO items → PO items many-to-many tracking)
- Visibility column additions to association tables
- `VisibilityService` (filter + copy-on-issue logic)

### Phase 4 — Workflow Engine

- `WorkflowEngine` service with step definitions in code
- Guard system (pluggable condition checks)
- `onEnter` hook integration with domain services
- Workflow definitions for primary entity types
- Multiple workflows per entity (scenario-based)

### Phase 5 — Outbound Sync

- `outbound_sync_queue` table + migration
- `OutboundSyncService` (write to queue within TX)
- Async worker (poll + push to Crunchwork)
- `CrunchworkOutboundAdapter` (entity→CW payload transformation)
- Retry logic with backoff

### Phase 6 — More0 Integration (future)

- Replace in-process workflow engine with More0 orchestration
- Workflow step definitions map to More0 workflow steps
- Guards become More0 conditions
- `onEnter` hooks become More0 actions

---

## 6. Schema Changes Required

Detailed in sub-documents, summarized here:

| Change | Phase | Table/Column |
|--------|-------|---|
| New repository | 1 | `job_contacts` (table exists, repo missing) |
| Add visibility | 3 | `claim_contacts.visibility`, `job_contacts.visibility`, `tasks.visibility`, `messages.visibility`, `attachments.visibility` |
| Add `created_by_user_id` | 3 | All association tables (for `private` filtering) |
| Version tracking | 3 | `document_versions` table (type, id, version, snapshot, issued_at) |
| Item lineage | 3 | `item_allocations` table (source_wo_item_id ↔ target_po_item_id, M2M) |
| Outbound queue | 5 | `outbound_sync_queue` table |
| Workflow state | 4 | `entity_workflow_state` table (entity_type, entity_id, workflow_name, current_step) |

---

## 7. Interaction With Existing Code

### What Stays

- `InProcessProjectionService` — remains the webhook entry point (with fallback logic added)
- `EntityMapperRegistry` — continues serving unmigrated entity types
- All existing repositories — unchanged (new repos added alongside)
- Drizzle schema — extended, not replaced
- Webhook infrastructure (controller, HMAC, retry) — unchanged

### What Gets Replaced (incrementally)

- `CrunchworkClaimMapper` → `ClaimTransformer` + `ProjectClaimUseCase`
- `CrunchworkJobMapper` → `JobTransformer` + `ProjectJobUseCase`
- `NestedEntityExtractor` → absorbed into `EntityRelationshipService`
- `LookupResolver` → migrated into `domain/services/lookup-resolution.service.ts`
- Direct contact sync in claim mapper → `ContactSyncService`

### Coexistence Period

During migration, both registries coexist:

```typescript
// In InProcessProjectionService.run():
const useCase = this.useCaseRegistry.get(params.providerEntityType);
if (useCase) {
  return useCase.execute({ externalObject, tenantId, connectionId, tx });
}
// Fallback to legacy mapper
const mapper = this.mapperRegistry.get({ entityType: params.providerEntityType });
```

---

## 8. Testing Strategy

| Layer | Test Type | What's Tested |
|---|---|---|
| Transformers | Unit (no DI) | Given CW payload → correct Ensure shape + declared dependencies |
| Domain Services | Integration (with test DB) | Contact upsert + join table population, lookup resolution |
| Use Cases | Integration (with test DB) | Full orchestration: transform → resolve → persist → link |
| Workflow Engine | Unit | Transition validation, guard evaluation, hook dispatch |
| Outbound Worker | Integration (with test DB + mock HTTP) | Queue consumption, payload formation, retry logic |

Transformers can be tested with zero infrastructure — pure input/output assertions. This is the primary testability win over the current mapper pattern.
