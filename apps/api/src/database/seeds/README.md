# Database Seeds

Idempotent seed framework for `claims_manager`. Used for first-party
reference data and demo / sample data that make the app usable in dev
and staging.

> As of migration `0004_drop_integration_providers`, the provider catalogue
> is **hardcoded in source** (`src/modules/providers/provider-registry.ts`)
> rather than seeded.

## Registered seeds

| Name | Scope | What it does |
|---|---|---|
| `filesystem-default` | **Platform** (`tenant_id = NULL`) | Creates Company + Project filesystem templates (`Company` is `is_default=true`). Available to all tenants at FS setup. |
| `catalog-dev` | **Tenant** | Catalogue types, categories, unit types, Crunchwork v1 + Building Repairs catalogues for the first org (CLI) or a given tenant (signup). |
| `sample-data` | **Tenant** (optional) | ~8 rows per core business table for the first org / given tenant. Gated by `SEED_SAMPLE_DATA=true`. |

> **Document templates** — uploading `.docx` files from `data/templates/` and assigning
> Admin → Document Templates is handled by the **first-login provisioning flow**
> (`ProvisioningService`), not seeds. This ensures uploads go through the real API
> pipeline (thumbnails, pipelines, etc.). Platform templates are synced to GCS by CI/CD.

### Seeding a specific tenant on demand

`catalog-dev.seed.ts` exports `seedCatalogDevForTenant({ db, tenantId, logger? })`.
`sample-data.seed.ts` exports `seedSampleDataForTenant({ db, tenantId, logger? })`.

| Caller | How | When |
|---|---|---|
| CLI (`pnpm --filter api run db:seed`) | Platform seed + first-org catalog-dev; sample-data if `SEED_SAMPLE_DATA=true` | Manual / bootstrap |
| `POST /api/v1/internal/seed-tenant` | Always catalog-dev; sample-data if `SEED_SAMPLE_DATA=true` | Invoked by `auth-server` after a new tenant signs up |
| **First-login provisioning** | `ProvisioningService` → filesystem + template uploads + doc template settings + catalog | Triggered on user's first authenticated request |

The `/internal/seed-tenant` route is guarded by `x-internal-token` (shared
secret) and gated by `SEED_NEW_TENANTS=true`. See
`apps/api/src/modules/internal/` and
`apps/auth-server/src/services/api-seed-client.ts`.

### Env flags

| Var | Effect |
|---|---|
| `SEED_NEW_TENANTS=true` | Enables signup → `/internal/seed-tenant` (catalog-dev always runs when enabled) |
| `SEED_SAMPLE_DATA=true` | Also run `sample-data` (CLI and signup path) |

### Seeding a remote environment (e.g. staging)

The seed script reads `DATABASE_URL` from the environment — same as the API server.
To seed `app.staging.branlamie.com`:

```powershell
# From repo root. Point DATABASE_URL at the staging DB (e.g. via the
# CloudSQL Auth Proxy running on localhost:5432).
$env:DATABASE_URL = "postgresql://<user>:<password>@localhost:5432/<dbname>"
$env:SEED_SAMPLE_DATA = "true"   # optional
pnpm --filter api run db:seed
```

Alternatively, run it from inside the staging VM / a job container where
`DATABASE_URL` is already exported; no other config is required.

Because every inserted row is tagged `seed-*` (sample-data) or keyed on
unique codes (catalog / filesystem), running the seed multiple times against
the same DB is safe.

## Commands

Run from the repo root:

```powershell
# Apply all registered seeds to the current DB (idempotent, safe anytime)
pnpm --filter api run db:seed

# DESTRUCTIVE: drop the `public` + `drizzle` schemas, re-run migrations,
# then run seeds. Dev-only.
pnpm --filter api run db:flush -- --yes
```

`db:flush` refuses to run unless **all** of the following are true:

- `NODE_ENV !== 'production'`
- DB host is `localhost` / `127.0.0.1` (override with `CONFIRM_FLUSH_NON_LOCAL=yes`)
- `--yes` / `-y` flag is passed (or `CONFIRM_FLUSH=yes` env var)

## Layout

```
seeds/
  lib/
    db.ts       # pg.Pool + drizzle connection helper
    runner.ts   # Seed type + runSeeds() orchestrator
  entries/      # seed modules
  index.ts      # seed-only entry point (registers + runs)
  flush.ts      # flush entry point (drop -> migrate -> seed)
```

## Adding a new seed

1. Create `entries/<name>.seed.ts`:

   ```ts
   import type { Seed } from '../lib/runner';
   import { someTable } from '../../schema';

   const seed: Seed = {
     name: '<name>',
     description: 'One-line summary (shown in logs)',
     run: async ({ db, logger }) => {
       // Must be idempotent. Prefer onConflictDoUpdate / onConflictDoNothing
       // against a unique column.
       await db.insert(someTable).values(...).onConflictDoNothing();
       return { inserted: 0, updated: 0, skipped: 0 };
     },
   };

   export default seed;
   ```

2. Register it in `index.ts` **and** `flush.ts` `buildSeeds()`.

3. Run `pnpm --filter api run db:seed` to apply.

## Idempotency rules

- Every seed must be safe to run multiple times.
- Prefer upserts keyed on a unique column.
- Never issue unconditional `INSERT` without conflict handling.

## What is (and isn't) seeded

| Table / concern | Seeded? | Why |
|---|---|---|
| `filesystem_template` (platform) | Yes — `filesystem-default` | Template for tenant FS setup |
| Catalogue types/items | Yes — `catalog-dev` | Per-tenant starter catalogue |
| Word templates + `document_templates` | No — handled by `ProvisioningService` on first login | Uses real API pipeline for thumbnails |
| Sample claims/jobs/… | Optional — `sample-data` | Demo data; env-gated |
| `integration_connections` | No — per-tenant config; created via the UI/API | |
| `organizations`, `users`, `user_identities`, `organization_users` | No — written by `apps/auth-server` on signup/login | |
| Provider catalogue | No — hardcoded in `provider-registry.ts` | |

> The former `integration_providers` table has been removed. Provider
> metadata now lives in `apps/api/src/modules/providers/provider-registry.ts`.
