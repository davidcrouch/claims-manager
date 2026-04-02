# 001 — PRD2 Design Plan: Internal Tables, External Gateway Layer, and Crunchwork Webhook Support

**Date:** 2026-03-25
**Status:** Design Plan — ready for review before implementation planning
**Context:** Review of PRD2.md against PRD.md, the Crunchwork Insurance REST API v17, and the current codebase.

---

## 0. What This Document Is (and Isn't)

This is a **design plan**. It answers the architectural questions:
- Are the current internal tables sufficient for PRD2?
- What external/gateway tables are needed?
- What does the webhook processing pipeline need to look like?
- What are the concrete schemas and structural decisions?

This is **not** an implementation plan. An implementation plan derived from this document would additionally contain:
- Per-task file-level change lists (which `.ts` files to create/modify)
- Migration scripts and sequencing
- NestJS module/service/repository scaffolding tasks
- Acceptance criteria per work item
- Estimated effort and sprint/phase assignments
- Test strategy per component
- Data migration approach for any existing records

Once this design plan is approved, an implementation plan should be created as a separate document (e.g., `002-implementation-plan.md`) breaking each design decision below into granular development tasks.

---

## 1. Summary of the Design Shift (PRD to PRD2)

PRD (the original) treated the Crunchwork API as the **source of truth**. The local database was a supporting cache layer (`claims_cache`, `jobs_cache`, `webhook_events`), with the external API being the primary backend.

PRD2 introduces a fundamentally different architecture:

- **Two distinct data layers**: an internal normalized operational model (builder's ERP) and a generic external integration model (provider-agnostic gateway).
- The internal model reflects **how the builder wants to operate**, not how Crunchwork structures its API.
- The external model is **provider-agnostic** — no `crunchwork_*` tables.
- Explicit **mapping/link tables** between external and internal records supporting 1:1, 1:many, many:1, and many:many relationships.
- Raw payload preservation, version history, and audit/replay support.

The codebase was started under the PRD approach but has evolved beyond simple cache tables — the Drizzle schema uses Crunchwork's entity structure directly as internal tables with rich column sets. This is a hybrid state: not PRD's thin cache, and not yet PRD2's two-layer architecture. The good news is that the internal tables are substantially correct and need only targeted additions. The external integration layer is what needs building.

---

## 2. Internal Tables — Assessment and Decisions

### 2.1 Existing Internal Tables vs PRD2 Requirements

| Table | PRD2 Entity | Verdict |
|-------|-------------|---------|
| `claims` | claims | **Sufficient.** Rich columns, lookup-based statuses, JSONB extension fields. |
| `claim_contacts` | (join) | **Sufficient.** |
| `claim_assignees` | (assignees) | **Sufficient.** |
| `contacts` | contacts/parties | **Sufficient.** Has externalReference, type lookup, contact details. |
| `jobs` | jobs | **Needs `parentJobId`.** Otherwise good coverage. See 2.2.1. |
| `vendors` | vendors | **Sufficient.** |
| `quotes` | quotes | **Sufficient.** Has claim/job FK, amounts, approval info. |
| `quote_groups` | (line structure) | **Sufficient.** |
| `quote_combos` | (line structure) | **Sufficient.** |
| `quote_items` | (line structure) | **Sufficient.** |
| `purchase_orders` | purchase_orders | **Sufficient.** Comprehensive to/for/from, adjustment info. |
| `purchase_order_groups` | (line structure) | **Sufficient.** |
| `purchase_order_combos` | (line structure) | **Sufficient.** |
| `purchase_order_items` | (line structure) | **Sufficient.** |
| `invoices` | invoices | **Sufficient.** Tied to PO, has status, amounts. |
| `tasks` | tasks | **Sufficient.** Claim/job FK, status, priority, assignment. |
| `messages` | messages | **Sufficient.** From/to claim/job, acknowledgement. |
| `appointments` | (scheduling) | **Sufficient.** Job FK, type, location, dates. |
| `appointment_attendees` | (scheduling) | **Sufficient.** |
| `reports` | reports | **Sufficient.** Type, status, claim/job FK, customData. |
| `attachments` | attachments | **Sufficient.** Polymorphic, S3 metadata. |
| `lookup_values` | (reference data) | **Sufficient.** Generic domain lookup. |
| `external_reference_resolution_log` | (audit) | **Sufficient.** Lookup resolution audit trail. |

### 2.2 Internal Table Changes Required

#### 2.2.1 Add `parentJobId` to `jobs` (CRITICAL)

PRD2 section 6.1 and 6.2:

> "jobs should support parent/child or split relationships"

The current `jobs` table has `parentClaimId` (CW's field representing the claim a job belongs to) but no way to express job-to-job hierarchy. PRD2 needs this so one external CW job can be split into multiple internal work packages.

**Decision:** Add `parentJobId` as a nullable self-referencing FK.

```
parentJobId: uuid('parent_job_id').references(() => jobs.id)
```

No existing data is affected — this is additive.

#### 2.2.2 Add `tenants` table (HIGH)

Every table uses `tenantId` as plain text with no backing entity. PRD2 section 11 requires tenant-awareness and PRD explicitly listed a `tenants` table.

**Decision:** Create a `tenants` table.

```
tenants
├── id: uuid PK
├── name: text NOT NULL
├── slug: text UNIQUE
├── config: jsonb DEFAULT {}       -- tenant-level settings
├── isActive: boolean DEFAULT true
├── createdAt: timestamptz
└── updatedAt: timestamptz
```

Existing `tenantId` text columns can remain as-is for now (adding FK constraints to every table in a single migration is high-risk). The `tenants` table provides a queryable registry. FK enforcement can be added incrementally.

#### 2.2.3 Add `users` table (HIGH)

Various tables store `createdByUserId`, `assignedToUserId`, etc. as plain text. There is no local user entity. Kinde handles auth but the database has no user record.

**Decision:** Create a `users` table mapped from Kinde.

```
users
├── id: uuid PK
├── tenantId: text NOT NULL
├── kindeUserId: text NOT NULL UNIQUE
├── email: text
├── name: text
├── role: text                      -- e.g. admin, claims_manager, assessor, vendor, finance
├── isActive: boolean DEFAULT true
├── createdAt: timestamptz
└── updatedAt: timestamptz
```

This enables user-scoped queries, assignment resolution, and workflow participant tracking.

#### 2.2.4 Internal Workflow Status (DEFERRED)

PRD2 section 6.2 says internal statuses should be independent from provider statuses. Currently, `statusLookupId` on `claims` and `jobs` resolves CW external references, so the provider status and internal status are the same value.

**Decision:** Defer adding a separate `internalStatus` column. The current `statusLookupId` approach allows the lookup value's `name` to be set to an internal label while `externalReference` tracks the CW value. Additionally, once More0 workflow integration begins, workflow state will likely subsume this need. If a distinct operational status emerges as a requirement during implementation, add `workflowStatus: text` to `claims` and `jobs` at that time.

#### 2.2.5 Workflow / Orchestration Tables (DEFERRED)

PRD2 section 6.1 describes workflow instance IDs, stage/state, pending actions, and escalations.

**Decision:** Defer until More0 integration design begins. The shape of these tables depends entirely on the More0 integration strategy (does More0 own state externally? Do we mirror it? Do we drive it?). Flag as a known future requirement.

---

## 3. External Gateway Layer — Complete Design

### 3.1 Design Principles

Per PRD2:
- Tables are **provider-agnostic** — no provider name in table names.
- Crunchwork-specific logic lives in **application code** (adapter modules), not schema.
- Raw payloads are always preserved.
- External objects and internal objects are **separate** and linked explicitly.
- The system must support **multiple providers** over time.

### 3.2 New External Tables

#### 3.2.1 `integration_providers`

Registry of provider types. Seeded with Crunchwork on first deploy.

```
integration_providers
├── id: uuid PK
├── code: text NOT NULL UNIQUE       -- e.g. 'crunchwork', 'provider_b'
├── name: text NOT NULL               -- e.g. 'Crunchwork'
├── isActive: boolean DEFAULT true
├── metadata: jsonb DEFAULT {}        -- provider-level config (API version, capabilities)
├── createdAt: timestamptz
└── updatedAt: timestamptz
```

#### 3.2.2 `integration_connections`

A tenant's configured connection to a specific provider instance. This is where per-tenant CW credentials live instead of `.env`.

```
integration_connections
├── id: uuid PK
├── tenantId: text NOT NULL
├── providerId: uuid NOT NULL FK → integration_providers.id
├── environment: text NOT NULL        -- 'develop', 'staging', 'production'
├── baseUrl: text NOT NULL            -- e.g. 'https://staging-client.crunchwork.com/rest/insurance-rest/'
├── authUrl: text                     -- e.g. 'https://staging-client.crunchwork.com/auth/token'
├── clientIdentifier: text            -- CW 'client' value (e.g. 'staging-develop-')
├── providerTenantId: text            -- CW active-tenant-id value for this connection
├── credentials: jsonb DEFAULT {}     -- encrypted clientId/clientSecret (or vault ref)
├── webhookSecret: text               -- HMAC secret for this connection's webhooks
├── config: jsonb DEFAULT {}          -- connection-specific settings
├── isActive: boolean DEFAULT true
├── lastSyncAt: timestamptz
├── createdAt: timestamptz
└── updatedAt: timestamptz
UNIQUE(tenantId, providerId, environment)
```

**Migration note:** Existing `.env` CW credentials become the seed data for the first row in this table.

#### 3.2.3 `external_events` (evolves from `inbound_webhook_events`)

The current `inbound_webhook_events` table is close to what's needed. Rather than rename it in-place (which risks breaking running code), the decision is:

**Decision:** Keep `inbound_webhook_events` for now. Add `connectionId` column. Rename to `external_events` in a future cleanup phase when the provider-agnostic pattern is fully adopted.

```
Additions to inbound_webhook_events:
├── connectionId: uuid FK → integration_connections.id  -- nullable initially for backcompat
├── providerCode: text                                  -- denormalized for fast filtering
├── retryCount: integer DEFAULT 0
```

#### 3.2.4 `external_event_attempts`

Tracks each processing attempt for an event, enabling retry history and diagnostics.

```
external_event_attempts
├── id: uuid PK
├── eventId: uuid NOT NULL FK → inbound_webhook_events.id
├── attemptNumber: integer NOT NULL
├── status: text NOT NULL              -- 'processing', 'succeeded', 'failed'
├── startedAt: timestamptz NOT NULL
├── completedAt: timestamptz
├── errorMessage: text
├── errorStack: text
├── metadata: jsonb DEFAULT {}         -- worker ID, timing details
├── createdAt: timestamptz
UNIQUE(eventId, attemptNumber)
```

#### 3.2.5 `external_objects` (CRITICAL — new)

Stores the **latest known state** of an entity fetched from an external provider API. This is the core table PRD2 demands that doesn't exist today.

```
external_objects
├── id: uuid PK
├── tenantId: text NOT NULL
├── connectionId: uuid NOT NULL FK → integration_connections.id
├── providerCode: text NOT NULL        -- denormalized: 'crunchwork'
├── providerEntityType: text NOT NULL  -- CW-specific: 'job', 'claim', 'quote', etc.
├── providerEntityId: text NOT NULL    -- the CW UUID for this entity
├── normalizedEntityType: text NOT NULL -- claims-manager vocabulary: 'claim', 'job', 'quote', 'purchase_order', 'invoice', 'task', 'message', 'appointment', 'report', 'attachment'
├── latestPayload: jsonb NOT NULL      -- full API response JSON
├── payloadHash: text                  -- SHA-256 of latestPayload for change detection
├── fetchStatus: text DEFAULT 'fetched' -- 'fetched', 'fetch_failed', 'stale'
├── lastFetchedAt: timestamptz
├── lastFetchEventId: uuid FK → inbound_webhook_events.id
├── metadata: jsonb DEFAULT {}
├── createdAt: timestamptz
└── updatedAt: timestamptz
UNIQUE(connectionId, providerEntityType, providerEntityId)
INDEX(tenantId, normalizedEntityType)
INDEX(providerEntityId)
```

**This is the table that decouples "what CW sent" from "what the builder operates on."**

When a webhook arrives for a CW job:
1. Fetch the full job from CW API.
2. Upsert into `external_objects` (keyed by connectionId + entityType + entityId).
3. **Then** project/map into the internal `jobs` table via the mapping layer.

The internal `apiPayload` column on `jobs`, `claims`, etc. can be retained as a convenience denormalization, but `external_objects` becomes the authoritative external record.

#### 3.2.6 `external_object_versions`

Historical snapshots for audit, replay, and change comparison.

```
external_object_versions
├── id: uuid PK
├── externalObjectId: uuid NOT NULL FK → external_objects.id
├── versionNumber: integer NOT NULL
├── payload: jsonb NOT NULL
├── payloadHash: text NOT NULL
├── sourceEventId: uuid FK → inbound_webhook_events.id  -- which event triggered this version
├── changedFields: jsonb DEFAULT []    -- optional diff summary
├── createdAt: timestamptz
UNIQUE(externalObjectId, versionNumber)
INDEX(externalObjectId, createdAt)
```

Created whenever the `payloadHash` on an `external_object` changes during upsert. This means unchanged re-fetches (same hash) do not generate a new version row.

#### 3.2.7 `external_sync_jobs`

Work queue for fetching, retrying, refreshing, or reconciling external data.

```
external_sync_jobs
├── id: uuid PK
├── tenantId: text NOT NULL
├── connectionId: uuid NOT NULL FK → integration_connections.id
├── eventId: uuid FK → inbound_webhook_events.id  -- nullable (scheduled syncs have no event)
├── providerEntityType: text NOT NULL
├── providerEntityId: text NOT NULL
├── action: text NOT NULL              -- 'fetch', 'retry_fetch', 'refresh', 'backfill'
├── status: text NOT NULL DEFAULT 'pending'  -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
├── priority: integer DEFAULT 0
├── attemptCount: integer DEFAULT 0
├── maxAttempts: integer DEFAULT 3
├── nextAttemptAt: timestamptz
├── lastAttemptAt: timestamptz
├── errorMessage: text
├── metadata: jsonb DEFAULT {}
├── createdAt: timestamptz
└── updatedAt: timestamptz
INDEX(status, nextAttemptAt)
INDEX(tenantId, providerEntityType)
```

This replaces the current `setImmediate()` fire-and-forget pattern. After a webhook event is persisted, an `external_sync_job` row is created. A worker (polled or queue-driven) picks up pending jobs and executes the fetch.

#### 3.2.8 `external_links` (CRITICAL — new)

The mapping table between external objects and internal business records. This is the other core table PRD2 demands.

```
external_links
├── id: uuid PK
├── tenantId: text NOT NULL
├── externalObjectId: uuid NOT NULL FK → external_objects.id
├── internalEntityType: text NOT NULL  -- 'claim', 'job', 'quote', 'purchase_order', 'invoice', 'task', 'message', 'appointment', 'report', 'attachment'
├── internalEntityId: uuid NOT NULL    -- PK of the internal record
├── linkRole: text NOT NULL DEFAULT 'source'  -- 'source', 'corresponds_to', 'split_from', 'merged_into', 'derived_from', 'attachment_of'
├── isPrimary: boolean DEFAULT true    -- marks the "main" link when multiple exist
├── metadata: jsonb DEFAULT {}
├── createdAt: timestamptz
└── updatedAt: timestamptz
UNIQUE(externalObjectId, internalEntityType, internalEntityId, linkRole)
INDEX(internalEntityType, internalEntityId)
INDEX(externalObjectId)
```

**Examples of how this works:**

| Scenario | external_object | external_link(s) |
|----------|----------------|-----------------|
| Standard 1:1 | CW Job `abc-123` | 1 link → internal Job `xyz-789`, role=`source` |
| Job split into 2 work packages | CW Job `abc-123` | Link 1 → internal Job `xyz-001` (make-safe), role=`split_from` |
| | | Link 2 → internal Job `xyz-002` (restoration), role=`split_from` |
| CW claim auto-created from job | CW Claim `def-456` | 1 link → internal Claim `uvw-111`, role=`source` |

#### 3.2.9 `external_event_type_map` (OPTIONAL)

Configurable mapping from provider event types to entity types and handler strategies.

**Decision:** Defer. The switch/strategy pattern in the `WebhookProcessorService` is adequate for a single provider. This table adds value when there are multiple providers with different event naming conventions. Implement if/when a second provider is added.

### 3.3 Summary: Tables to Create

| Table | Priority | Purpose |
|-------|----------|---------|
| `external_objects` | **Critical** | Latest external entity state |
| `external_links` | **Critical** | External ↔ internal mapping |
| `external_object_versions` | High | Audit/version history |
| `external_sync_jobs` | High | Fetch/retry work queue |
| `external_event_attempts` | High | Processing attempt history |
| `integration_connections` | High | Per-tenant provider connections |
| `integration_providers` | Medium | Provider registry |
| `tenants` | High | Tenant registry |
| `users` | High | Internal user registry |

Tables **not** being created (deferred):
- `external_event_type_map` — code-based routing is sufficient for now.
- Workflow/orchestration tables — depends on More0 integration design.

---

## 4. Webhook Processing — Target Design

### 4.1 Crunchwork Webhook Event Types (CW API v17)

| Event Alias | CW Entity | Fetch Endpoint | Internal Target |
|------------|-----------|---------------|-----------------|
| `NEW_JOB` | Job | `GET /jobs/{id}` | → external_object (job) → internal jobs |
| `UPDATE_JOB` | Job | `GET /jobs/{id}` | → external_object (job) → internal jobs |
| `NEW_PURCHASE_ORDER` | Purchase Order | `GET /purchase-orders/{id}` | → external_object (purchase_order) → internal purchase_orders + line items |
| `UPDATE_PURCHASE_ORDER` | Purchase Order | `GET /purchase-orders/{id}` | → external_object (purchase_order) → internal purchase_orders + line items |
| `NEW_INVOICE` | Invoice | `GET /invoices/{id}` | → external_object (invoice) → internal invoices |
| `UPDATE_INVOICE` | Invoice | `GET /invoices/{id}` | → external_object (invoice) → internal invoices |
| `NEW_MESSAGE` | Message | `GET /messages/{id}` | → external_object (message) → internal messages |
| `NEW_TASK` | Task | `GET /tasks/{id}` | → external_object (task) → internal tasks |
| `UPDATE_TASK` | Task | `GET /tasks/{id}` | → external_object (task) → internal tasks |
| `NEW_ATTACHMENT` | Attachment | `GET /attachments/{scopedId}` | → external_object (attachment) → internal attachments |
| `UPDATE_ATTACHMENT` | Attachment | `GET /attachments/{scopedId}` | → external_object (attachment) → internal attachments |

**Note on claims:** The CW API v17 event types table does not list a `NEW_CLAIM` or `UPDATE_CLAIM` webhook event. Claims arrive either:
- Embedded in the Job response (the `claim` nested object on a Job).
- Created/updated via the REST API by the insurer side.

The current code handles `NEW_CLAIM`/`UPDATE_CLAIM` in the switch statement, which is fine as defensive handling if CW adds it. But the primary claim ingestion path should be: **when a Job is fetched, extract and upsert the nested claim**.

### 4.2 Target Processing Pipeline

The current flow is:

```
Webhook → persist event → setImmediate → fetch entity → upsert directly into internal table
```

The target flow per PRD2 is:

```
STAGE 1: INGEST
  Webhook received
  → Capture raw body + headers
  → HMAC verification
  → Resolve connectionId from payload.tenantId + payload.client
  → Persist to inbound_webhook_events (idempotent on externalEventId)
  → Return 200 immediately

STAGE 2: QUEUE
  → Create external_sync_job (action='fetch', entity type + ID from event)
  → (Future: could use BullMQ, or poll-based worker on external_sync_jobs)

STAGE 3: FETCH
  Worker picks up external_sync_job
  → Determine entity type from event type
  → Call CW API to fetch full entity (using connection credentials)
  → Calculate payload hash
  → Upsert into external_objects
  → If hash changed: append external_object_versions row
  → Record external_event_attempt (success/failure)
  → On failure: increment attemptCount, set nextAttemptAt for retry

STAGE 4: PROJECT / MAP
  After successful fetch:
  → Run entity-specific mapper (CrunchworkJobMapper, CrunchworkClaimMapper, etc.)
  → Mapper creates/updates internal records with NEW generated UUIDs (not CW IDs)
  → Mapper creates/updates external_links between external_object and internal records
  → Mapper extracts nested entities:
      - Job response → extract contacts → upsert contacts + job_contacts
      - Job response → extract appointments → upsert appointments + attendees
      - Job response → extract embedded claim → upsert claim (if new)
      - PO response → extract invoices → upsert invoices
  → Mark external_sync_job as completed

STAGE 5: DOWNSTREAM (future)
  → Trigger More0 workflows if applicable
  → Emit internal events for UI refresh / notifications
```

### 4.3 Key Processing Decisions

**CW entity IDs vs internal IDs:** Internal records will use their own auto-generated UUIDs as primary keys. The CW entity ID is stored in the `externalReference` column (which already exists on most tables) and is tracked through `external_objects.providerEntityId`. The `external_links` table connects them. Existing records that were created with CW IDs as PKs will need a one-time migration (generate new internal IDs, update FKs, create external_link rows).

**Nested entity extraction:** When fetching a CW Job, the response includes `contacts[]`, `appointments[]`, `claim{}`, and `vendor{}` as nested objects. The mapper must:
1. Store the entire Job response in `external_objects` as one row (providerEntityType='job').
2. Extract and upsert contacts into `contacts` + `job_contacts`.
3. Extract and upsert appointments into `appointments` + `appointment_attendees`.
4. If the embedded claim is new, upsert into `claims`.
5. If the vendor is new, upsert into `vendors` and link via `jobs.vendorId`.

**Retry strategy:** Failed sync jobs should retry with exponential backoff: attempt 1 immediately, attempt 2 after 30s, attempt 3 after 5min. After `maxAttempts`, mark as failed and alert. The `external_sync_jobs` table supports this with `nextAttemptAt` and `attemptCount`.

**Idempotency:** The `inbound_webhook_events.externalEventId` unique constraint handles duplicate webhook deliveries. The `external_objects` unique constraint on `(connectionId, providerEntityType, providerEntityId)` handles duplicate fetches. Projection/mapping should be idempotent — re-running a mapper on the same external object should not create duplicate internal records (check `external_links` first).

### 4.4 `apiPayload` Columns on Internal Tables — What Happens to Them?

The internal tables (`claims`, `jobs`, `quotes`, etc.) currently have `apiPayload` JSONB columns that store the raw CW response. Under PRD2, this data belongs in `external_objects.latestPayload`.

**Decision:** Keep `apiPayload` on internal tables as a **convenience denormalization**. When projecting from external_object into the internal table, copy the payload into `apiPayload`. This avoids breaking existing frontend queries that may read `apiPayload`. Over time, as the internal tables get richer field extraction (populating address, amounts, dates, etc.), dependence on `apiPayload` should decrease.

### 4.5 Field Extraction Depth

Currently, when creating internal records from CW webhooks, only minimal fields are populated (`id`, `tenantId`, `claimId`, `externalReference`, `apiPayload`). The rich column sets (address fields, amounts, dates, booleans, lookup resolutions) are left empty.

**Decision:** The projection/mapping layer should populate **all available typed columns** from the CW response. The `apiPayload` JSONB serves as a safety net for fields not yet mapped to typed columns, but the goal is for internal tables to have queryable, indexed, typed data — not to rely on JSONB extraction for routine queries.

This means each entity mapper needs a field-mapping definition. For example, the CW Job mapper would:
- `jobs.addressPostcode` ← `cwJob.address.postcode`
- `jobs.addressSuburb` ← `cwJob.address.suburb`
- `jobs.excess` ← `cwJob.excess`
- `jobs.collectExcess` ← `cwJob.collectExcess`
- `jobs.jobInstructions` ← `cwJob.jobInstructions`
- `jobs.statusLookupId` ← resolve `cwJob.status.externalReference` via `lookup_values`
- `jobs.jobTypeLookupId` ← resolve `cwJob.jobType.externalReference` via `lookup_values`
- etc.

---

## 5. Existing Assets That Stay As-Is

These parts of the codebase align with PRD2 and need no structural changes:

| Component | Why It's Fine |
|-----------|--------------|
| Internal entity tables (claims, jobs, quotes, POs, invoices, tasks, messages, appointments, reports, attachments) | Rich column sets, well-normalized, cover the CW domain. PRD2-compatible with the additions in section 2.2. |
| `lookup_values` table | Generic domain lookup approach matches PRD2's extensibility guidance. |
| JSONB extension columns (`apiPayload`, `customData`, `*Payload`, `*Details`) | Align with PRD2 section 6.3: "put provider-specific or rarely queried fields into extension storage." |
| `CrunchworkService` API client | Comprehensive REST client covering all CW endpoints (claims, jobs, quotes, POs, invoices, messages, tasks, appointments, reports, attachments, vendor allocation). This is the provider adapter PRD2 describes. |
| `CrunchworkAuthService` | OAuth client credentials flow for CW. Sound implementation. |
| `WebhookHmacService` | Correct HMAC-SHA256 verification against `Event-Signature` header using raw body bytes. |
| `inbound_webhook_events` table | Captures raw headers, raw body text, parsed JSON, HMAC result, idempotency key. Strong foundation — needs `connectionId` added, not a rewrite. |
| `WebhooksService.persistEvent()` | Correctly extracts all CW event fields into the events table. No change needed. |
| `external_reference_resolution_log` | Tracks lookup resolution decisions during import. Useful audit trail. |
| Drizzle ORM + migrations setup | Solid foundation. New tables follow the same pattern. |
| NestJS module structure | Clean separation of concerns. New external tables get a `database/repositories` entry following the existing pattern. |
| Frontend API client + types | Typed REST client to NestJS BFF. Not affected by backend schema changes. |

---

## 6. Phased Delivery Sequence

### Phase 1 — External Gateway Foundation

**Goal:** Establish the two-layer architecture. After this phase, webhooks store external objects separately from internal records.

| Item | Description |
|------|-------------|
| Create `integration_providers` table | Seed with Crunchwork row. |
| Create `integration_connections` table | Migrate existing `.env` CW credentials into first connection row. |
| Create `external_objects` table | Full schema per 3.2.5. |
| Create `external_links` table | Full schema per 3.2.8. |
| Create `external_object_versions` table | Full schema per 3.2.6. |
| Add `connectionId` + `providerCode` to `inbound_webhook_events` | Nullable initially; backfill existing rows. |
| Add `parentJobId` to `jobs` | Self-referencing FK, nullable. |
| Create `tenants` table | Seed from known tenant IDs. |
| Create `users` table | Seed from Kinde users if available. |
| Refactor `WebhookProcessorService` | After fetching from CW API: upsert `external_objects` first, then project into internal tables. Create `external_links` for each projection. |
| Stop using CW IDs as internal PKs | New records get auto-generated UUIDs. `externalReference` stores the CW ID. |

### Phase 2 — Full Event Type Coverage

**Goal:** Handle all CW webhook event types with full field extraction.

| Item | Description |
|------|-------------|
| Add `NEW_PURCHASE_ORDER` / `UPDATE_PURCHASE_ORDER` handlers | Fetch PO, store in `external_objects`, project into `purchase_orders` + groups/combos/items. Extract inline invoices. |
| Add `NEW_INVOICE` / `UPDATE_INVOICE` handlers | Fetch invoice, store in `external_objects`, project into `invoices`. |
| Add `NEW_MESSAGE` handler | Fetch message, store in `external_objects`, project into `messages`. |
| Add `NEW_TASK` / `UPDATE_TASK` handlers | Fetch task, store in `external_objects`, project into `tasks`. |
| Add `NEW_ATTACHMENT` / `UPDATE_ATTACHMENT` handlers | Fetch attachment metadata, store in `external_objects`, project into `attachments`. |
| Implement nested entity extraction for Job webhook | Extract contacts, appointments, embedded claim, vendor from CW Job response. |
| Implement rich field mapping for all entity types | Populate all typed columns on internal tables from CW API responses (not just `apiPayload`). |
| Resolve lookups during projection | Map CW `status.externalReference`, `jobType.externalReference`, etc. to `lookup_values` rows. |

### Phase 3 — Processing Resilience

**Goal:** Replace fire-and-forget with queued, retryable processing.

| Item | Description |
|------|-------------|
| Create `external_sync_jobs` table | Full schema per 3.2.7. |
| Create `external_event_attempts` table | Full schema per 3.2.4. |
| Implement sync job worker | Polls `external_sync_jobs` for pending work. Replaces `setImmediate()`. |
| Implement retry with backoff | Failed fetches create retry sync jobs with exponential `nextAttemptAt`. |
| Add backfill/refresh capability | Manual or scheduled sync jobs to re-fetch and re-project external objects. |

### Phase 4 — Multi-Tenant Connection Management

**Goal:** Support multiple tenants with independent CW connections via the database instead of `.env`.

| Item | Description |
|------|-------------|
| Refactor `CrunchworkAuthService` | Load credentials from `integration_connections` by tenantId instead of config. |
| Refactor `CrunchworkService` | Accept connectionId parameter; resolve baseUrl and credentials per-call. |
| Webhook connection resolution | On webhook receipt, match `payload.tenantId` + `payload.client` to an `integration_connections` row. |
| Admin UI for connection management | CRUD for `integration_connections` (future — may be out of scope for initial build). |

---

## 7. Open Questions for Discussion

| # | Question | Recommendation |
|---|----------|---------------|
| 1 | Should we migrate existing records created with CW IDs as PKs, or treat them as legacy? | Migrate: generate new internal UUIDs, update all FK references, create `external_links` rows. This is a one-time data migration and is safer done early before more data accumulates. |
| 2 | Should `external_objects` store one row per CW entity, or one row per "nested extraction" (e.g., separate rows for the Job and its embedded Claim)? | One row per CW entity as returned by the API. The Job response (including its nested claim) is one external_object. The Claim, if fetched independently via `GET /claims/{id}`, would be a separate external_object. This matches the "store what the provider sent" principle. |
| 3 | Should the sync job worker be in-process (NestJS `@Cron` or `setInterval`) or out-of-process (BullMQ, external worker)? | Start with in-process `@Interval` polling on `external_sync_jobs`. Move to BullMQ/Redis when volume requires it. The table-based queue makes migration straightforward. |
| 4 | Should credentials in `integration_connections` be stored encrypted or as vault references? | For MVP: encrypted JSONB using application-level AES encryption with a key from env. For production: migrate to AWS Secrets Manager or similar, storing only a secret ARN in the database. |
| 5 | Is the `apiPayload` column on internal tables redundant with `external_objects.latestPayload`? | Intentionally redundant. Keep it as a convenience denormalization so internal table queries don't need a join to `external_objects`. Revisit removal once all typed columns are populated reliably. |
