# 25a — UI Plan A: Foundation & Setup

## Objective

Establish the Next.js frontend foundation: project configuration, API client for server and client, authentication (Kinde), environment variables, and the design system (shadcn-style components per workers-comp-ai-paralegal).

---

## Prerequisites

- `apps/frontend` exists with Next.js 16, React 19, Tailwind 4
- `apps/api` running on port 3001 with `/api/v1` prefix
- Kinde account for auth (per PRD)

---

## Steps

### 1. Environment Configuration

**1.1 Create `.env.local` (gitignored)**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_API_PREFIX=/api/v1
NEXT_PUBLIC_KINDE_CLIENT_ID=<from Kinde>
NEXT_PUBLIC_KINDE_ISSUER_URL=https://<tenant>.kinde.com
NEXT_PUBLIC_KINDE_SITE_URL=http://localhost:3000
NEXT_PUBLIC_KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3000
```

**1.2 Create `src/lib/env.ts`**

- Validate required env vars at build/runtime
- Export `getApiBaseUrl()` → `${NEXT_PUBLIC_API_URL}${NEXT_PUBLIC_API_PREFIX}`

---

### 2. API Client

**2.1 Create `src/lib/api-client.ts`**

- **`createApiClient(options?: { token?: string; tenantId?: string })`**
  - Returns a client with methods for each resource
  - Base URL from `getApiBaseUrl()`
  - Headers: `Authorization: Bearer <token>`, `x-tenant-id: <tenantId>`, `Content-Type: application/json`

- **Server-side usage:**
  - Call with token from `getKindeServerSession()` (or equivalent)
  - Tenant from session/org

- **Client-side usage:**
  - Call with token from auth context/hook
  - Tenant from context or cookie

**2.2 API client methods (typed)**

| Method | Endpoint | Use |
|--------|----------|-----|
| `getClaims(params)` | `GET /claims` | List with page, limit, search |
| `getClaim(id)` | `GET /claims/:id` | Detail |
| `getJobs(params)` | `GET /jobs` | List |
| `getJob(id)` | `GET /jobs/:id` | Detail |
| `getJobQuotes(jobId)` | `GET /jobs/:id/quotes` | Sub-resource |
| `getJobPurchaseOrders(jobId)` | `GET /jobs/:jobId/purchase-orders` | Sub-resource |
| `getJobTasks(jobId)` | `GET /jobs/:jobId/tasks` | Sub-resource |
| `getJobMessages(jobId)` | `GET /jobs/:jobId/messages` | Sub-resource |
| `getJobReports(jobId)` | `GET /jobs/:jobId/reports` | Sub-resource |
| `getQuotes(params)` | `GET /quotes` | List |
| `getQuote(id)` | `GET /quotes/:id` | Detail |
| `getPurchaseOrders(params)` | `GET /purchase-orders` | List |
| `getPurchaseOrder(id)` | `GET /purchase-orders/:id` | Detail |
| `getInvoices(params)` | `GET /invoices` | List |
| `getInvoice(id)` | `GET /invoices/:id` | Detail |
| `getReports(params)` | `GET /reports` | List |
| `getReport(id)` | `GET /reports/:id` | Detail |
| `getDashboardStats()` | `GET /dashboard/stats` | KPIs |
| `getDashboardRecentActivity(limit?)` | `GET /dashboard/recent-activity` | Activity feed |
| `getVendors()` | `GET /vendors` | List |
| `getVendorsAllocation()` | `GET /vendors/allocation` | Allocation |
| `getLookups()` | `GET /lookups` | Reference data |

- **Mutations** (POST/PUT): Add as needed in later plans (e.g. `createJob`, `createQuote`, etc.)

**2.3 Error handling**

- Map HTTP 401 → redirect to login
- Map HTTP 403 → show forbidden message
- Map HTTP 404 → `notFound()`
- Map 5xx → throw for error boundary

---

### 3. Authentication (Kinde)

**3.1 Install Kinde Next.js SDK**

```bash
cd apps/frontend
pnpm add @kinde-oss/kinde-auth-nextjs
```

**3.2 Configure Kinde**

- Create `src/lib/auth.ts` (or use Kinde's generated config)
- Export `getKindeServerSession()` for server components
- Export auth helpers for middleware

**3.3 Middleware**

- Create `src/middleware.ts`
- Protect `/(app)/*` routes — redirect unauthenticated users to `/` or Kinde login
- Allow `/(marketing)/*` and auth callbacks

**3.4 Auth context (client)**

- Create `AuthProvider` wrapping app
- Expose `useAuth()` hook: `user`, `isLoading`, `logout`
- Use for top bar user menu, tenant selector

---

### 4. Design System & UI Components

**4.1 Install shadcn/ui**

```bash
cd apps/frontend
pnpm dlx shadcn@latest init
```

- Use Tailwind, CSS variables, `components.json` in `src/components/ui`

**4.2 Install base components (per UI spec)**

```bash
pnpm dlx shadcn@latest add button card input label textarea select sheet dialog tabs
```

**4.3 Tailwind theme (per UI spec §1.3)**

- Add to `tailwind.config` or CSS variables:
  - `bg-btn-primary`, `hover:bg-btn-primary-hover`
  - `bg-btn-destructive`
  - `text-slate-500`, `text-slate-700`, `border-slate-200`

**4.4 Create shared components**

| Component | Location | Notes |
|-----------|----------|-------|
| `StatusBadge` | `components/ui/status-badge.tsx` | Props: `status`, `variant` (active/inactive/custom) |
| `EntityCard` | `components/ui/entity-card.tsx` | Compound: Icon, Title, Subtitle, Description, Footer, TopRight, Badge; `border-l-4` accent, `minWidth: 265`, `maxWidth: 322`, `height: 128` |
| `EntityPanel` | `components/ui/entity-panel.tsx` | Wrapper for list pages: search, sort, filters, pagination slots |
| `Breadcrumbs` | `components/ui/breadcrumbs.tsx` | `BreadcrumbItem[]` with `title`, `href` |

**4.5 Icons**

```bash
pnpm add lucide-react
```

- Use: `LayoutDashboard`, `FileText`, `Briefcase`, `FileSpreadsheet`, `ShoppingCart`, `Receipt`, `ClipboardList`, `Building2`, `MessageSquare`, `Search`, `ArrowUp`, `ArrowDown`

---

### 5. TypeScript Types

**5.1 Create `src/types/api.ts`**

- Define interfaces for API responses (Claim, Job, Quote, PurchaseOrder, Invoice, Report, etc.)
- Align with API DTOs; use `unknown` where shape is uncertain
- Export shared types for components

---

### 6. Next.js Configuration

**6.1 Update `next.config.ts`**

- Ensure `images` config if using Kinde avatars
- Add `rewrites` or `proxy` only if needed (e.g. to avoid CORS during dev — API has CORS enabled, so direct calls should work)

**6.2 Route groups**

- Create `(marketing)` and `(app)` route groups (empty layouts initially; full layout in Plan B)

---

## Verification

- [ ] `pnpm dev` starts frontend; `pnpm dev:api` starts API
- [ ] API client can call `GET /api/v1/health` (or `/dashboard/stats` when authenticated)
- [ ] Kinde login redirect works
- [ ] `StatusBadge`, `EntityCard`, `EntityPanel`, `Breadcrumbs` render
- [ ] Env vars load correctly

---

## Dependencies to Add

```
@kinde-oss/kinde-auth-nextjs
lucide-react
```

(shadcn adds its own deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/*`, etc.)

---

*Next: 25b_UI_02_LAYOUT_NAV.md*
