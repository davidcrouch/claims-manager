# 002a — Schema & Migrations

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan
**Parent:** [002 — Master Index](./002-implementation-plan.md)
**Depends on:** Nothing — this sub-plan lands first.

---

## 0. Scope

All database schema changes: new tables, column additions, Drizzle schema definitions, repository scaffolding, and migration sequencing. No application logic changes — those are in 002b–002e.

---

## 1. Work Items

### 1.1 — Create `tenants` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `tenants` pgTable definition |
| `apps/api/src/database/repositories/tenants.repository.ts` | **Create** — CRUD repository |
| `apps/api/src/database/repositories/index.ts` | Export `TenantsRepository` |
| `apps/api/src/database/database.module.ts` | Register `TenantsRepository` as provider + export |

**Schema:**
```typescript
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Repository methods:**
- `findById(params: { id: string })`
- `findBySlug(params: { slug: string })`
- `findAll()`
- `create(params: { data: TenantInsert })`
- `update(params: { id: string; data: Partial<TenantInsert> })`

**Acceptance criteria:**
- Table exists in Drizzle schema.
- Repository injectable from `DatabaseModule`.
- Migration generated and runnable.

---

### 1.2 — Create `users` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `users` pgTable definition |
| `apps/api/src/database/repositories/users.repository.ts` | **Create** — CRUD repository |
| `apps/api/src/database/repositories/index.ts` | Export `UsersRepository` |
| `apps/api/src/database/database.module.ts` | Register `UsersRepository` as provider + export |

**Schema:**
```typescript
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    kindeUserId: text('kinde_user_id').notNull().unique(),
    email: text('email'),
    name: text('name'),
    role: text('role'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_tenant').on(t.tenantId),
    index('idx_users_email').on(t.tenantId, t.email),
  ],
);
```

**Repository methods:**
- `findById(params: { id: string })`
- `findByKindeUserId(params: { kindeUserId: string })`
- `findByTenant(params: { tenantId: string })`
- `create(params: { data: UserInsert })`
- `update(params: { id: string; data: Partial<UserInsert> })`

**Acceptance criteria:**
- `kindeUserId` is unique.
- Tenant-scoped index exists.

---

### 1.3 — Add `parentJobId` to `jobs`

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `parentJobId` column to `jobs` table definition |

**Column definition:**
```typescript
parentJobId: uuid('parent_job_id').references(() => jobs.id),
```

Nullable self-referencing FK. Insert after the `vendorId` column in the existing `jobs` table.

**Acceptance criteria:**
- Column is nullable with self-referencing FK.
- Existing job queries are unaffected.
- Migration is additive only.

---

### 1.4 — Create `integration_providers` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `integrationProviders` pgTable definition |
| `apps/api/src/database/repositories/integration-providers.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const integrationProviders = pgTable('integration_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Seed data:** A Crunchwork row must be inserted by the migration or a seed script:
```sql
INSERT INTO integration_providers (code, name) VALUES ('crunchwork', 'Crunchwork');
```

**Repository methods:**
- `findByCode(params: { code: string })`
- `findAll()`
- `create(params: { data: IntegrationProviderInsert })`

---

### 1.5 — Create `integration_connections` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `integrationConnections` pgTable definition |
| `apps/api/src/database/repositories/integration-connections.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    providerId: uuid('provider_id').notNull().references(() => integrationProviders.id),
    environment: text('environment').notNull(),
    baseUrl: text('base_url').notNull(),
    authUrl: text('auth_url'),
    clientIdentifier: text('client_identifier'),
    providerTenantId: text('provider_tenant_id'),
    credentials: jsonb('credentials').notNull().default({}),
    webhookSecret: text('webhook_secret'),
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_connection_tenant_provider_env').on(t.tenantId, t.providerId, t.environment),
    index('idx_connections_tenant').on(t.tenantId),
  ],
);
```

**Repository methods:**
- `findById(params: { id: string })`
- `findByTenantAndProvider(params: { tenantId: string; providerCode: string })`
- `findByTenantIdAndClient(params: { providerTenantId: string; clientIdentifier: string })`
- `findAll(params: { tenantId: string })`
- `create(params: { data: IntegrationConnectionInsert })`
- `update(params: { id: string; data: Partial<IntegrationConnectionInsert> })`

---

### 1.6 — Create `external_objects` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `externalObjects` pgTable definition |
| `apps/api/src/database/repositories/external-objects.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const externalObjects = pgTable(
  'external_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    providerCode: text('provider_code').notNull(),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    normalizedEntityType: text('normalized_entity_type').notNull(),
    latestPayload: jsonb('latest_payload').notNull(),
    payloadHash: text('payload_hash'),
    fetchStatus: text('fetch_status').notNull().default('fetched'),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    lastFetchEventId: uuid('last_fetch_event_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_obj_connection_type_id').on(
      t.connectionId,
      t.providerEntityType,
      t.providerEntityId,
    ),
    index('idx_ext_obj_tenant_type').on(t.tenantId, t.normalizedEntityType),
    index('idx_ext_obj_provider_entity_id').on(t.providerEntityId),
  ],
);
```

**Repository methods:**
- `findById(params: { id: string })`
- `findByProviderEntity(params: { connectionId: string; providerEntityType: string; providerEntityId: string })`
- `upsert(params: { data: ExternalObjectInsert })` — insert or update on unique key, return the row + `wasInserted` boolean
- `findByTenantAndType(params: { tenantId: string; normalizedEntityType: string; page?: number; limit?: number })`

---

### 1.7 — Create `external_object_versions` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `externalObjectVersions` pgTable definition |
| `apps/api/src/database/repositories/external-object-versions.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const externalObjectVersions = pgTable(
  'external_object_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalObjectId: uuid('external_object_id')
      .notNull()
      .references(() => externalObjects.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: text('payload_hash').notNull(),
    sourceEventId: uuid('source_event_id'),
    changedFields: jsonb('changed_fields').notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_obj_ver_obj_version').on(t.externalObjectId, t.versionNumber),
    index('idx_ext_obj_ver_obj_created').on(t.externalObjectId, t.createdAt),
  ],
);
```

**Repository methods:**
- `create(params: { data: ExternalObjectVersionInsert })`
- `findByExternalObjectId(params: { externalObjectId: string; limit?: number })`
- `getLatestVersionNumber(params: { externalObjectId: string })`

---

### 1.8 — Create `external_links` table

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `externalLinks` pgTable definition |
| `apps/api/src/database/repositories/external-links.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const externalLinks = pgTable(
  'external_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    externalObjectId: uuid('external_object_id')
      .notNull()
      .references(() => externalObjects.id, { onDelete: 'cascade' }),
    internalEntityType: text('internal_entity_type').notNull(),
    internalEntityId: uuid('internal_entity_id').notNull(),
    linkRole: text('link_role').notNull().default('source'),
    isPrimary: boolean('is_primary').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_link_obj_type_id_role').on(
      t.externalObjectId,
      t.internalEntityType,
      t.internalEntityId,
      t.linkRole,
    ),
    index('idx_ext_link_internal').on(t.internalEntityType, t.internalEntityId),
    index('idx_ext_link_external').on(t.externalObjectId),
  ],
);
```

**Repository methods:**
- `findByExternalObjectId(params: { externalObjectId: string })`
- `findByInternalEntity(params: { internalEntityType: string; internalEntityId: string })`
- `upsert(params: { data: ExternalLinkInsert })`
- `create(params: { data: ExternalLinkInsert })`

---

### 1.9 — Add columns to `inbound_webhook_events`

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add 3 columns to `inboundWebhookEvents` |

**New columns:**
```typescript
connectionId: uuid('connection_id'),
providerCode: text('provider_code'),
retryCount: integer('retry_count').notNull().default(0),
```

All nullable or defaulted — zero impact on existing rows.

---

### 1.10 — Create `external_processing_log` table

> **Note:** In the original design plan this was `external_sync_jobs` (a work queue). With More0 handling orchestration, this table's role changes to a **processing audit log**. More0 owns workflow state, retries, and dispatch. This table provides claims-manager–side visibility into what More0 processed.

**File changes:**
| File | Action |
|------|--------|
| `apps/api/src/database/schema/index.ts` | Add `externalProcessingLog` pgTable definition |
| `apps/api/src/database/repositories/external-processing-log.repository.ts` | **Create** |
| `apps/api/src/database/repositories/index.ts` | Export |
| `apps/api/src/database/database.module.ts` | Register + export |

**Schema:**
```typescript
export const externalProcessingLog = pgTable(
  'external_processing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    connectionId: uuid('connection_id').references(() => integrationConnections.id),
    eventId: uuid('event_id'),
    workflowRunId: text('workflow_run_id'),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull().default('pending'),
    externalObjectId: uuid('external_object_id'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_processing_log_status').on(t.status, t.createdAt),
    index('idx_processing_log_tenant_type').on(t.tenantId, t.providerEntityType),
    index('idx_processing_log_workflow').on(t.workflowRunId),
  ],
);
```

Key difference from the old `external_sync_jobs`: no `nextAttemptAt`, `attemptCount`, `maxAttempts`, `priority` — More0 manages all of that. The `workflowRunId` field links back to More0's execution history.

**Repository methods:**
- `create(params: { data: ExternalProcessingLogInsert })`
- `updateStatus(params: { id: string; status: string; completedAt?: Date; errorMessage?: string; externalObjectId?: string; workflowRunId?: string })`
- `findByEventId(params: { eventId: string })`
- `findByTenantAndType(params: { tenantId: string; providerEntityType?: string; status?: string; page?: number; limit?: number })`

---

### 1.11 — Create `external_event_attempts` table

**Schema (unchanged from original):**
```typescript
export const externalEventAttempts = pgTable(
  'external_event_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => inboundWebhookEvents.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_event_attempt').on(t.eventId, t.attemptNumber),
  ],
);
```

> Written by the More0 workflow's fetch/project steps as a diagnostic log. More0 handles retries; this table captures what happened on each attempt for claims-manager visibility.

**Repository methods:**
- `create(params: { data: ExternalEventAttemptInsert })`
- `findByEventId(params: { eventId: string })`
- `updateStatus(params: { id: string; status: string; completedAt?: Date; errorMessage?: string; errorStack?: string })`

---

## 2. Migration Sequencing

All 1.1–1.11 changes are merged into the Drizzle schema file, then a **single** `drizzle-kit generate` produces one migration file.

**Steps:**
1. Make all schema changes in `apps/api/src/database/schema/index.ts`.
2. Create all repository files.
3. Update `repositories/index.ts` exports.
4. Update `database.module.ts` providers/exports.
5. Run `pnpm --filter api db:generate` to produce the migration SQL.
6. Review the generated SQL.
7. Run `pnpm --filter api db:migrate` against the dev database.
8. Write a seed script for the `integration_providers` Crunchwork row.

---

## 3. New Files Summary

| # | File (relative to `apps/api/src/`) | Action |
|---|-----|--------|
| 1 | `database/repositories/tenants.repository.ts` | Create |
| 2 | `database/repositories/users.repository.ts` | Create |
| 3 | `database/repositories/integration-providers.repository.ts` | Create |
| 4 | `database/repositories/integration-connections.repository.ts` | Create |
| 5 | `database/repositories/external-objects.repository.ts` | Create |
| 6 | `database/repositories/external-object-versions.repository.ts` | Create |
| 7 | `database/repositories/external-links.repository.ts` | Create |
| 8 | `database/repositories/external-event-attempts.repository.ts` | Create |
| 9 | `database/repositories/external-processing-log.repository.ts` | Create |

## 4. Modified Files Summary

| # | File (relative to `apps/api/src/`) | Change |
|---|-----|--------|
| 1 | `database/schema/index.ts` | Add 9 new table definitions + modify `jobs` (parentJobId) + modify `inboundWebhookEvents` (3 columns) |
| 2 | `database/repositories/index.ts` | Add 9 new exports |
| 3 | `database/database.module.ts` | Register 9 new repositories |

---

## 5. Test Strategy

| Test | Scope |
|------|-------|
| Repository unit tests | Each new repository: mock Drizzle DB, verify SQL shape for key methods (upsert, findByProviderEntity). |
| Migration smoke test | Run `db:migrate` on a clean local Postgres; verify all tables created. |
| Schema snapshot | Verify the snapshot JSON in `migrations-drizzle/meta/` matches expectations. |

---

## 6. Estimated Effort

| Item | Estimate |
|------|----------|
| Schema definitions (1.1–1.11) | 2–3 hours |
| Repository files (9 new) | 3–4 hours |
| Wiring (index, database module) | 30 min |
| Migration generation + review | 30 min |
| Seed script | 30 min |
| Unit tests | 2–3 hours |
| **Total** | **~1.5 days** |
