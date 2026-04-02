# Applications Table: Registry vs Auth-Server Alignment

Auth-server and registry share the same database. The **registry** owns the `applications` table (see `apps/registry/migrations/0001_baseline.sql`). This doc compares that table with what auth-server needs.

## Registry `applications` (current)

| Column       | Type         | Notes                          |
|-------------|--------------|--------------------------------|
| id          | uuid PK      | ✓                              |
| app_key     | text UNIQUE  | Registry identifier            |
| name        | text         | ✓                              |
| status      | text         | 'active' \| 'disabled' \| 'archived' |
| created_at  | timestamptz  | ✓ (auth uses as `created`)     |
| created_by  | uuid         | ✓                              |
| updated_at  | timestamptz  | ✓ (auth uses as `modified`)    |
| updated_by  | uuid         | ✓ (auth uses as `modified_by`)  |
| config      | jsonb        | ✓                              |

## Auth-server requirements

| Need            | Used for                          | In registry? |
|-----------------|-----------------------------------|--------------|
| id              | Lookup by ID, signup, tenant res  | ✓            |
| name            | Display, signup                    | ✓            |
| status          | Filtering                         | ✓ (values differ: Active/Archived vs active/disabled/archived) |
| **subdomain**   | **getApplicationBySubdomain()** – tenant resolution by host subdomain | **✗ MISSING** |
| created/modified| Audit                             | ✓ as created_at / updated_at |
| created_by / modified_by | Audit                    | ✓            |
| config          | Optional metadata                 | ✓            |
| organization_id | Link app to organization          | ✗ MISSING (auth local schema has this) |
| system_user_id  | Signup flow                       | ✗ MISSING (optional) |
| accountId       | Optional in shared schema          | ✗ MISSING (optional) |
| object          | Type discriminator ('application') | ✗ MISSING (can default in code) |

## Conclusion

The registry `applications` table does **not** contain all fields needed by auth-server.

### Required for auth-server

- **subdomain** (text, NOT NULL, UNIQUE) – required for `getApplicationBySubdomain()` used in tenant resolution and signup. Without it, auth-server cannot resolve application from the request host (e.g. `myapp.example.com` → subdomain `myapp` → application).

### Optional but useful

- **organization_id** (uuid, nullable) – links the application to an organization in auth-server’s model.
- **system_user_id** (uuid, nullable) – used in signup flow.
- **accountId** (uuid, nullable) – if you keep account linkage on the application row.
- **object** (text, default `'application'`) – for consistency with auth-server’s schema.

### Naming

- Auth-server’s Drizzle schema uses `created` / `modified` and `createdBy` / `modifiedBy`. The shared table uses `created_at` / `updated_at` and `created_by` / `updated_by`. Auth-server should map to the registry column names when reading/writing the same table.

## Recommendation

1. Add a **registry** migration that extends `applications` with at least:
   - `subdomain text UNIQUE` (or UNIQUE not null after backfill).
2. Optionally add: `organization_id uuid`, `system_user_id uuid`, `accountId uuid`, `object text DEFAULT 'application'`.
3. In auth-server, point the applications repository at the **registry’s** `applications` table and use the actual column names (`created_at`, `updated_at`, `created_by`, `updated_by`, `app_key`) so both registry and auth-server use the same schema.

A suggested migration file is in `apps/registry/migrations/` (e.g. `0010_applications_auth_server_fields.sql`).
