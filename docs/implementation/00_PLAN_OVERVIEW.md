# NestJS API Server — Implementation Plan

**Project:** Claims Manager API Server  
**Date:** 2026-03-20  
**Stack:** NestJS + TypeORM + PostgreSQL  
**Role:** BFF middleware between Next.js frontend and Crunchwork Insurance REST API  

---

## Architecture Decision Record

> **ADR-001: NestJS BFF Layer**  
> The original PRD (docs/PRD.md) described the Next.js frontend communicating directly with the Crunchwork REST API, with Supabase as a local cache. The architecture has evolved to introduce a **NestJS API server as a BFF (Backend for Frontend)** layer. This provides: a clean separation of concerns, centralized auth/tenant resolution, local persistence via the hybrid relational+JSONB schema, webhook ingestion, and a stable API contract for the frontend decoupled from the external API's shape.

---

## Architecture Context

```
┌──────────────┐      ┌─────────────────────────┐      ┌──────────────────────┐
│  Next.js     │─────▶│  NestJS API Server      │─────▶│  Crunchwork REST API │
│  Frontend    │◀─────│                         │◀─────│  (External)          │
│  (BFF)       │      │  Dual-write:            │      └──────────────────────┘
└──────────────┘      │  1. Proxy to Crunchwork  │
                      │  2. Persist to local DB  │      ┌──────────────────────┐
                      │                         │◀─────│  Webhooks (inbound)  │
                      │  ┌───────────────────┐  │      │  HMAC-signed events  │
                      │  │ PostgreSQL        │  │      └──────────────────────┘
                      │  │ (local DB)        │  │
                      │  │ hybrid JSONB      │  │
                      │  └───────────────────┘  │
                      └─────────────────────────┘
```

**Data flow — dual-write pattern:**

- **Reads**: Primary source is Crunchwork (via list/get endpoints). Responses are synced to local DB. Local DB serves as cache for dashboard aggregation and fast queries.
- **Writes**: Frontend → NestJS → Crunchwork API. On success, response is synced to local DB.
- **Webhooks**: Crunchwork → NestJS webhook endpoint → fetch full entity from API → sync to local DB.

**Key responsibilities of the NestJS API server:**

1. **Proxy & transform** requests from the frontend to the Crunchwork REST API
2. **Authenticate** with Crunchwork using client credentials (JWT bearer tokens)
3. **Persist** data locally in PostgreSQL using the hybrid relational+JSONB schema
4. **Ingest webhooks** from Crunchwork with HMAC verification
5. **Multi-tenant isolation** — every operation scoped by tenant
6. **OAuth2 security** — validate bearer tokens from the frontend (Kinde)
7. **Aggregate & enrich** data for frontend views (dashboard, lists, details)

---

## Crunchwork API Phase Matrix

The Crunchwork REST API rolls out endpoints in phases. Features in this plan are gated accordingly.

| Phase | Endpoints | Impact |
|-------|-----------|--------|
| **1** | `POST /claims`, `POST /claims/{id}`, `GET /jobs`, `POST /jobs`, `GET /jobs/{id}`, `POST /jobs/{id}`, `GET /jobs/{id}/quotes`, `POST /quotes`, `POST /quotes/{id}`, `GET /purchase-orders/{id}`, `POST /purchase-orders/{id}`, `POST /invoices`, `GET /invoices/{id}`, `POST /invoices/{id}`, `POST /messages`, `GET /messages/{id}`, `POST /tasks`, `GET /tasks/{id}`, `POST /tasks/{id}`, `POST /appointments`, `POST /reports`, `POST /reports/{id}`, `POST /attachments`, `GET /attachments/{id}`, `POST /attachments/{id}`, `GET /attachments/{id}/download` | Core CRUD; jobs list; claims via claim_id from jobs |
| **2** | `GET /jobs/{id}/purchase-orders`, `GET /jobs/{id}/messages`, `GET /jobs/{id}/reports`, `GET /jobs/{id}/tasks`, `GET /jobs/{id}/invoices`, `POST /jobs/{id}/status`, `POST /appointments/{id}`, `GET /quotes/{id}`, `GET /reports/{id}` | Sub-resource reads, job status updates, quote/report reads |
| **3** | `GET /claims/{id}`, `GET /claims?claimNumber=`, `GET /claims?externalReference=`, `GET /appointments/{id}` | Claim reads and search, appointment reads |
| **4** | `GET /vendors/allocation` | Vendor allocation query |
| **5** | `POST /messages/{id}/acknowledge`, `POST /appointments/{id}/cancel` | Message acknowledgement, appointment cancellation |

**List endpoints:** The Crunchwork API provides `GET /jobs` for the jobs list. Each job contains `claim_id`, which is used to fetch the associated claim via `GET /claims/{id}` (Phase 3). There is no `GET /claims` list endpoint — the claims list is built from the local DB, populated by: claims created via `POST /claims`, claims fetched when jobs (from `GET /jobs` or webhooks) provide `claim_id`, and claims found via search (`GET /claims?claimNumber=` / `?externalReference=`).

> **Important:** Features depending on Phase 2+ endpoints should degrade gracefully if the endpoint is not yet available. Use feature flags or phase-aware configuration.

---

## Claims & Jobs Population Strategy

**Jobs** are populated via:
1. **`GET /jobs` list endpoint** — primary source for the jobs list view; each job contains `claim_id`
2. **`POST /jobs`** — locally synced on create
3. **`NEW_JOB` / `UPDATE_JOB` webhooks** — fetch full job and sync locally
4. **Claim detail** — jobs included in claim responses are also synced

**Claims** are populated via (no `GET /claims` list endpoint exists):
1. **`POST /claims`** — locally synced on create
2. **`GET /claims/{id}`** — when we have `claim_id` from a job (Phase 3); jobs from `GET /jobs` or webhooks provide `claim_id`, which we use to fetch and sync the claim
3. **`GET /claims?claimNumber=` / `GET /claims?externalReference=`** — search (Phase 3)
4. **Job webhook cascade** — when a `NEW_JOB` webhook fires, the handler fetches the job (which contains `claimId` / `parentClaimId`), then fetches and syncs the parent claim via `GET /claims/{id}` (Phase 3+)

The **claims list view** is served from the local DB, populated by the above. To seed the local DB with claims, the BFF can: call `GET /jobs`, extract unique `claim_id` values, and fetch each claim via `GET /claims/{id}` (Phase 3+).

**Other entities** (quotes, POs, invoices, messages, tasks, reports) are populated via:
1. Sub-resource endpoints (e.g., `GET /jobs/{id}/quotes`)
2. Webhook events (e.g., `NEW_QUOTE`, `NEW_PURCHASE_ORDER`)
3. Direct reads (e.g., `GET /quotes/{id}`)

---

## Implementation Phases

| # | Document | Title | Description |
|---|----------|-------|-------------|
| 01 | `01_PROJECT_SCAFFOLDING.md` | Project Scaffolding | NestJS app setup, monorepo wiring, dependencies |
| 02 | `02_CONFIGURATION.md` | Configuration & Environment | Config module, env vars, validation |
| 03 | `03_DATABASE_SETUP.md` | Database & TypeORM Setup | PostgreSQL connection, entities, migrations |
| 04 | `04_AUTH_MODULE.md` | Authentication Module | OAuth2 guard, Kinde JWT validation, tenant resolution |
| 05 | `05_CRUNCHWORK_CLIENT.md` | Crunchwork HTTP Client | Client credentials exchange, token caching, HTTP service |
| 06 | `06_TENANT_MODULE.md` | Multi-Tenancy Module | Tenant scoping, request-scoped context, RLS |
| 07 | `07_LOOKUP_MODULE.md` | Lookup Values Module | Domain-driven reference data (status, types, etc.) |
| 08 | `08_CLAIMS_MODULE.md` | Claims Module | CRUD proxy, local persistence, query endpoints |
| 09 | `09_JOBS_MODULE.md` | Jobs Module | Job lifecycle, sub-resources, vendor linkage |
| 10 | `10_QUOTES_MODULE.md` | Quotes Module | Quote CRUD, groups/combos/items hierarchy |
| 11 | `11_PURCHASE_ORDERS_MODULE.md` | Purchase Orders Module | PO lifecycle, line item hierarchy, invoices |
| 12 | `12_INVOICES_MODULE.md` | Invoices Module | Invoice submission, status tracking |
| 13 | `13_MESSAGES_MODULE.md` | Messages Module | Message creation, acknowledgement |
| 14 | `14_TASKS_MODULE.md` | Tasks Module | Task CRUD, assignment |
| 15 | `15_APPOINTMENTS_MODULE.md` | Appointments Module | Create, update, cancel appointments |
| 16 | `16_REPORTS_MODULE.md` | Reports Module | Report CRUD, JSONB body storage |
| 17 | `17_ATTACHMENTS_MODULE.md` | Attachments Module | File upload/download proxy, metadata |
| 18 | `18_VENDORS_MODULE.md` | Vendors Module | Vendor allocation, lookup |
| 19 | `19_WEBHOOKS_MODULE.md` | Webhook Ingestion | HMAC verification, event persistence, dispatch |
| 20 | `20_CONTACTS_MODULE.md` | Contacts Module | Shared contact management |
| 21 | `21_DASHBOARD_AGGREGATION.md` | Dashboard & Aggregation | KPI endpoints, recent activity |
| 22 | `22_ERROR_HANDLING.md` | Error Handling & Logging | Global filters, structured logging |
| 23 | `23_TESTING_STRATEGY.md` | Testing Strategy | Unit, integration, e2e test approach |
| 24 | `24_DEPLOYMENT.md` | Deployment & CI/CD | Docker, environment configs, pipeline |

---

## UI Implementation Plans (Next.js Frontend)

The Next.js frontend implements `docs/design/02_UI_SPECIFICATION.md` with SSR, communicating with the NestJS API at `apps/api`.

| # | Document | Title | Scope |
|---|----------|-------|-------|
| 25 | `25_UI_00_OVERVIEW.md` | UI Implementation Overview | SSR strategy, API mapping, architecture |
| 25a | `25a_UI_01_FOUNDATION.md` | Foundation & Setup | API client, auth (Kinde), design system |
| 25b | `25b_UI_02_LAYOUT_NAV.md` | Layout & Navigation | AppShell, sidebar, breadcrumbs |
| 25c | `25c_UI_03_CORE_PAGES.md` | Core Pages | Landing, Dashboard, Claims, Jobs |
| 25d | `25d_UI_04_ENTITY_MODULES.md` | Entity Modules | Quotes, POs, Invoices, Reports |
| 25e | `25e_UI_05_FORMS_SUPPORT.md` | Forms & Support | Drawers, Messages, Vendors, RBAC |

---

## Conventions

- **Package location:** `apps/api` (within pnpm monorepo)
- **ORM:** TypeORM with PostgreSQL
- **Validation:** `class-validator` + `class-transformer`
- **HTTP Client:** `@nestjs/axios` for Crunchwork API calls
- **Logging:** NestJS built-in Logger with structured output
- **Methods with >2 params:** Use parameter objects (DTOs)
- **Log messages:** Prefixed with `[PackageName.MethodName]`
- **API prefix:** `/api/v1`
