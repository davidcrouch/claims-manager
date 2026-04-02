# 25 — UI Implementation Overview

## Objective

Implement the Claims Manager frontend per `docs/design/02_UI_SPECIFICATION.md` using Next.js (App Router) with **Server-Side Rendering (SSR)**, communicating with the NestJS API server at `apps/api`.

---

## Architecture Context

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser                                                                 │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Next.js App (apps/frontend)                                       │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────────┐  │  │
│  │  │ Server Components│  │ Client Components│  │ Server Actions    │  │  │
│  │  │ (SSR data fetch) │  │ (forms, drawers, │  │ (mutations)        │  │  │
│  │  │                  │  │  search, filters)│  │                    │  │  │
│  │  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘  │  │
│  │           │                    │                     │            │  │
│  │           └────────────────────┼─────────────────────┘            │  │
│  │                                │                                  │  │
│  │                    API Client (fetch + auth)                      │  │
│  └────────────────────────────────┼──────────────────────────────────┘  │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │ HTTP (Bearer token)
                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  NestJS API Server (apps/api) — Port 3001                                  │
│  Base URL: /api/v1                                                         │
│  Endpoints: /claims, /jobs, /quotes, /purchase-orders, /invoices, etc.     │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## SSR Strategy

### When to Use SSR vs Client-Side

| Page Type | Rendering | Rationale |
|-----------|-----------|-----------|
| **Landing** (`/`) | SSG (Static) | Public, SEO, fast TTFB |
| **Dashboard** | SSR | Auth-gated, fresh KPIs, recent activity |
| **List pages** (Claims, Jobs, Quotes, etc.) | SSR for initial load | First paint with data; client handles search/sort/filter |
| **Detail pages** (`/claims/[id]`, `/jobs/[id]`, etc.) | SSR | SEO, fast initial content, deep-linkable |
| **Form drawers** | Client | Interactive, modal; no SEO need |
| **Search/filter/sort** | Client | Debounced, user-driven; use React Query or SWR |

### Data Fetching Patterns

1. **Server Components (async pages)**
   - Fetch data in `page.tsx` with `async`; pass to child components as props
   - Use Next.js `fetch` with `cache: 'no-store'` or `next: { revalidate: N }` for SSR
   - Forward auth token via `cookies()` or headers from middleware

2. **API Client**
   - Centralized `lib/api-client.ts` — base URL from `NEXT_PUBLIC_API_URL`
   - Server-side: pass `Authorization: Bearer <token>` from session
   - Client-side: use same client for mutations; token from auth context

3. **Loading & Error States**
   - `loading.tsx` per route segment for Suspense boundaries
   - `error.tsx` for error boundaries
   - `not-found.tsx` for 404

4. **Metadata**
   - `generateMetadata` for dynamic titles (claim number, job ref) on detail pages

---

## API Communication

### Base Configuration

| Env Variable | Purpose | Example |
|--------------|---------|---------|
| `NEXT_PUBLIC_API_URL` | API base URL (used server + client) | `http://localhost:3001` |
| `NEXT_PUBLIC_API_PREFIX` | API path prefix | `/api/v1` |

Full API base: `${NEXT_PUBLIC_API_URL}${NEXT_PUBLIC_API_PREFIX}` → `http://localhost:3001/api/v1`

### Auth Flow

- **Kinde** (per PRD): Hosted auth; redirect to Kinde for login/register
- **Token**: JWT in cookie or session; forwarded as `Authorization: Bearer <token>` to API
- **Tenant**: API expects `x-tenant-id` header; resolved from user/org in Kinde

### API Endpoint Mapping (from UI Spec)

| UI Page / Action | API Endpoint |
|------------------|--------------|
| Claims list | `GET /claims?page=&limit=&search=` |
| Claim detail | `GET /claims/:id` |
| Jobs list | `GET /jobs?page=&limit=&search=` |
| Job detail | `GET /jobs/:id` |
| Job quotes | `GET /jobs/:id/quotes` |
| Job POs | `GET /jobs/:jobId/purchase-orders` |
| Job tasks | `GET /jobs/:jobId/tasks` |
| Job messages | `GET /jobs/:jobId/messages` |
| Job reports | `GET /jobs/:jobId/reports` |
| Quotes list | `GET /quotes` |
| Quote detail | `GET /quotes/:id` |
| POs list | `GET /purchase-orders` |
| PO detail | `GET /purchase-orders/:id` |
| Invoices list | `GET /invoices` |
| Invoice detail | `GET /invoices/:id` |
| Reports list | `GET /reports` |
| Report detail | `GET /reports/:id` |
| Dashboard stats | `GET /dashboard/stats` |
| Dashboard recent activity | `GET /dashboard/recent-activity` |
| Vendors | `GET /vendors`, `GET /vendors/allocation` |
| Lookups | `GET /lookups` |

---

## Implementation Plan Documents

| # | Document | Title | Scope |
|---|----------|-------|-------|
| 25a | `25a_UI_01_FOUNDATION.md` | Foundation & Setup | Next.js config, API client, auth (Kinde), design system, env |
| 25b | `25b_UI_02_LAYOUT_NAV.md` | Layout & Navigation | AppShell, sidebar, breadcrumbs, top bar, route groups |
| 25c | `25c_UI_03_CORE_PAGES.md` | Core Pages | Landing, Dashboard, Claims list/detail, Jobs list/detail (SSR) |
| 25d | `25d_UI_04_ENTITY_MODULES.md` | Entity Modules | Quotes, POs, Invoices, Reports list/detail pages |
| 25e | `25e_UI_05_FORMS_SUPPORT.md` | Forms & Support | Form drawers, Messages, Vendors, role-based visibility |

---

## File Structure (Target)

```
apps/frontend/
├── src/
│   ├── app/
│   │   ├── (marketing)/           # Public
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx           # Landing
│   │   ├── (app)/                 # Authenticated
│   │   │   ├── layout.tsx         # App layout with sidebar
│   │   │   ├── loading.tsx
│   │   │   ├── error.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx       # async, SSR
│   │   │   │   └── loading.tsx
│   │   │   ├── claims/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── [id]/page.tsx
│   │   │   │   └── loading.tsx
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── quotes/
│   │   │   ├── purchase-orders/
│   │   │   ├── invoices/
│   │   │   ├── reports/
│   │   │   └── vendors/
│   │   └── layout.tsx             # Root layout
│   ├── components/
│   │   ├── layout/                # AppShell, Sidebar, Header, Breadcrumbs
│   │   ├── claims/                # ClaimCard, ClaimDetail
│   │   ├── jobs/                 # JobCard, JobDetail, JobTabs
│   │   ├── quotes/
│   │   ├── invoices/
│   │   └── ui/                   # shadcn components
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── auth.ts
│   └── types/                    # API response types
```

---

## Conventions

- **Log messages:** Prefixed with `[frontend.MethodName]` or `[ComponentName.method]`
- **Methods with >2 params:** Use parameter objects
- **API client:** Centralized; no direct fetch in components
- **SSR pages:** Use `async` page components; avoid `useEffect` for initial data
- **Client components:** Mark with `'use client'`; use for forms, drawers, interactive search/filter

---

*Reference: docs/design/02_UI_SPECIFICATION.md, docs/PRD.md, apps/api*
