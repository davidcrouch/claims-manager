# 26 — Integration Schema Hardening

**Date:** 2026-04-07
**Status:** Implementation Plan
**Depends on:** [002a](../discussion/002a-schema-and-migrations.md) (landed), [002b](../discussion/002b-webhook-pipeline-refactor.md) (landed), [002e](../discussion/002e-multi-tenant-connections.md) (landed)
**Origin:** Assessment of external design prompt against existing codebase — cherry-picked improvements only.

---

## 0. Purpose

Harden the integration-layer schema and service code to close gaps identified during a cross-referencing exercise between an external architectural specification and the existing codebase. The changes fall into four categories:

1. **Referential integrity** — add missing foreign keys and non-null constraints on columns that are always populated in practice.
2. **Future-proofing** — widen column types that currently assume Crunchwork-specific formats.
3. **Observability columns** — add lightweight metadata that improves debugging and admin visibility without new tables.
4. **Transaction boundary documentation** — codify the existing transactional contracts as a reference for future contributors.

No new tables are introduced. No orchestration changes. No More0 workflow modifications.

---

## 1. Schema Changes

### 1.1 — Harden `inbound_webhook_events`

**Problem:** `connectionId` and `providerCode` are nullable with no FK constraints, despite being populated for every successfully resolved webhook since 002e landed. `payloadEntityId` is typed as UUID, which will break if a future provider uses non-UUID entity identifiers.

**File:** `apps/api/src/database/schema/index.ts`

**Column changes:**

| Column | Current | Target | Rationale |
|--------|---------|--------|-----------|
| `connectionId` | `uuid('connection_id')` (nullable, no FK) | `uuid('connection_id').references(() => integrationConnections.id)` (nullable, with FK) | Referential integrity. Kept nullable because unresolved webhooks are still persisted for audit. |
| `providerCode` | `text('provider_code')` (nullable) | No change — already correct as nullable text. |
| `payloadEntityId` | `uuid('payload_entity_id')` | `text('payload_entity_id')` | Future-proofing. Crunchwork uses UUIDs, but a second provider may not. TEXT accommodates both. |
| *(new)* `providerId` | — | `uuid('provider_id').references(() => integrationProviders.id)` (nullable) | Allows direct joins to `integration_providers` without going through `integration_connections`. Nullable for same reason as `connectionId`. |
| *(new)* `providerEntityType` | — | `text('provider_entity_type')` (nullable) | Normalized entity type (e.g. `job`, `claim`) derived from event type at ingest time. Currently computed downstream; persisting it improves query filtering. |

**Index changes:**

| Index | Action |
|-------|--------|
| `idx_webhooks_connection_type_entity` on `(connectionId, eventType, payloadEntityId)` | **Add** — supports filtered queries by connection and entity. |
| `idx_webhooks_provider_entity` on `(providerId, providerEntityType)` | **Add** — supports admin filtering by provider. |

**Migration note:** `payloadEntityId` type change from UUID to TEXT requires a column alter. Postgres casts `uuid → text` implicitly, so existing data is preserved. Drizzle may generate a drop+recreate — verify the migration SQL and manually write `ALTER COLUMN ... TYPE text USING payload_entity_id::text` if needed.

---

### 1.2 — Enrich `external_objects`

**Problem:** The table lacks a direct FK to `integration_providers` (uses `providerCode` text instead), has no columns for the provider's own timestamps, and doesn't track what event type triggered the latest fetch.

**File:** `apps/api/src/database/schema/index.ts`

**Column changes:**

| Column | Current | Target | Rationale |
|--------|---------|--------|-----------|
| *(new)* `providerId` | — | `uuid('provider_id').notNull().references(() => integrationProviders.id)` | Proper FK instead of relying solely on `providerCode` text. Required — every external object has a known provider. |
| *(new)* `externalParentId` | — | `text('external_parent_id')` (nullable) | Provider's parent entity reference (e.g. a quote's parent job ID in Crunchwork). Useful for reconstructing entity hierarchies from external data. |
| *(new)* `externalCreatedAt` | — | `timestamp('external_created_at', { withTimezone: true })` (nullable) | When the provider created this entity. Extracted from `latestPayload` during upsert. |
| *(new)* `externalUpdatedAt` | — | `timestamp('external_updated_at', { withTimezone: true })` (nullable) | When the provider last updated this entity. |
| *(new)* `latestEventType` | — | `text('latest_event_type')` (nullable) | What event type triggered the most recent fetch (e.g. `NEW_JOB`, `UPDATE_JOB`). |
| *(new)* `latestEventTimestamp` | — | `timestamp('latest_event_timestamp', { withTimezone: true })` (nullable) | Timestamp of the triggering event. |
| *(new)* `lastErrorMessage` | — | `text('last_error_message')` (nullable) | Last fetch error, if `fetchStatus` is `failed`. Currently errors are only in the processing log — duplicating here simplifies admin queries on external objects directly. |

**Migration note:** `providerId` is NOT NULL but the table may already contain rows. The migration must:
1. Add `provider_id` as nullable.
2. `UPDATE external_objects SET provider_id = (SELECT id FROM integration_providers WHERE code = provider_code)`.
3. `ALTER COLUMN provider_id SET NOT NULL`.
4. Add the FK constraint.

---

### 1.3 — Add `name` and `authType` to `integration_connections`

**Problem:** Connections have no human-friendly label, making admin UIs show raw UUIDs. There is no column recording the auth mechanism, which matters when a second provider uses a different flow.

**File:** `apps/api/src/database/schema/index.ts`

**Column changes:**

| Column | Current | Target | Rationale |
|--------|---------|--------|-----------|
| *(new)* `name` | — | `text('name').notNull().default('')` | Human-readable label, e.g. "Crunchwork — QLD Prod". Default empty string for migration compatibility with existing rows. |
| *(new)* `authType` | — | `text('auth_type').notNull().default('client_credentials')` | Records the OAuth grant type or auth mechanism. Default matches existing Crunchwork behaviour. |

**Unique constraint update:**

The existing unique index is `(tenantId, providerId, environment)`. The prompt proposed `(providerId, tenantId, name)` to allow multiple connections per tenant+provider with different names. This is a good idea for supporting dev/test/prod connections with distinct labels, but the current constraint already handles this via `environment`. No change needed now — revisit when a tenant needs two prod connections to the same provider.

---

### 1.4 — Enrich `external_object_versions` with change summary

**Problem:** The `changedFields` column is always written as an empty array. The prompt proposes a `changeSummary` JSONB column that records what actually changed between versions.

**File:** `apps/api/src/database/schema/index.ts`

**Column changes:**

| Column | Current | Target | Rationale |
|--------|---------|--------|-----------|
| `changedFields` | `jsonb('changed_fields').notNull().default([])` | Rename column to `changeSummary`, type `jsonb('change_summary').notNull().default({})` | Better name reflecting its purpose. Object shape `{ added: string[], removed: string[], modified: string[] }` is more useful than a flat array. |

**Migration note:** This is a column rename + default change. Existing rows have `[]` which is valid JSONB in the new column. Write an explicit `ALTER TABLE ... RENAME COLUMN changed_fields TO change_summary` in the migration if Drizzle generates a drop+add.

---

## 2. Service Changes

### 2.1 — Update `WebhooksService.persistEvent`

**File:** `apps/api/src/modules/webhooks/webhooks.service.ts`

**Changes:**

1. Accept and persist `providerId` alongside `providerCode`.
2. Derive and persist `providerEntityType` from `eventType` at ingest time using the existing `resolveEntityType` method.
3. Ensure `payloadEntityId` is stored as string (already is in practice via `payload.payload?.id`, but verify no `.toString()` is needed after the UUID→TEXT column change).

**Updated `persistEvent` params:**
```typescript
async persistEvent(params: {
  rawBody: string;
  rawHeaders: Record<string, string>;
  signature: string;
  hmacVerified: boolean;
  connectionId?: string;
  providerCode?: string;
  providerId?: string;       // new
}): Promise<InboundWebhookEventRow>
```

**Updated insert data construction:**
```typescript
const entityType = ExternalToolsController.resolveEntityType(payload.type);

const insertData: InboundWebhookEventInsert = {
  // ... existing fields ...
  payloadEntityId: payload.payload?.id?.toString() ?? null,
  providerId: params.providerId,
  providerEntityType: entityType,
};
```

---

### 2.2 — Update `WebhooksService.resolveConnection` return type

**File:** `apps/api/src/modules/webhooks/webhooks.service.ts`

**Change:** Include `providerId` in the resolved connection data so it can be passed to `persistEvent`.

```typescript
async resolveConnection(params: {
  payloadTenantId: string;
  payloadClient: string;
}): Promise<{ connectionId: string; providerCode: string; providerId: string } | null>
```

The `providerId` is available on the `IntegrationConnectionRow` already (it has a `providerId` FK). Just include it in the return.

---

### 2.3 — Update `ExternalObjectService.upsertFromFetch`

**File:** `apps/api/src/modules/external/external-object.service.ts`

**Changes:**

1. Accept and persist the new columns: `providerId`, `externalParentId`, `externalCreatedAt`, `externalUpdatedAt`, `latestEventType`, `latestEventTimestamp`.
2. On fetch failure, write `lastErrorMessage`.
3. Build a meaningful `changeSummary` when creating version rows (diff top-level keys between old and new payload).

**Updated params:**
```typescript
async upsertFromFetch(params: {
  tenantId: string;
  connectionId: string;
  providerCode: string;
  providerId: string;              // new
  providerEntityType: string;
  providerEntityId: string;
  normalizedEntityType: string;
  payload: Record<string, unknown>;
  sourceEventId?: string;
  sourceEventType?: string;        // new
  sourceEventTimestamp?: Date;      // new
  tx?: DrizzleDbOrTx;
}): Promise<{ externalObject: ExternalObjectRow; isNew: boolean; hashChanged: boolean }>
```

**Payload timestamp extraction:**
```typescript
const externalCreatedAt = params.payload.createdDate
  ? new Date(params.payload.createdDate as string)
  : undefined;
const externalUpdatedAt = params.payload.updatedDate
  ? new Date(params.payload.updatedDate as string)
  : undefined;
```

**Change summary generation:**
```typescript
private buildChangeSummary(
  oldPayload: Record<string, unknown> | null,
  newPayload: Record<string, unknown>,
): { added: string[]; removed: string[]; modified: string[] } {
  if (!oldPayload) return { added: Object.keys(newPayload), removed: [], modified: [] };
  const oldKeys = new Set(Object.keys(oldPayload));
  const newKeys = new Set(Object.keys(newPayload));
  return {
    added: [...newKeys].filter(k => !oldKeys.has(k)),
    removed: [...oldKeys].filter(k => !newKeys.has(k)),
    modified: [...newKeys].filter(k =>
      oldKeys.has(k) && JSON.stringify(oldPayload[k]) !== JSON.stringify(newPayload[k]),
    ),
  };
}
```

---

### 2.4 — Update `WebhooksController` to pass `providerId`

**Files:**
- `apps/api/src/modules/webhooks/webhooks.controller.ts`
- `apps/api/src/modules/webhooks/webhook-alias.controller.ts`

**Change:** Pass `providerId` from the resolved connection into `persistEvent`.

```typescript
const connection = await this.webhooksService.resolveConnection({...});
// ...
const event = await this.webhooksService.persistEvent({
  // ...existing params...
  connectionId: connection?.connectionId,
  providerCode: connection?.providerCode,
  providerId: connection?.providerId,    // new
});
```

---

### 2.5 — Update `ExternalToolsController` to pass new fields

**File:** `apps/api/src/modules/external/tools/external-tools.controller.ts`

**Change:** When calling `externalObjectService.upsertFromFetch`, include the new `providerId`, `sourceEventType`, and `sourceEventTimestamp` fields from the workflow input context.

---

## 3. Transaction Boundary Documentation

Create an explicit reference documenting the three transactional contracts that govern the webhook pipeline. This is not new code — it documents the existing behaviour for future contributors.

**Add to:** `apps/api/src/modules/webhooks/README.md` *(create)*

### Transaction A — Webhook Receipt

**Scope:** `WebhooksService.persistEvent` + `WebhooksService.processEventAsync` (fetch phase)

```
BEGIN
  INSERT inbound_webhook_events      — raw event receipt
  -- (commit happens in persistEvent, then processEventAsync starts)
  -- fetch from Crunchwork API (network call, outside transaction)
  BEGIN
    UPSERT external_objects            — latest snapshot
    INSERT external_object_versions    — if payload hash changed
    INSERT external_processing_log     — pending processing record
    UPDATE inbound_webhook_events      — status → 'fetched'
  COMMIT
END
```

**Crash recovery:** If the process crashes after event persist but before fetch, the event has `processing_status = 'pending'` and can be re-processed via the backfill endpoint.

### Transaction B — More0 Workflow Invocation

**Scope:** After Transaction A commits.

```
invoke More0 workflow (network call, outside transaction)
UPDATE external_processing_log — status → 'processing', workflow_run_id set
UPDATE inbound_webhook_events  — status → 'dispatched'
```

**Crash recovery:** If the workflow invocation fails, the processing log has `status = 'pending'` and the event has `status = 'fetched'`. The backfill endpoint can re-trigger.

### Transaction C — Internal Projection (More0 step)

**Scope:** More0 tool endpoint for entity mapping.

```
BEGIN
  UPSERT claims / jobs / quotes / ...  — internal business records
  UPSERT external_links                — mapping rows
  UPDATE external_processing_log       — status → 'completed'
COMMIT
```

**Crash recovery:** More0 retries the step. The projection logic must be idempotent (upsert semantics on external_reference).

---

## 4. Files Summary

### New Files

| # | File | Purpose |
|---|------|---------|
| 1 | `apps/api/src/modules/webhooks/README.md` | Transaction boundary documentation |

### Modified Files

| # | File | Change |
|---|------|--------|
| 1 | `apps/api/src/database/schema/index.ts` | Column additions/changes across 4 tables |
| 2 | `apps/api/src/modules/webhooks/webhooks.service.ts` | Persist new columns, include `providerId` in resolve return |
| 3 | `apps/api/src/modules/webhooks/webhooks.controller.ts` | Pass `providerId` to `persistEvent` |
| 4 | `apps/api/src/modules/webhooks/webhook-alias.controller.ts` | Same as above |
| 5 | `apps/api/src/modules/external/external-object.service.ts` | Accept + persist new columns, build change summaries |
| 6 | `apps/api/src/modules/external/tools/external-tools.controller.ts` | Pass new fields to upsert |
| 7 | `apps/api/src/database/repositories/external-objects.repository.ts` | Handle new columns in upsert |
| 8 | `apps/api/src/database/repositories/inbound-webhook-events.repository.ts` | Handle new columns |

---

## 5. Migration Strategy

All schema changes in sections 1.1–1.4 are applied in a **single Drizzle migration** to avoid intermediate states.

**Steps:**

1. Update Drizzle schema definitions in `schema/index.ts`.
2. Run `pnpm --filter api db:generate` to produce migration SQL.
3. **Review the generated SQL carefully** — watch for:
   - `payloadEntityId` UUID→TEXT: must be `ALTER COLUMN ... TYPE text`, not drop+recreate.
   - `providerId` on `external_objects`: must be added nullable, backfilled, then set NOT NULL.
   - `changedFields` → `changeSummary`: must be `RENAME COLUMN`, not drop+add.
4. Hand-edit the migration SQL if Drizzle generates destructive operations.
5. Run `pnpm --filter api db:migrate` against dev database.
6. Verify with `pnpm --filter api db:studio`.

---

## 6. Test Strategy

| Test | Scope |
|------|-------|
| Schema migration smoke test | Run migration on clean DB and on DB with existing data. Verify no data loss on `payloadEntityId` UUID→TEXT conversion. |
| `WebhooksService.persistEvent` unit test | Verify `providerId` and `providerEntityType` are included in insert data. |
| `ExternalObjectService.upsertFromFetch` unit test | Verify new columns populated. Verify `buildChangeSummary` produces correct diff. |
| `ExternalObjectService.buildChangeSummary` unit test | Added keys, removed keys, modified values, identical payloads. |
| Repository integration tests | Verify FK constraints on `connectionId` and `providerId` reject invalid UUIDs. |

---

## 7. Estimated Effort

| Item | Estimate |
|------|----------|
| Schema changes (1.1–1.4) | 1.5 hours |
| Migration generation + review + hand-edits | 1 hour |
| Service changes (2.1–2.5) | 2 hours |
| Repository updates | 1 hour |
| Transaction boundary documentation | 30 min |
| Unit tests | 2 hours |
| Integration test (migration on existing data) | 1 hour |
| **Total** | **~1 day** |

---

## 8. What Was Explicitly Not Adopted

The following items from the external design prompt were evaluated and rejected:

| Proposal | Reason |
|----------|--------|
| `external_fetch_job` table (durable fetch queue) | Redundant — More0 handles orchestration, retries, and work claiming. Adding a second queue system creates competing state machines. |
| `internal_route_job` table (durable route queue) | Same reason. More0 workflow steps already provide durable routing. |
| `insurers` table | Insurer/account is a lookup concept in this domain, already handled by `lookup_values` with domain `account`. A dedicated table adds indirection without benefit. |
| `parties` table (generic person/org) | Contacts, vendors, users, and assignees are operationally distinct. A generic party table would add polymorphic complexity without payoff at current scale. |
| `addresses` table | Addresses are embedded within claims/jobs in the Crunchwork API. A separate table adds JOINs without reuse benefit until address-first use cases emerge. |
| `entity_custom_fields` (EAV pattern) | JSONB columns (`customData`, `apiPayload`, `proprietaryData`) already provide flexible extension. EAV is strictly worse in Postgres for this use case. |
| `external_event_type_map` table | Event type → entity type mapping is handled in code (`resolveEntityType`). A DB table adds indirection at current scale; revisit when onboarding a second provider. |
| `workflow_instances_ref` table | More0 owns workflow instance state. A local reference table would go stale and create synchronisation burden. |
