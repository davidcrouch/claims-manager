# 28 — Providers Management UI

**Project:** Claims Manager  
**Date:** 2026-04-13  
**Scope:** Full-stack feature — NestJS API endpoints + Next.js frontend  
**Reference:** `repos/capabilities` admin-ui patterns (`CapabilityListPanel`, `CreateCapabilityDrawer`, `NavMain`)

---

## Overview

Add a **Providers** section to the Claims Manager UI for managing 3rd-party integration providers and monitoring their inbound webhook events. The feature spans:

- A new **"Providers"** sidebar navigation item
- A **Provider Summary List** page (card grid, search, sort, filter — modelled on `CapabilityListPanel`)
- An **"Add Provider"** button in the page title bar that opens a **bottom Sheet drawer** for creating a new provider + connection
- Clicking a provider card opens an **Edit Provider** bottom Sheet drawer with connection details and recent webhook event history
- Backend **REST endpoints** for provider CRUD and webhook event queries

---

## Data Model (existing tables)

### `integration_providers`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `code` | text | unique slug, e.g. `crunchwork` |
| `name` | text | display name |
| `is_active` | boolean | default `true` |
| `metadata` | jsonb | freeform config |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

### `integration_connections`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | text | |
| `provider_id` | uuid FK → providers | |
| `name` | text | connection label |
| `environment` | text | `staging` / `production` |
| `auth_type` | text | default `client_credentials` |
| `base_url` | text | provider API hostname |
| `auth_url` | text | token endpoint |
| `client_identifier` | text | client ID |
| `provider_tenant_id` | text | tenant at the provider |
| `credentials` | jsonb | `{ clientSecret, hmacKey, … }` |
| `webhook_secret` | text | HMAC key for webhook verification |
| `config` | jsonb | extra settings |
| `is_active` | boolean | |
| `last_sync_at` | timestamptz | |
| `created_at` / `updated_at` | timestamptz | |

### `inbound_webhook_events`

Already exists with `provider_id`, `provider_code`, `processing_status`, `event_type`, `created_at`, etc. Used for the monitoring tab inside the edit drawer.

---

## Implementation Steps

### Step 1 — API: Providers Controller & Service

**Package:** `apps/api`  
**Files:**

| File | Action |
|------|--------|
| `src/modules/providers/providers.module.ts` | Create — NestJS module |
| `src/modules/providers/providers.controller.ts` | Create — REST controller |
| `src/modules/providers/providers.service.ts` | Create — business logic |
| `src/modules/providers/dto/` | Create — request/response DTOs |
| `src/database/repositories/integration-providers.repository.ts` | Extend — add `findById`, `update`, `delete` |
| `src/database/repositories/integration-connections.repository.ts` | Extend — add `findByProviderId`, `create`, `update` |
| `src/database/repositories/inbound-webhook-events.repository.ts` | Extend — add `findByProviderId` with pagination |
| `src/app.module.ts` | Update — register `ProvidersModule` |

**Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET /api/v1/providers` | List all providers (with connection count, latest event stats) |
| `GET /api/v1/providers/:id` | Single provider with its connections |
| `POST /api/v1/providers` | Create provider + initial connection |
| `PUT /api/v1/providers/:id` | Update provider metadata |
| `DELETE /api/v1/providers/:id` | Soft-deactivate provider |
| `GET /api/v1/providers/:id/connections` | List connections for provider |
| `POST /api/v1/providers/:id/connections` | Add connection to provider |
| `PUT /api/v1/providers/:id/connections/:connId` | Update connection |
| `GET /api/v1/providers/:id/webhook-events` | Paginated webhook events for provider |

**DTOs (Zod-style validation via `class-validator`):**

```
CreateProviderDto {
  code: string          // unique slug
  name: string          // display name
  isActive?: boolean

  // Initial connection (optional — can be added later)
  connection?: {
    name: string
    environment: 'staging' | 'production'
    baseUrl: string
    authUrl?: string
    authType?: string
    clientIdentifier?: string
    providerTenantId?: string
    credentials?: { clientSecret?: string; hmacKey?: string }
    webhookSecret?: string
    config?: Record<string, unknown>
  }
}

UpdateProviderDto {
  name?: string
  isActive?: boolean
  metadata?: Record<string, unknown>
}
```

**Provider list response shape** (aggregated):

```ts
interface ProviderSummary {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  connectionCount: number;
  totalWebhookEvents: number;
  recentErrorCount: number;
  lastEventAt: string | null;
  createdAt: string;
}
```

**Log prefix:** `[ProvidersService.methodName]`, `[ProvidersController.methodName]`

---

### Step 2 — API Client: Frontend Provider Methods

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/types/api.ts` | Extend — add `Provider`, `ProviderSummary`, `ProviderConnection`, `WebhookEvent` types |
| `src/lib/api-client.ts` | Extend — add provider methods to `createApiClient` |

**Methods added to `createApiClient`:**

```ts
getProviders(params?: { search?: string; sort?: string }): Promise<ProviderSummary[]>
getProvider(id: string): Promise<Provider>
createProvider(body: CreateProviderPayload): Promise<Provider>
updateProvider(id: string, body: UpdateProviderPayload): Promise<Provider>
getProviderConnections(id: string): Promise<ProviderConnection[]>
createProviderConnection(id: string, body: CreateConnectionPayload): Promise<ProviderConnection>
updateProviderConnection(id: string, connId: string, body: UpdateConnectionPayload): Promise<ProviderConnection>
getProviderWebhookEvents(id: string, params?: { page?: number; limit?: number; status?: string }): Promise<PaginatedResponse<WebhookEvent>>
```

---

### Step 3 — Server Actions for Provider Reads & Mutations

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/app/(app)/providers/actions.ts` | Create — server actions for reads + create/update provider + connection |

Following the existing patterns from `src/app/(app)/claims/actions.ts` (reads) and `src/app/(app)/mutations.ts` (writes):

```ts
'use server';

// Reads — called by client components for dynamic re-fetching (pagination, filtering)
export async function fetchProvidersAction(params?: { search?: string }) { ... }
export async function fetchProviderAction(id: string) { ... }
export async function fetchProviderConnectionsAction(providerId: string) { ... }
export async function fetchProviderWebhookEventsAction(providerId: string, params?: { page?: number; limit?: number; status?: string }) { ... }

// Mutations
export async function createProviderAction(data: CreateProviderPayload) { ... }
export async function updateProviderAction(id: string, data: UpdateProviderPayload) { ... }
export async function createConnectionAction(providerId: string, data: CreateConnectionPayload) { ... }
export async function updateConnectionAction(providerId: string, connId: string, data: UpdateConnectionPayload) { ... }
```

Each action follows the same `getApi()` → `createApiClient({ token })` → NestJS API pattern used by `fetchClaimsAction`, `createQuoteAction`, etc. The frontend never calls the NestJS API directly from the browser — all requests go through server actions which attach the auth token server-side.

---

### Step 4 — Navigation: Add "Providers" Sidebar Item

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/components/layout/AppSidebar.tsx` | Update — add nav item |

Add to the `navItems` array:

```ts
{ title: 'Providers', href: '/providers', icon: Unplug },
```

`Unplug` is from `lucide-react` — represents integrations/connections. Place it after "Vendors" in the navigation order.

---

### Step 5 — Providers List Page (Server Component)

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/app/(app)/providers/page.tsx` | Create — RSC page |

Following the exact pattern from `vendors/page.tsx`:

- `getSession()` + `getAccessToken()` → redirect if unauthenticated
- `createApiClient({ token })` → `api.getProviders()`
- Render `<SetBreadcrumbs>` + `<ProvidersPageClient>`
- Pass `providers` data as prop to the client component

---

### Step 6 — Provider List Client Component

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/components/providers/ProvidersPageClient.tsx` | Create — client list with search, sort, cards |

**Structure** (modelled on `CapabilityListPanel` from `repos/capabilities`):

```
┌─────────────────────────────────────────────────────────┐
│  Title Bar: "Providers"                [+ Add Provider] │
├─────────────────────────────────────────────────────────┤
│  Toolbar:                                               │
│  [Sort: Name | Created | Events] [Search...] [Status ▾] │
├─────────────────────────────────────────────────────────┤
│  Card Grid (responsive auto-fill, 265–322px cards):     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│  │ Provider │ │ Provider │ │ Provider │                │
│  │ Card     │ │ Card     │ │ Card     │                │
│  └──────────┘ └──────────┘ └──────────┘                │
├─────────────────────────────────────────────────────────┤
│  Empty state / loading state                            │
└─────────────────────────────────────────────────────────┘
```

**Features:**
- Uses `EntityPanel` for the toolbar layout (search, sort, filter, action slots)
- Sort options: `name` (alpha), `created_at` (newest first), `totalWebhookEvents` (most active)
- Search: client-side filter by `name` and `code`
- Status filter: All / Active / Inactive
- "Add Provider" button in the `headerAction` slot
- Responsive card grid matching the `CapabilityListPanel` grid style: `grid-template-columns: repeat(auto-fill, minmax(265px, 322px))`
- Loading skeleton and empty state

**Provider Card** (uses `EntityCard` or a custom card):
- Icon: `Unplug` from lucide-react
- Title: provider `name`
- Subtitle: provider `code`
- Badge: active/inactive status
- Footer: `{connectionCount} connections · {totalWebhookEvents} events`
- Click handler: opens the edit drawer (not a route navigation)

---

### Step 7 — Add Provider Drawer (Bottom Sheet)

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/components/providers/ProviderFormDrawer.tsx` | Create — Sheet drawer for create/edit |

Uses the existing `Sheet` component (`@base-ui/react` dialog) with `side="bottom"`, following the same pattern as `JobFormDrawer`:

**Form fields (Provider):**
- **Name** — text input (required)
- **Code** — text input, auto-slugified from name (required, unique)
- **Active** — toggle/checkbox

**Form fields (Initial Connection — collapsible section):**
- **Connection Name** — text input (e.g. "Production")
- **Environment** — select: `staging` | `production`
- **Base URL** — text input (e.g. `https://staging-iag.crunchwork.com`)
- **Auth URL** — text input (e.g. `https://staging-iag.crunchwork.com/auth/token?grant_type=client_credentials`)
- **Client ID** — text input
- **Client Secret** — password input
- **Provider Tenant ID** — text input (insure tenant)
- **Vendor Tenant ID** — text input (stored in `credentials` or `config`)
- **HMAC Key / Webhook Secret** — password input

**Behaviour:**
- `react-hook-form` + `zod` validation (matching existing drawer pattern)
- Submit calls `createProviderAction` server action
- On success: close drawer, `router.refresh()` to re-fetch list
- Error display below form

**Sheet configuration:**
```tsx
<Sheet open={open} onOpenChange={onOpenChange}>
  <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Add Provider</SheetTitle>
    </SheetHeader>
    {/* form */}
    <SheetFooter>
      <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
      <Button type="submit" disabled={submitting}>Create Provider</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

---

### Step 8 — Edit Provider Drawer (Bottom Sheet)

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/components/providers/ProviderEditDrawer.tsx` | Create — Sheet drawer for editing provider + viewing events |

Opens when clicking a provider card in the list. Reuses `Sheet` with `side="bottom"`.

**Layout (tabbed or sectioned):**

```
┌──────────────────────────────────────────────────┐
│  Edit Provider: "Crunchwork"              [Close] │
├──────────────────────────────────────────────────┤
│  [Details]  [Connections]  [Webhook Events]       │
├──────────────────────────────────────────────────┤
│                                                  │
│  Details tab:                                     │
│    Name: [________]   Code: [________]            │
│    Active: [✓]                                    │
│    [Save Changes]                                 │
│                                                  │
│  Connections tab:                                 │
│    Connection card(s) with edit-in-place           │
│    [+ Add Connection]                             │
│                                                  │
│  Webhook Events tab:                              │
│    Status filter: [All ▾]                         │
│    Paginated table:                               │
│    | Event Type | Entity ID | Status | Time |     │
│    | ...        | ...       | ...    | ...  |     │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Details tab:**
- Same fields as the create form, pre-populated
- Submit calls `updateProviderAction`

**Connections tab:**
- Lists existing connections for this provider
- Each connection shown as an expandable card with editable fields
- "Add Connection" button opens inline form or sub-section
- Fields: name, environment, baseUrl, authUrl, clientId, clientSecret, providerTenantId, webhookSecret

**Webhook Events tab:**
- Fetches from `api.getProviderWebhookEvents(providerId, { page, limit, status })`
- Filterable by `processing_status`: all / pending / processed / failed
- Table columns: Event Type, Entity ID, Status (badge), HMAC Verified, Created At
- Pagination controls
- Click row to expand raw payload (JSON viewer)

---

### Step 9 — Webhook Events Data Loading

**Package:** `apps/frontend`  
**Files:**

| File | Action |
|------|--------|
| `src/components/providers/WebhookEventsTable.tsx` | Create — client component for paginated events table |

This component is used inside the edit drawer's "Webhook Events" tab:

- Re-fetches events via the **`fetchProviderWebhookEventsAction` server action** (defined in Step 3) — following the same pattern as `ClaimsListClient` which calls `fetchClaimsAction` for client-side pagination/search. The browser never calls the NestJS API directly.
- Uses `useState` for page/status filter (consistent with existing list patterns — no React Query)
- Displays a compact table with status badges (`pending` = yellow, `processed` = green, `failed` = red)
- Expandable rows showing `rawBodyJson` in a `<pre>` block
- Shows `processingError` inline for failed events

---

### Step 10 — Polish & Integration Testing

**Files touched across both packages:**

| Area | Task |
|------|------|
| **Navigation** | Verify "Providers" highlights correctly for `/providers` routes |
| **Breadcrumbs** | `<SetBreadcrumbs items={[{ title: 'Providers', href: '/providers' }]} />` |
| **Empty state** | Verify the list shows a friendly empty state with a CTA to add the first provider |
| **Responsive** | Test card grid at mobile/tablet/desktop breakpoints |
| **Sheet drawer** | Verify bottom sheet opens/closes cleanly, doesn't interfere with sidebar |
| **Form validation** | Unique `code` validation (server-side 409 → display error) |
| **Credentials masking** | Client secret / HMAC key shown as `••••••••` with reveal toggle |
| **Loading states** | Skeleton cards during initial load; spinner on form submit |
| **Error handling** | API errors surface as toast or inline message |
| **Webhook monitoring** | Verify events table paginates, filters, and shows correct data |

---

## File Summary

### New Files

| # | Path | Description |
|---|------|-------------|
| 1 | `apps/api/src/modules/providers/providers.module.ts` | NestJS module |
| 2 | `apps/api/src/modules/providers/providers.controller.ts` | REST endpoints |
| 3 | `apps/api/src/modules/providers/providers.service.ts` | Business logic |
| 4 | `apps/api/src/modules/providers/dto/create-provider.dto.ts` | Create DTO |
| 5 | `apps/api/src/modules/providers/dto/update-provider.dto.ts` | Update DTO |
| 6 | `apps/api/src/modules/providers/dto/create-connection.dto.ts` | Connection DTO |
| 7 | `apps/frontend/src/app/(app)/providers/page.tsx` | RSC list page |
| 8 | `apps/frontend/src/app/(app)/providers/actions.ts` | Server actions |
| 9 | `apps/frontend/src/components/providers/ProvidersPageClient.tsx` | List client component |
| 10 | `apps/frontend/src/components/providers/ProviderFormDrawer.tsx` | Create drawer |
| 11 | `apps/frontend/src/components/providers/ProviderEditDrawer.tsx` | Edit drawer |
| 12 | `apps/frontend/src/components/providers/WebhookEventsTable.tsx` | Events table |

### Modified Files

| # | Path | Change |
|---|------|--------|
| 1 | `apps/frontend/src/components/layout/AppSidebar.tsx` | Add "Providers" nav item |
| 2 | `apps/frontend/src/types/api.ts` | Add provider/connection/webhook types |
| 3 | `apps/frontend/src/lib/api-client.ts` | Add provider API methods |
| 4 | `apps/api/src/database/repositories/integration-providers.repository.ts` | Extend with `findById`, `update` |
| 5 | `apps/api/src/database/repositories/integration-connections.repository.ts` | Extend with `findByProviderId`, CRUD |
| 6 | `apps/api/src/database/repositories/inbound-webhook-events.repository.ts` | Add `findByProviderId` |
| 7 | `apps/api/src/app.module.ts` | Register `ProvidersModule` |

---

## Design Decisions

1. **Bottom Sheet (not sidebar Sheet):** The create and edit drawers use `<SheetContent side="bottom">` to match the capabilities repo's `CreateCapabilityDrawer` bottom-slide pattern, while using the claims-manager's existing `Sheet` primitive (no need to add `framer-motion`).

2. **No new routing for edit:** Clicking a provider card opens the edit drawer inline (no `/providers/:id` route). This keeps the UX snappy and consistent with the capabilities repo pattern where create/edit happen in overlays, not page navigations.

3. **Server actions for mutations:** Follows the existing `jobs/mutations.ts` pattern — server actions call `createApiClient` with the session token and proxy to the NestJS API.

4. **Client-side search/sort/filter:** The provider list is expected to be small (< 50 items), so client-side filtering in `ProvidersPageClient` is appropriate. The data is fetched server-side via RSC and passed as props.

5. **Webhook events loaded via server actions:** The events table inside the edit drawer re-fetches data by calling `fetchProviderWebhookEventsAction()` — a `'use server'` function that calls `createApiClient({ token })` → NestJS API. This matches how `ClaimsListClient` uses `fetchClaimsAction` for dynamic pagination/search. The browser never calls the NestJS API directly; all requests go through server actions. Uses plain `useState`/`useEffect` (no React Query).

6. **Credentials handling:** Secrets (client secret, HMAC key) are stored encrypted in the `credentials` jsonb column. The API never returns raw secrets in list responses; the edit form shows masked values and only sends new values when changed.

---

## Capability Repo Pattern Mapping

| Capability Repo Pattern | Claims Manager Equivalent |
|--------------------------|---------------------------|
| `CapabilityListPanel` (generic list shell) | `ProvidersPageClient` using `EntityPanel` + custom card grid |
| `CreateCapabilityDrawer` (portal + framer-motion bottom sheet) | `ProviderFormDrawer` using `Sheet` with `side="bottom"` |
| `NavMain` + `AdminSidebar` nav items array | `AppSidebar` `navItems` array |
| `useCapabilityCreate` (React Query mutation) | `createProviderAction` (server action) |
| `useListFilters` (URL search params) | Client-side `useState` (small dataset) |
| `api-client.ts` axios instance | `api-client.ts` fetch-based `createApiClient` |
| `routes.tsx` centralized routing | Next.js App Router file-based routing |
