# Auth-server gap review — data_cloud ↔ claims-manager

**Date:** 2026-08-12  
**Reference:** `~/repos/data_cloud/apps/auth-server` (`@shore/auth-server` 0.1.0, ShoreEngine)  
**This repo:** `apps/auth-server` (`@morezero/auth-server` 0.3.1, EnsureOS / claims-manager)  
**Companions:** `docs/reviews/claim-cw-api-db-ui-gap.md`, `docs/reviews/cross-tenant-supply-chain-review.md`

**Goal:** Identify what the ShoreEngine auth-server has that this repo’s auth-server does not (and the reverse), so we can decide what to port, what to ignore as product-specific, and which security fixes to take first.

Both trees share the same ancestry: Express + `oidc-provider` v9, Redis-backed sessions, Google/Microsoft login, IAT/DCR, RBAC admin routes, token exchange. They have diverged into two products. File counts (excluding `node_modules` / `dist`): **142** here vs **206** in data_cloud.

---

## 1. Executive summary

| Layer | Verdict |
|---|---|
| **Shared core** | Same OIDC interaction loop (login / register / select-org / consent), password + Google + Microsoft, Redis adapter, IAT + DCR, admin RBAC catalogue, token exchange. |
| **This repo ahead** | First-class Drizzle RBAC + feature tables; `api-seed-client` for claims API tenant seed; real `@morezero/telemetry`; EnsureOS branding; Fly.io deploy; Google `/complete-signup` still present (data_cloud removed it as an account-takeover vector). |
| **data_cloud ahead (security)** | Numbered `SECURITY (F-*)` hardening pass (~100 tagged sites). This repo has **zero** `SECURITY (F-*)` comments and is missing several of those fail-closed checks. |
| **data_cloud ahead (platform)** | Accounts / networks / services tenancy; `application_id` + `account_id` on tokens; silent org switch; adapter-stored IATs; DCR native-client rewrite for MCP; Cloud Run two-phase boot + Terraform. |
| **data_cloud present but unmounted** | Partner provisioning, workers, federation peers, invocation grants, external-connect. Code and tests exist; `server.ts` does **not** mount them. |

**Do not blindly copy data_cloud.** Shore-specific tenancy (licence/org → network/app → tenant/account), NATS workers, invocation grants, and white-label partners are a different product. Port **security and OIDC correctness** first; adopt the accounts model only if claims-manager needs multi-app tenancy.

**Highest-priority gaps in this repo** (security / correctness, not Shore features):

1. Open Dynamic Client Registration (`initialAccessToken: false`) — anyone can `POST /reg`.
2. IAT minted as a custom HS256 JWT that oidc-provider `/reg` does not accept; no permission gate on mint.
3. Browser UI client (`claims-manager-ui`) is registered with `client_credentials`.
4. `extraTokenClaims` only runs for `AccessToken`, so M2M `ClientCredentials` tokens get no org/RBAC claims.
5. Home page endpoint URLs are built from the request `Host` header (host-header injection).
6. `/complete-signup` still exists (data_cloud F-04: unauthenticated account takeover).
7. Secrets committed in `fly.toml` and `env.sample` (real-looking JWT/Redis/DCR keys).
8. Resource-indicator `aud` is attacker-controlled (no `OIDC_ALLOWED_RESOURCES` allowlist).
9. DCR does not rewrite non-https redirect URIs to `application_type: native` (MCP / Cursor localhost registration fails).
10. Admin IAT/client-delete routes authenticate but do not require `org.integrations.manage`.

---

## 2. Legend

| Symbol | Meaning |
|---|---|
| **Y** | Present and mounted / live |
| **P** | Partial (weaker, different shape, or not fail-closed) |
| **N** | Missing |
| **U** | Present in data_cloud source but **not mounted** in `server.ts` |
| **—** | Not applicable / product-specific, do not port |

---

## 3. Capability matrix

### 3.1 Identity & login UX

| Capability | data_cloud | this repo | Notes |
|---|---|---|---|
| Password login / register / reset | Y | Y | Same interaction pages |
| Google OAuth | Y | Y | This repo still has `/complete-signup` (unsafe; see §5) |
| Microsoft Entra | Y | Y | data_cloud adds `/link-account` + password verify |
| Org selector | Y | Y | data_cloud also has silent `POST /api/auth/switch-org` |
| Company onboard | Y | Y | |
| Invite accept | Y | P | data_cloud: `GET /accept-invite` + `POST /api/auth/accept-invite`. This repo: `GET`/`POST /accept-invite` page posts |
| `GET /interaction/:uid/login` redirect | Y | N | data_cloud 303s GET to `/login?interaction=` so oidc-provider does not 500 |
| Signup `x-application-id` spoof guard | Y | N | data_cloud F-30: ignore header unless paired with known `x-client-id` |
| `POST /api/auth/signup/account` | Y | N | Shore account-on-existing-org; needs accounts table |
| Tenant seed after signup | N | Y | `api-seed-client.ts` → claims API `/internal/seed-tenant` |

### 3.2 OIDC / DCR / tokens

| Capability | data_cloud | this repo | Notes |
|---|---|---|---|
| DCR requires IAT outside local | Y | **N** | This repo: `initialAccessToken: false` (“for MCP clients”) |
| IAT stored in oidc-provider adapter | Y | **N** | This repo signs a custom HS256 JWT; `/reg` will not accept it |
| IAT mint requires permission | Y | **N** | data_cloud: `org.integrations.manage` or `dcr:register` |
| Client delete requires permission | Y | P | This repo: any authenticated user in the same org |
| DCR native rewrite (localhost / custom schemes) | Y | N | Needed for Cursor/MCP `http://localhost` redirect URIs |
| Resource-indicator allowlist | Y | N | `OIDC_ALLOWED_RESOURCES`; else client chooses `aud` |
| `extraTokenClaims` for M2M (`ClientCredentials`) | Y | **N** | This repo skips non-`AccessToken` kinds |
| User token requires org | Y | P | data_cloud **throws** if org missing; this repo falls back |
| `account_id` / `application_id` on user JWT | Y | N | Shore accounts model |
| `account_roles` + org roles union | Y | N | This repo: org roles only |
| Platform M2M org allowlist (F-54) | Y | N | Shore workers; skip unless we mint platform M2M |
| Device flow | Y | Y | |
| Token exchange (RFC 8693) | Y | Y | data_cloud file is larger; same route shape |
| PKCE | Y | Y | |

### 3.3 Admin / RBAC

| Capability | data_cloud | this repo | Notes |
|---|---|---|---|
| User invite | Y | Y | data_cloud: `jwtAuthForIAT` only; this repo: `requireAuth()` |
| User role get/set | Y | Y | data_cloud: `roles.grant.<name>` catalogue guard + account→org ID map |
| Role / permission CRUD | Y | Y | data_cloud: extra scopes `network`/`account`, ceiling matrix |
| Feature catalogue + grants | Y | Y | Similar routes; data_cloud resolve takes application/account |
| `PUT /admin/tenants/:id` | Y | N | Shore sole tenant-UUID provisioning path |
| `POST /api/auth/switch-org` | Y | N | Useful if users belong to multiple orgs |
| Partner provision / clients | U | N | Unmounted; Shore white-label |
| Workers CRUD | U | N | Unmounted; NATS/capability workers |
| Federation peers | U | N | Unmounted |

### 3.4 Data model

| Table / concept | data_cloud | this repo | Notes |
|---|---|---|---|
| `users` / `user_identities` | Y | Y | Column names differ (`created`/`modified` vs `created_at`; `is_disabled` vs `is_active`) |
| Organisations | `organisations` (UK) | `organizations` (US) + `org_code` | Alias `organizations` kept in data_cloud |
| Membership | `organisation_user` | `organization_users` | |
| RBAC (`roles`, `permissions`, `role_permissions`, `user_role_assignments`) | used via SQL / services; **not** in auth-server Drizzle schema | **in** Drizzle schema | data_cloud talks to a shared fuller DB |
| `features` / `feature_grants` | via services | in Drizzle schema | |
| `networks` (applications) | Y | N | Shore multi-app |
| `accounts` / `account_users` | Y | N | Shore tenant = account |
| `services` / `application_services` / `account_services` / `service_clients` | Y | N | Shore service catalogue |
| Auth-server owns migrations | Y (`0001`–`0003`) | N | This repo: “API app owns migrations; this file mirrors” |

### 3.5 Ops / deploy

| Capability | data_cloud | this repo | Notes |
|---|---|---|---|
| Cloud Run two-phase listen | Y | N | Bind port before Redis/OIDC so Cloud Run health checks pass |
| Throw (don’t `process.exit`) on OIDC init failure | Y | N | This repo `process.exit(1)` inside `createServer` |
| Terraform (Cloud Run + Memorystore) | Y | N | Shore GCP |
| Fly.io (`fly.toml`, `deploy.ps1`) | N | Y | **Contains committed secrets** — rotate and remove from git |
| Cloud SQL unix-socket `DATABASE_URL` parser | Y | N | `normalize-database-url.ts` |
| Local telemetry shim | Y | N | This repo uses real `@morezero/telemetry` |
| `env.example` placeholders only | Y | N | This repo `env.sample` + `fly.toml` look like live keys |
| Unit tests | ~27 files | ~11 files | data_cloud covers features, IAT, workers, grants, email, DB URL |

---

## 4. What data_cloud added (and whether to port)

### 4.1 Port — security and OIDC correctness

These are independent of Shore tenancy.

| Item | data_cloud source | Why it matters here |
|---|---|---|
| Require IAT for DCR except local/test (F-55) | `oidc-provider.ts` `features.registration.initialAccessToken` | Open `/reg` on the public internet |
| Mint IATs via `provider.InitialAccessToken` + permission gate (F-16) | `iat-routes.ts` | Current HS256 IATs do not work with oidc-provider `/reg` |
| Permission on `DELETE /oauth/clients/:id` (F-39) | `client-routes.ts` | Any org member can revoke API keys |
| Strip `client_credentials` from the browser UI client (F-18) | `static-clients.ts` | `claims-manager-ui` currently has that grant |
| Handle `ClientCredentials` in `extraTokenClaims` | `oidc-provider.ts` | M2M tokens currently skip extra claims |
| Resource allowlist `OIDC_ALLOWED_RESOURCES` (F-33) | `oidc-provider.ts` | Client-chosen `aud` |
| Home page links from `getOidcIssuer()`, not `Host` (F-25) | `server.ts` | Host-header injection |
| Rate-limit `/interaction`, signup, reset, IAT, add-password (F-27) | `server.ts` | This repo already limits some of these; data_cloud also covers `/link-account`, `/api/auth/accept-invite`, `/api/auth/add-password` |
| Fail closed: JWKS required in production (F-15) | `env-validation.ts` | This repo warns and continues with “development keys” |
| Call `JWT_EXPECTED_AUDIENCE` at **startup** (F-11) | `validateAuthServerEnvironment` | Getter exists here but is **not** invoked at boot; `jwt-auth` reads the env var directly and skips enforcement when unset |
| Ephemeral cookie keys in non-prod (F-19) | `env-validation.ts` | Avoid hardcoded cookie secrets |
| DCR native + strip non-http(s) redirect URIs | `server.ts` before `provider.callback()` | MCP/Cursor registration |
| `GET /interaction/:uid/login` → 303 `/login` | `auth-routes.ts` | Avoid 500 JSON on GET |
| Remove `/complete-signup` (F-04) | `google-routes.ts` comment | Account takeover if interaction session is attacker-controlled |
| Microsoft `/link-account` | `microsoft-routes.ts` | Optional UX |
| Placeholder-only env samples | `env.example` | Stop shipping real-looking keys |

`REDIS_ENCRYPTION_KEY` fail-closed in production already exists here (`redis-encryption.ts`). data_cloud also checks it at **startup**; here it throws on first encrypt/decrypt.

### 4.2 Consider — useful if product needs it

| Item | When to port |
|---|---|
| `POST /api/auth/switch-org` | Users with multiple organisations (adjusters / multi-entity contractors) |
| Per-client env templates (`OIDC_CLIENT_{KEY}_REDIRECT_URIS`) | More than one first-party UI (admin + app) |
| Adapter-backed auth-result store module | Cleaner than circular imports; already similar Redis pattern |
| Broader admin permission ceiling (`network` / `account` scopes) | Only if we add those scopes to claims RBAC |
| Cloud Run two-phase boot | Only if auth-server moves off Fly to Cloud Run |
| `createPostgresClient` / Cloud SQL sockets | Only if API DB is Cloud SQL via unix socket |

### 4.3 Do not port (Shore / More0 platform)

| Item | Why |
|---|---|
| `accounts` / `networks` / `services` / `service_clients` | Different tenancy. Claims-manager tenant = `organizations` row |
| Require `account_id` on every user token | Would break login until an accounts table exists |
| `PUT /admin/tenants/:id` as sole UUID authority | Claims API already creates org UUIDs |
| Partner white-label (`/admin/partners/provision`) | Not a claims product |
| Workers + NATS client roles | Shore capability mesh |
| Federation peers | Cross-issuer Shore federation |
| Invocation grants + child-grant budget + `INVOCATION_GRANT_*` keys | Shore worker attenuation |
| External-connect OAuth broker | Shore integration connect |
| Shore logos, `shore-mortgage-ui` client, `SHORE_API_URL` | Branding / env names |
| Terraform Memorystore / Cloud Run | Different runtime |
| Local telemetry no-op | We already have `@morezero/telemetry` |
| Hardcoded platform org UUID `a0000000-0000-4000-8000-000000000001` | Shore platform tenant |

**Note:** partner, worker, peer, invocation-grant, and external-connect routes are **not mounted** in data_cloud `server.ts` either. Treat them as library code, not a live Shore API, unless another process mounts them.

---

## 5. Security findings in this repo (vs data_cloud F-* pass)

data_cloud tagged findings F-04 through F-55 in comments. Mapping to this tree:

| ID | Topic | This repo |
|---|---|---|
| F-04 | `/complete-signup` account takeover | **Still present** (`google-routes.ts`) |
| F-05 / F-20 / F-21 / F-39 | Privileged routes need permissions, not identity | IAT + client-delete: identity only. Role/permission CRUD: `checkPermission` after `requireAuth()` (better than data_cloud’s empty `requireAuth()` + in-handler checks on some routes) |
| F-08 / F-10 | Partner provision auth | N/A (no partner routes) |
| F-11 | `JWT_EXPECTED_AUDIENCE` required in prod | Getter throws, but **startup validation does not call it**; middleware uses `getEnvVar` and allows empty |
| F-12 | Redis token encryption in prod | **Y** (lazy on first use) |
| F-15 | JWKS required in prod | **N** — warn + continue |
| F-16 | IAT mint privileged | **N** |
| F-18 | No `client_credentials` on browser clients | **N** — UI client has it |
| F-19 | No hardcoded cookie keys | P — production requires `OIDC_COOKIES_KEYS`; non-prod may still use static samples |
| F-23 | Invocation grant capability allowlist | N/A |
| F-24 | Rate-limit `/v1/grants` | N/A |
| F-25 | Issuer, not Host, for public URLs | **N** |
| F-27 | Auth rate limits on interaction POSTs | **P** — `/interaction` is limited; some extra prefixes missing |
| F-30 | Untrusted `x-application-id` | **N** |
| F-33 | Resource/`aud` allowlist | **N** |
| F-38 | External-connect open redirect | N/A |
| F-43 | 256kb body limit | **Y** (both) |
| F-54 | Platform M2M allowlist | N/A unless we add platform M2M |
| F-55 | No open DCR in staging/prod | **N** |

**Committed secrets:** `apps/auth-server/fly.toml` and `env.sample` contain JWT private key components, DCR keys, and an Upstash token. data_cloud `env.example` is placeholders only. Rotate anything that was ever deployed from those files; stop tracking live secrets.

---

## 6. Behavioural diffs in shared files

Line counts (this repo → data_cloud) for the files that drifted most:

| File | this | data_cloud |
|---|---|---|
| `src/routes/auth-routes.ts` | 2678 | 3088 |
| `src/config/oidc-provider.ts` | 1069 | 1308 |
| `src/config/env-validation.ts` | 727 | 897 |
| `src/services/organization-resolution-service.ts` | 222 | 522 |
| `src/routes/admin-permission-routes.ts` | 220 | 571 |
| `src/routes/admin-role-routes.ts` | 95 | 247 |
| `src/services/role-assignment-service.ts` | 95 | 219 |
| `src/routes/signup-routes.ts` | 192 | 283 |
| `src/db/schema.ts` | 165 | 250 |

Notable logic diffs:

- **Static clients:** this repo uses a single `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` / callback URI set for `claims-manager-ui`. data_cloud uses per-client templates (`OIDC_CLIENT_APP_SITE_*`) and maps `client_id` → `app_key` for signup.
- **IAT:** this repo `createIatRoutes(app)` with `jose` HS256. data_cloud `createIatRoutes(app, provider)` persists an oidc-provider InitialAccessToken (10 minute TTL).
- **Token claims:** this repo stamps `organization_id`, `org_roles`, `permissions`, `features`. data_cloud also stamps `application_id`, `account_id`, `account_roles`, `organization_name`, and treats missing org as a hard error.
- **Org resolution:** data_cloud resolves application by subdomain/`app_key`, account by org+application, and orgs-without-account. This repo resolves organisations for a user only.
- **Telemetry import:** this repo `@morezero/telemetry`; data_cloud `./lib/telemetry.js` (Pino passthrough, `startTelemetry` no-op).
- **Package name / env:** `MOREZERO_API_URL` here vs `SHORE_API_URL` there. Keep More0/EnsureOS names unless renaming the product.
- **Zod:** data_cloud is on zod 4; this repo zod 3. Irrelevant unless porting invocation-grant schemas.

---

## 7. What this repo has that data_cloud does not

Keep these; they are claims-manager product, not lag.

| Item | Role |
|---|---|
| Drizzle RBAC + feature tables in `schema.ts` | Canonical for this API’s migrations |
| `org_code` on `organizations` | Claims tenant code |
| `src/scripts/seed-rbac.ts` | Local RBAC seed |
| `src/services/api-seed-client.ts` | Fire-and-forget claims API tenant seed (`SEED_NEW_TENANTS`) |
| `AuthLeftPanel.tsx` / `Wordmark.tsx` / EnsureOS logos | Login chrome |
| `@morezero/telemetry` | Real OTEL (data_cloud stubbed this out) |
| Fly.io + `deploy.ps1` | Current runtime (after secret hygiene) |
| Google `/complete-signup` | **Do not keep** — security defect, not a feature |
| `connect-redis` / `express-session` in `package.json` | Unused (sessions removed); safe to drop |

---

## 8. Recommended sequence

1. **Secret hygiene:** rotate keys that lived in `fly.toml` / `env.sample`; replace samples with placeholders; keep secrets in Fly/host env only.
2. **Close DCR:** require adapter-stored IAT in non-local; rewrite IAT mint to use `provider.InitialAccessToken`; gate mint + client delete on `org.integrations.manage`.
3. **Token minting:** include `ClientCredentials` in `extraTokenClaims`; drop `client_credentials` from `claims-manager-ui`; add `OIDC_ALLOWED_RESOURCES`.
4. **Request hardening:** issuer-based public URLs; remove `/complete-signup`; add GET `/interaction/:uid/login` redirect; ignore spoofable `x-application-id`; fail boot if JWKS / `JWT_EXPECTED_AUDIENCE` missing in production.
5. **Optional product:** `POST /api/auth/switch-org` if multi-org users are real; Microsoft link-account if SSO linking is needed.
6. **Do not** import accounts/networks/workers/grants/partners unless a claims-manager plan explicitly adopts that tenancy model.

---

## 9. File index (data_cloud-only, source)

Routes: `admin-org-routes.ts`, `switch-org-routes.ts`, `partner-routes.ts`, `admin-worker-routes.ts`, `admin-peer-routes.ts`, `invocation-grant-routes.ts`, `external-connect.ts`.

Services: `invocation-grant-service.ts`, `child-grant-budget-store.ts`.

DB: `create-postgres-client.ts`, `normalize-database-url.ts`, repositories for accounts/applications/services, `worker.service.ts`, `federation-peer.service.ts`, `nats-client-role.service.ts`, `account-signup.service.ts`, `account-role-assignments.ts`.

Config: `auth-result-store.ts`.

Infra: `infra/*.tf`, `scripts/seed-local-admin.ts`, `production-profile.yaml`.

Mounted in data_cloud `server.ts` today: admin-org + switch-org only (plus the shared route set this repo already has).
