# 30 — Hardcoded Providers & Provider-Specific Connection Forms

**Project:** Claims Manager
**Date:** 2026-04-18
**Scope:** Drop the `integration_providers` table, replace it with a hardcoded provider registry in code, and introduce provider-specific create/edit forms (starting with Crunchwork).
**Supersedes (partially):** `28_PROVIDERS_MANAGEMENT_UI.md` — the data model section changes, the UI interaction pattern changes.

---

## Problem

Providers today are stored as rows in `integration_providers`. In practice they are **not user-generated**:

- Each provider has a bespoke wire protocol (auth style, webhook shape, field set).
- The UI needs **provider-specific create/edit forms** (e.g. Crunchwork shows OAuth client credentials, HMAC key, tenant IDs; a future provider would show different fields).
- The `integration_providers` row contributes nothing except an `id` used as an FK from `integration_connections`, `external_objects`, and `inbound_webhook_events`.

A hardcoded **provider registry** (TypeScript module, shared by API + frontend) is simpler and safer. Connections remain DB rows and are what tenants actually configure.

---

## Target behaviour

### Data model

- `integration_providers` table **removed**.
- `integration_connections.provider_id uuid` → **replaced with** `provider_code text NOT NULL` (e.g. `'crunchwork'`).
- `external_objects.provider_id uuid` → **dropped** (column `provider_code text NOT NULL` already exists on this table).
- `inbound_webhook_events.provider_id uuid` → **dropped** (column `provider_code text` already exists).
- Connection uniqueness becomes `UNIQUE (tenant_id, provider_code, environment)`.

### Backend

- New static registry `apps/api/src/modules/providers/provider-registry.ts` with one entry per provider (starts with `crunchwork`).
- `ProvidersService.findAll` / `.findOne` read from the registry and merge in per-provider connection / webhook metrics.
- `POST /providers` and `PUT /providers/:id` are **removed** (providers are hard-coded; only connections are created/edited).
- Connection endpoints are re-keyed by provider `code` instead of provider `id`.

### Frontend

- `ProviderFormDrawer.tsx` becomes a shell: chooses the provider (`Select`), then renders the **provider-specific create form** for the chosen code. The Crunchwork create form is extracted into a dedicated component.
- A matching **provider-specific edit form** is introduced (Crunchwork first). The existing generic connection editor in `ProviderDetailContent.tsx` is replaced by a dispatch-by-code renderer.
- The drawer no longer creates a provider row — it POSTs directly to `POST /providers/:code/connections`.

---

## Implementation Steps (sequential)

### Step 1 — Add the hardcoded provider registry

**File:** `apps/api/src/modules/providers/provider-registry.ts` (new)

Export a typed array + lookup helpers:

```ts
export interface ProviderRegistryEntry {
  code: string;                  // stable slug, e.g. 'crunchwork'
  name: string;                  // display name
  description: string;
  isActive: boolean;             // registry-level kill switch
  metadata: Record<string, unknown>;
}

export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    description: 'Crunchwork Insurance claims management platform',
    isActive: true,
    metadata: {},
  },
];

export function findProviderByCode(code: string): ProviderRegistryEntry | undefined { /* ... */ }
export function listActiveProviderCodes(): string[] { /* ... */ }
```

Rules:
- Consumers must **not** assume a UUID. `code` is the primary key everywhere.
- Log messages in consumers must use the `[provider-registry.<fn>]` prefix convention.

**Do not** create a parallel frontend registry yet — step 9 handles the UI catalogue.

---

### Step 2 — Update the Drizzle schema

**File:** `apps/api/src/database/schema/index.ts`

1. **Delete** the `integrationProviders` table export.
2. **`integrationConnections`**
   - Remove `providerId: uuid('provider_id').notNull().references(() => integrationProviders.id)`.
   - Add `providerCode: text('provider_code').notNull()`.
   - Replace `uniqueIndex('UQ_connection_tenant_provider_env').on(t.tenantId, t.providerId, t.environment)` with the same index on `(t.tenantId, t.providerCode, t.environment)`.
   - Add `index('idx_connections_provider_code').on(t.providerCode)`.
3. **`externalObjects`** — delete the `providerId` column. `providerCode` (text, not null) already exists and remains the canonical reference.
4. **`inboundWebhookEvents`** — delete the `providerId` column. `providerCode` (text, nullable) already exists and remains the canonical reference. Drop `idx_webhooks_provider_entity` (uses `providerId`); if needed, replace with `index('idx_webhooks_provider_code_entity').on(t.providerCode, t.providerEntityType)`.
5. Remove any Drizzle `relations(...)` block that references `integrationProviders`.

---

### Step 3 — Generate + hand-author the Drizzle migration

**File:** `apps/api/src/database/migrations-drizzle/0004_drop_integration_providers.sql` (new)

Because Drizzle's generator drops columns without backfilling, **hand-author** the migration so existing rows survive:

```sql
-- Add provider_code to integration_connections and backfill from integration_providers.
ALTER TABLE "integration_connections" ADD COLUMN "provider_code" text;

UPDATE "integration_connections" ic
SET "provider_code" = ip."code"
FROM "integration_providers" ip
WHERE ip."id" = ic."provider_id";

ALTER TABLE "integration_connections"
  ALTER COLUMN "provider_code" SET NOT NULL;

-- Swap the uniqueness constraint.
DROP INDEX IF EXISTS "UQ_connection_tenant_provider_env";
CREATE UNIQUE INDEX "UQ_connection_tenant_provider_env"
  ON "integration_connections" ("tenant_id", "provider_code", "environment");
CREATE INDEX "idx_connections_provider_code"
  ON "integration_connections" ("provider_code");

-- Drop FK + column on integration_connections.
ALTER TABLE "integration_connections"
  DROP CONSTRAINT IF EXISTS "integration_connections_provider_id_integration_providers_id_fk";
ALTER TABLE "integration_connections" DROP COLUMN "provider_id";

-- Drop provider_id on external_objects (provider_code already populated).
ALTER TABLE "external_objects"
  DROP CONSTRAINT IF EXISTS "external_objects_provider_id_integration_providers_id_fk";
ALTER TABLE "external_objects" DROP COLUMN "provider_id";

-- Drop provider_id on inbound_webhook_events.
ALTER TABLE "inbound_webhook_events"
  DROP CONSTRAINT IF EXISTS "inbound_webhook_events_provider_id_integration_providers_id_fk";
DROP INDEX IF EXISTS "idx_webhooks_provider_entity";
ALTER TABLE "inbound_webhook_events" DROP COLUMN "provider_id";
CREATE INDEX "idx_webhooks_provider_code_entity"
  ON "inbound_webhook_events" ("provider_code", "provider_entity_type");

-- Finally remove the providers table.
DROP TABLE IF EXISTS "integration_providers";
```

Also regenerate the Drizzle snapshot:

```powershell
pnpm --filter api run db:generate
```

Verify the new `meta/0004_snapshot.json` reflects the schema in step 2 and that `_journal.json` has exactly one new entry. No older snapshot files should be edited.

> `infra/compose.yaml` does **not** define the database — shared infra lives in `capabilities/infra`. No infra changes are required; only migrations.

---

### Step 4 — Remove provider-row repositories, seeds, and DI

Delete or gut the following:

| File | Action |
|------|--------|
| `apps/api/src/database/repositories/integration-providers.repository.ts` | Delete |
| `apps/api/src/database/repositories/index.ts` | Remove the `IntegrationProvidersRepository` / `IntegrationProviderRow` / `IntegrationProviderInsert` exports |
| `apps/api/src/database/seeds/entries/integration-providers.seed.ts` | Delete |
| `apps/api/src/database/seeds/index.ts` | Drop the `integrationProviders` import + entry |
| `apps/api/src/database/seeds/flush.ts` | Drop the `integrationProviders` import + entry |
| `apps/api/src/database/seeds/README.md` | Remove mentions of the providers seed |
| `apps/api/src/database/database.module.ts` | Unregister `IntegrationProvidersRepository` from `providers`/`exports` |

---

### Step 5 — Rewrite `IntegrationConnectionsRepository`

**File:** `apps/api/src/database/repositories/integration-connections.repository.ts`

- Remove the `integrationProviders` import + the join used by `findByTenantAndProvider`.
- All queries switch from `providerId` to `providerCode`:
  - `findByTenantAndProvider({ tenantId, providerCode })` → single-table `WHERE tenant_id = ? AND provider_code = ? AND is_active = true`.
  - `findByProviderId(...)` → renamed to `findByProviderCode({ providerCode })`.
- Keep the auto-typed `IntegrationConnectionRow` / `Insert` exports (Drizzle will regenerate them from the updated schema).

Update every call site:

- `apps/api/src/modules/providers/providers.service.ts` — step 6.
- `apps/api/src/modules/webhooks/webhooks.service.ts` — `resolveConnection` already hardcodes `providerCode: 'crunchwork'`; just stop reading `connection.providerId` and propagate `providerCode` only.
- `apps/api/src/crunchwork/**` — no direct reads of `provider_id`; confirm no regressions.
- `apps/api/test/helpers/crunchwork-token.helper.ts` — rewrite the SQL to `WHERE ic.provider_code = 'crunchwork' AND ic.is_active = true` and drop the `JOIN integration_providers`.

---

### Step 6 — Rewrite `ProvidersService`

**File:** `apps/api/src/modules/providers/providers.service.ts`

- Drop the `IntegrationProvidersRepository` dependency.
- Import `PROVIDER_REGISTRY` / `findProviderByCode` from the new registry.
- `findAll(tenantId)` — iterate `PROVIDER_REGISTRY`, for each entry call the existing webhook repo aggregators **keyed by `providerCode`**. The returned `ProviderSummary` keeps the same shape but:
  - `id` becomes the `code` (so existing routes like `/providers/:id` still work without client changes).
  - `createdAt` / `updatedAt` are dropped from the summary (or set to a build-time constant — discuss during review).
- `findOne({ code })` — return the registry entry merged with `connectionsRepo.findByProviderCode({ providerCode })`.
- **Remove** `create(dto, tenantId)`, `update(params)`, `deactivate(params)`. These made sense only for DB-backed providers.
- `createConnection({ providerCode, tenantId, dto })` — validate `findProviderByCode` first, then insert with `providerCode` instead of `providerId`.
- `updateConnection({ providerCode, connectionId, dto })` — same guard, then update.
- `findWebhookEvents({ providerCode, ... })` — rename param, delegate to the webhook repo (step 7).

Update the aggregator signatures in `inbound-webhook-events.repository.ts`:
- `providerTenantCondition(providerCode, tenantId)` — joins `integration_connections` by `providerCode` and the event's `provider_code`.
- Rename `countByProviderId` / `countErrorsByProviderId` / `lastEventAtByProviderId` / `findByProviderId` to `*ByProviderCode` and take `providerCode: string`.

---

### Step 7 — Rewrite `ProvidersController` + DTOs

**File:** `apps/api/src/modules/providers/providers.controller.ts`

- Drop the `POST /providers`, `PUT /providers/:id`, `DELETE /providers/:id` routes.
- Rename the `:id` path param to `:code` across the remaining routes (`GET /providers/:code`, `GET /providers/:code/connections`, `POST /providers/:code/connections`, `PUT /providers/:code/connections/:connId`, `GET /providers/:code/webhook-events`).
- Add a `@Param('code')` existence guard that throws `NotFoundException` if `findProviderByCode` returns undefined.

**File:** `apps/api/src/modules/providers/dto/create-provider.dto.ts`

- Delete `CreateProviderDto`.
- Keep `CreateConnectionDto` (unchanged).

**File:** `apps/api/src/modules/providers/dto/update-provider.dto.ts`

- Delete `UpdateProviderDto`.
- Keep `UpdateConnectionDto` (unchanged).

Rename the files to `create-connection.dto.ts` / `update-connection.dto.ts` for clarity.

---

### Step 8 — Sweep remaining `providerId` references

Audit and remove every `provider_id`/`providerId` reference that pointed to `integration_providers`:

- `apps/api/src/modules/external/external-object.service.ts` — drop `providerId` from `upsertFromFetch` params; persist only `providerCode`.
- `apps/api/src/modules/external/tools/external-tools.controller.ts` — drop `providerId` from the request DTO.
- `apps/api/src/modules/webhooks/webhooks.service.ts` — remove `providerId` from `persistEvent` / `processEventAsync` signatures; everything that was keyed on provider id now uses `providerCode`.
- `apps/api/src/modules/webhooks/webhooks.controller.ts` — stop reading `connection.providerId`.
- `apps/api/src/modules/webhooks/webhook-alias.controller.ts` — same sweep.

After the sweep, search the repo to confirm zero remaining matches (excluding docs + migrations history):

```powershell
rg --type ts "provider_id|integrationProviders|IntegrationProvidersRepository" apps/api/src
```

---

### Step 9 — Frontend: provider catalogue + types

**File:** `apps/frontend/src/types/api.ts`

- `ProviderSummary.id` stays `string` but is now documented as “provider code”. Remove `createdAt` / `updatedAt` (or keep as optional if step 6 preserves constants).
- `Provider.id` → same treatment.
- Delete `CreateProviderPayload` and `UpdateProviderPayload` (unused after step 11).
- `ProviderConnection` — replace `providerId: string` with `providerCode: string`.

**File:** `apps/frontend/src/components/providers/provider-catalogue.ts` (new)

Small UI-side catalogue mirroring the backend registry — **not** a source of truth, just the metadata needed to drive the dropdown and dispatch to the right form component:

```ts
export interface ProviderCatalogueEntry {
  code: 'crunchwork' /* | future codes */;
  name: string;
  description: string;
}

export const PROVIDER_CATALOGUE: ProviderCatalogueEntry[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    description: 'Crunchwork Insurance claims management platform',
  },
];
```

---

### Step 10 — Frontend: extract the Crunchwork create form

**File:** `apps/frontend/src/components/providers/crunchwork/CrunchworkConnectionCreateForm.tsx` (new)

- Lift the Crunchwork-specific fields **currently inside** `ProviderFormDrawer.tsx` (the `PROVIDER_TEMPLATES[0].fields` list — base URL / REST API / auth URL / client identifier / client ID / client secret / vendor tenant / insure tenant / HMAC key) into this component.
- Exposes a prop-based API:

```ts
export interface CrunchworkConnectionCreateFormProps {
  connectionName: string;
  environment: 'staging' | 'production';
  onCancel: () => void;
  onCreated: (connection: ProviderConnection) => void;
}
```

- Internally owns its own field state + validation + error banner. Builds the `{ baseUrl, baseApi, authUrl, clientIdentifier, providerTenantId, credentials: { clientId, clientSecret }, webhookSecret, config: { insureTenantId } }` payload and calls `createConnectionAction('crunchwork', payload)`.
- Keep the existing helper text / hints / `§3.2.1` references verbatim — they're Crunchwork-specific and should stay with the Crunchwork component.

---

### Step 11 — Frontend: slim down `ProviderFormDrawer`

**File:** `apps/frontend/src/components/providers/ProviderFormDrawer.tsx`

Refactor so the drawer only owns **shared** state (connection name, environment, provider selection, error surfacing). The generic `PROVIDER_TEMPLATES` array + `FieldDef` machinery is deleted.

Behaviour:

1. User opens the drawer.
2. Chooses a provider from a `Select` populated by `PROVIDER_CATALOGUE`.
3. The drawer body renders a dispatch component:

```tsx
{selectedCode === 'crunchwork' && (
  <CrunchworkConnectionCreateForm
    connectionName={connectionName}
    environment={environment}
    onCancel={() => onOpenChange(false)}
    onCreated={() => { onOpenChange(false); router.refresh(); }}
  />
)}
```

4. The drawer's footer **Create Connection** button is removed — submit lives inside the provider-specific form (so each provider controls its own validation + submit label).

Also delete `createProviderAction` from `apps/frontend/src/app/(app)/providers/actions.ts` and the corresponding `createProvider` / `updateProvider` methods from `api-client.ts` (steps 7 and 12 together remove the route).

---

### Step 12 — Frontend: Crunchwork edit form + detail page integration

**File:** `apps/frontend/src/components/providers/crunchwork/CrunchworkConnectionEditForm.tsx` (new)

- Mirrors the create form, but seeded from `ProviderConnection`. Must show **all Crunchwork-specific fields** the create form shows, including the ones currently missing from `ProviderDetailContent.ConnectionCard` edit mode:
  - OAuth Client ID + Client Secret (labelled `••••••••` placeholder — only POST if the user types something new).
  - Insure Tenant ID (pulled from `connection.config.insureTenantId`).
  - HMAC key / Webhook Secret (masked — only POST if changed).
- Prop API:

```ts
export interface CrunchworkConnectionEditFormProps {
  connection: ProviderConnection;
  onCancel: () => void;
  onSaved: () => void;
}
```

**File:** `apps/frontend/src/components/providers/ProviderDetailContent.tsx`

- In the `ConnectionsTab` / `ConnectionCard` flow, replace the inline generic editor with a dispatcher keyed on `provider.code` (or `connection.providerCode`):

```tsx
{editing && provider.code === 'crunchwork' && (
  <CrunchworkConnectionEditForm connection={conn} ... />
)}
```

- Similarly, replace `AddConnectionForm` with the Crunchwork create form when adding a second connection from inside the detail page (so create lives in exactly one component).
- Keep the read-only summary grid — it's provider-agnostic.

**File:** `apps/frontend/src/components/providers/ProviderEditDrawer.tsx`

- Either delete this file (the detail page now owns editing) **or** make it consume the same Crunchwork edit form. Recommended: delete it — `ProviderDetailContent.tsx` has superseded it.

---

### Step 13 — Frontend: API client + server actions

**File:** `apps/frontend/src/lib/api-client.ts`

- Remove `createProvider`, `updateProvider`, `deleteProvider` methods.
- Connection methods keep the same URL shape — the `:id` path segment now carries the code (e.g. `/providers/crunchwork/connections`). No client changes needed if the string is already opaque, but rename the param for clarity (e.g. `getProviderConnections(code: string)`).

**File:** `apps/frontend/src/app/(app)/providers/actions.ts`

- Delete `createProviderAction` and `updateProviderAction`.
- Keep `createConnectionAction` / `updateConnectionAction`; rename the first arg from `providerId` to `providerCode` for clarity. All existing callers already pass the UUID that will now be the code, so no type change is needed beyond documentation.

---

### Step 14 — Tests

- **API unit tests** — where `IntegrationProvidersRepository` was mocked/stubbed, remove. Where the test seeds a provider row, seed a matching registry entry instead (entries are source-of-truth — prefer the real registry).
- **E2E test** — `apps/api/test/crunchwork-auth.e2e-spec.ts` should still pass because `loadCrunchworkConnection` was updated in step 5.
- Add a new unit test: `apps/api/src/modules/providers/providers.service.spec.ts` covering `findAll`/`findOne` against a stubbed connections repo and verifying aggregates are keyed by `providerCode`.

---

### Step 15 — Manual verification

1. **Flush + seed + migrate locally**

   ```powershell
   pnpm --filter api run db:flush -- --yes
   ```

   Confirm no `integration_providers` table exists:

   ```powershell
   pnpm --filter api exec -- node -e "require('pg').Pool && console.log('ok')"
   ```

   or inspect via `psql`:

   ```sql
   \dt integration_*
   SELECT column_name FROM information_schema.columns WHERE table_name = 'integration_connections';
   ```

2. **Start the stack**

   ```powershell
   pnpm run dev
   ```

3. **Providers list** — `/providers` should render a single card (“Crunchwork”) sourced from the hardcoded registry even on an empty DB.
4. **Create connection** — Click *Add Provider Connection*, choose Crunchwork, fill the form, submit. Confirm a new `integration_connections` row exists with `provider_code = 'crunchwork'`.
5. **Edit connection** — Open the detail page, click *Edit* on the connection, change the base URL, save. Confirm the update round-trips.
6. **Credentials/secrets** — Leave the Client Secret / HMAC fields blank on edit → values must be preserved, not blanked out (no field sent to API). Type a new value → DB row's encrypted `credentials` / `webhook_secret` updates.
7. **Webhook ingestion** — Send a Crunchwork webhook via your usual test harness. Confirm `inbound_webhook_events` persists the event with `provider_code = 'crunchwork'` and no `provider_id` column.

---

## Rollback

- The migration is destructive (drops `integration_providers` and `provider_id` columns). Rollback requires a point-in-time DB restore or a hand-authored inverse migration. Because connection rows carry `provider_code`, the only lost data is the `integration_providers.metadata` column — which was unused in practice.
- Keep a copy of the pre-migration `meta/0003_snapshot.json` for reference until the change ships.

---

## Out of scope (future)

- Adding a second provider (Greenlight / LAP / etc.). The registry + dispatch pattern makes this a "two-file change" (append to the registry + catalogue, add a new `<Provider>ConnectionCreateForm` + `<Provider>ConnectionEditForm`).
- Server-side form schema (so the backend can serve a JSON descriptor of fields). For now, forms live in the frontend and the backend only enforces the generic DTO shape.
