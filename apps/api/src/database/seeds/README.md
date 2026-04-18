# Database Seeds

Idempotent seed framework for `claims_manager`. Used for first-party
reference data that the app needs in order to function (e.g. the
`integration_providers` row for `crunchwork`).

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
  entries/
    integration-providers.seed.ts   # first-party integration providers
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

2. Register it in `index.ts` **and** `flush.ts`:

   ```ts
   import mySeed from './entries/<name>.seed';
   const SEEDS: Seed[] = [integrationProviders, mySeed];
   ```

3. Run `pnpm --filter api run db:seed` to apply.

## Idempotency rules

- Every seed must be safe to run multiple times.
- Prefer upserts keyed on a unique column (e.g. `integration_providers.code`).
- Never issue unconditional `INSERT` without conflict handling.

## What is (and isn't) seeded

| Table | Seeded? | Why |
|---|---|---|
| `integration_providers` | **Yes** (`crunchwork`) | Looked up by code from webhook handlers and entity mappers |
| `organizations`, `users`, `user_identities`, `organization_users` | No — written by `apps/auth-server` on signup/login | |
| `integration_connections` | No — per-tenant config; created via the UI/API | |
| `lookup_values` | No — auto-created on first webhook ingestion from `external_reference` values | |
| All other tables | No — operational data | |
