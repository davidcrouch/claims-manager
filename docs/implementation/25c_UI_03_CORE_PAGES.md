# 25c — UI Plan C: Core Pages

## Objective

Implement the Landing page, Dashboard, Claims list/detail, and Jobs list/detail with **SSR** — server components fetch data from the API, pass to presentational components. Client components handle search, sort, filter.

---

## Prerequisites

- Plans A & B complete: API client, auth, layout, sidebar, EntityPanel, EntityCard, Breadcrumbs

---

## 1. Landing Page

### 1.1 Route

- `(marketing)/page.tsx` → `/`

### 1.2 Rendering

- **SSG** (default): Static, no data fetch. Good for SEO, fast TTFB.

### 1.3 Content (per UI spec §3.1.1)

- Hero section
- Marketing content
- Login / Register buttons → Kinde hosted auth (`/api/auth/login`, `/api/auth/register`)
- Pricing (future placeholder)

### 1.4 Implementation

- Server component (or static)
- Use `Link` to Kinde auth routes
- No API calls

---

## 2. Dashboard Page

### 2.1 Route

- `(app)/dashboard/page.tsx` → `/dashboard`

### 2.2 Rendering

- **SSR**: Fetch data on each request (or with `revalidate` for ISR)

### 2.3 Data Fetching

```tsx
// app/(app)/dashboard/page.tsx
export default async function DashboardPage() {
  const session = await getKindeServerSession();
  const api = createApiClient({ token: session.accessToken, tenantId: session.orgId });
  const [stats, recentActivity] = await Promise.all([
    api.getDashboardStats(),
    api.getDashboardRecentActivity(20),
  ]);
  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Dashboard', href: '/dashboard' }]} />
      <DashboardContent stats={stats} recentActivity={recentActivity} />
    </>
  );
}
```

### 2.4 Components (per UI spec §3.2.1)

- **KPI widgets** (cards): Claim count, Job count, Pending approvals, Open invoices
- **Recent activity** (list): Recent jobs, new quotes, new reports
- **Alerts** (banner/list): New jobs, approvals needed — placeholder or from `recentActivity`

### 2.5 API Mapping

- `GET /dashboard/stats` → `stats`
- `GET /dashboard/recent-activity?limit=20` → `recentActivity`

### 2.6 Loading

- `dashboard/loading.tsx` — skeleton for KPI cards and activity list

### 2.7 Metadata

```tsx
export const metadata = { title: 'Dashboard | Claims Manager' };
```

---

## 3. Claims List Page

### 3.1 Route

- `(app)/claims/page.tsx` → `/claims`

### 3.2 Rendering Strategy

- **SSR for initial load**: Fetch first page of claims on server
- **Client for search/sort/filter**: User interactions trigger client-side fetch (React Query or SWR) or client component with `useEffect`

**Hybrid approach:**

- Server: Fetch initial list (e.g. `page=1`, `limit=20`, no search)
- Client: `ClaimsListClient` wraps the list; receives `initialData` from server. On search/sort/filter change, refetch via API client. Use `useState` for search/sort/filter; debounce search 300ms.

### 3.3 Page Structure

```tsx
// app/(app)/claims/page.tsx
export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; sort?: string; status?: string }>;
}) {
  const params = await searchParams;
  const session = await getKindeServerSession();
  const api = createApiClient({ token: session.accessToken, tenantId: session.orgId });
  const initialClaims = await api.getClaims({
    page: parseInt(params.page ?? '1', 10),
    limit: 20,
    search: params.search,
    sort: params.sort,
    status: params.status,
  });
  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Claims', href: '/claims' }]} />
      <ClaimsListClient initialData={initialClaims} />
    </>
  );
}
```

- **Note:** If API client doesn't support `sort`/`status` yet, pass what's available. Use `searchParams` for URL-driven state (shareable, back-button friendly).

### 3.4 ClaimsListClient (client component)

- Renders `EntityPanel` with:
  - Search: "Search claims by claim number or external reference...", debounced 300ms
  - Sort: `claimNumber`, `lodgementDate`, `status`, `updatedAt` — `SortButton` with ArrowUp/ArrowDown
  - Filters: `status` (multi-select), `account` (optional)
- Renders `EntityCard` per claim:
  - Icon: FileText, accent `border-l-blue-500`
  - Title: `claimNumber` or `externalReference`
  - Subtitle: Address (`streetNumber streetName, suburb`)
  - TopRight: `StatusBadge` (status.name)
  - Footer: `lodgementDate`, `account.name`
- Click: `Link` to `/claims/[id]`

### 3.5 API

- `GET /claims?page=&limit=&search=` (add `sort`, `status` if API supports)

### 3.6 Loading

- `claims/loading.tsx` — skeleton for EntityPanel + card grid

---

## 4. Claim Detail Page

### 4.1 Route

- `(app)/claims/[id]/page.tsx` → `/claims/{id}`

### 4.2 Rendering

- **SSR**: Fetch claim on server. Include `generateMetadata` for dynamic title.

### 4.3 Data Fetching

```tsx
export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getKindeServerSession();
  const api = createApiClient({ token: session.accessToken, tenantId: session.orgId });
  const claim = await api.getClaim(id);
  if (!claim) notFound();
  return (
    <>
      <SetBreadcrumbs items={[
        { title: 'Claims', href: '/claims' },
        { title: claim.claimNumber ?? claim.externalReference ?? id, href: `/claims/${id}` },
      ]} />
      <ClaimDetail claim={claim} />
    </>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getKindeServerSession();
  const api = createApiClient({ token: session.accessToken, tenantId: session.orgId });
  const claim = await api.getClaim(id);
  return { title: `${claim?.claimNumber ?? claim?.externalReference ?? id} | Claims Manager` };
}
```

### 4.4 ClaimDetail Component (per UI spec §3.3.2)

- **Header:** Claim number, status badge, address
- **Sections (read-only):**
  - Address (unitNumber, streetNumber, streetName, suburb, postcode, state, country)
  - Policy (policyName, policyNumber, policyType, policyInceptionDate)
  - Loss (lossType, lossSubType, dateOfLoss, incidentDescription)
  - Contacts (firstName, lastName, email, type, mobilePhone)
  - Assignees
- **Linked Jobs:** Table or card list; link to `/jobs/{jobId}`

### 4.5 API

- `GET /claims/:id` (includes jobs when available)

### 4.6 Loading & Not Found

- `claims/[id]/loading.tsx`
- `notFound()` triggers `not-found.tsx` if claim not found

---

## 5. Jobs List Page

### 5.1 Route

- `(app)/jobs/page.tsx` → `/jobs`

### 5.2 Rendering

- Same hybrid as Claims: SSR initial load, client for search/sort/filter

### 5.3 Page Structure

```tsx
export default async function JobsPage({ searchParams }: ...) {
  const params = await searchParams;
  const api = createApiClient(...);
  const initialJobs = await api.getJobs({ page: 1, limit: 20, ... });
  return (
    <>
      <SetBreadcrumbs items={[{ title: 'Jobs', href: '/jobs' }]} />
      <JobsListClient initialData={initialJobs} headerAction={<CreateJobButton />} />
    </>
  );
}
```

### 5.4 JobsListClient

- **EntityPanel** with:
  - Search: "Search jobs by external reference or address..."
  - Sort: `requestDate`, `status`, `jobType`, `updatedAt`
  - Filters: `status`, `jobType`
- **EntityCard** per job:
  - Icon: Briefcase, accent `border-l-amber-500`
  - Title: `externalReference` or job id
  - Subtitle: Address from claim
  - TopRight: `StatusBadge` (status.name)
  - Footer: `jobType.name`, `requestDate`, link to claim
- **Header action:** "Create Job" button → opens `JobFormDrawer` (Plan E)
- Click: Navigate to `/jobs/[id]`

### 5.5 API

- `GET /jobs?page=&limit=&search=`

---

## 6. Job Detail Page

### 6.1 Route

- `(app)/jobs/[id]/page.tsx` → `/jobs/{id}`

### 6.2 Rendering

- **SSR** for Overview tab data (`GET /jobs/:id`)
- **Client** for tab content: Quotes, POs, Tasks, Messages, Reports — each tab fetches its own data on select (or prefetch Overview only, lazy-load others)

### 6.3 Data Fetching

```tsx
export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const api = createApiClient(...);
  const job = await api.getJob(id);
  if (!job) notFound();
  return (
    <>
      <SetBreadcrumbs items={[
        { title: 'Jobs', href: '/jobs' },
        { title: job.externalReference ?? id, href: `/jobs/${id}` },
      ]} />
      <JobDetail job={job} />
    </>
  );
}
```

### 6.4 JobDetail Component (per UI spec §3.4.2)

- **Tabs:** Overview, Quotes, POs, Tasks, Messages, Reports, Status (Vendor)
- **Overview tab (SSR):** Job type, status, external reference, address, claim link, vendor, jobInstructions, makeSafeRequired, collectExcess, excess, appointments
- **Other tabs:** Client components that fetch on tab switch:
  - Quotes: `GET /jobs/:id/quotes`
  - POs: `GET /jobs/:jobId/purchase-orders`
  - Tasks: `GET /jobs/:jobId/tasks`
  - Messages: `GET /jobs/:jobId/messages`
  - Reports: `GET /jobs/:jobId/reports`
  - Status: Form for `POST /jobs/:id/status` (Vendor)

### 6.5 Tab Content Components

- Each tab: Client component with `useEffect` or React Query to fetch when active
- Or: Use URL hash/query for tab state (`?tab=quotes`) to enable direct linking

### 6.6 API

- Overview: `GET /jobs/:id`
- Sub-resources: `GET /jobs/:id/quotes`, etc.

---

## 7. Shared Patterns

### 7.1 SetBreadcrumbs

- Client component that calls `useBreadcrumbs().setItems(items)` in `useEffect`
- Used at top of each page

### 7.2 Error Handling

- API 404 → `notFound()`
- API 401 → redirect to login (middleware or API client)
- Other errors → throw for `error.tsx` boundary

### 7.3 Revalidation

- Use `revalidate = 60` (or similar) in page if ISR desired for list/detail pages
- Dashboard: `revalidate = 30` for fresher KPIs

---

## Verification

- [ ] Landing page loads, Login/Register work
- [ ] Dashboard shows KPIs and recent activity (SSR)
- [ ] Claims list loads with initial data (SSR), search/sort/filter work (client)
- [ ] Claim detail loads with full data (SSR), metadata has claim number
- [ ] Jobs list loads (SSR), Create Job button present
- [ ] Job detail loads (SSR), tabs switch and load sub-resources
- [ ] Loading states show during navigation
- [ ] 404 for invalid claim/job id

---

## File Summary

| File | Purpose |
|------|---------|
| `app/(marketing)/page.tsx` | Landing (SSG) |
| `app/(app)/dashboard/page.tsx` | Dashboard (SSR) |
| `app/(app)/dashboard/loading.tsx` | Dashboard skeleton |
| `app/(app)/claims/page.tsx` | Claims list (SSR + client) |
| `app/(app)/claims/loading.tsx` | Claims list skeleton |
| `app/(app)/claims/[id]/page.tsx` | Claim detail (SSR) |
| `app/(app)/claims/[id]/loading.tsx` | Claim detail skeleton |
| `app/(app)/jobs/page.tsx` | Jobs list (SSR + client) |
| `app/(app)/jobs/loading.tsx` | Jobs list skeleton |
| `app/(app)/jobs/[id]/page.tsx` | Job detail (SSR + tabs) |
| `app/(app)/jobs/[id]/loading.tsx` | Job detail skeleton |
| `components/dashboard/*` | KPI widgets, activity list |
| `components/claims/ClaimCard.tsx` | Card for list |
| `components/claims/ClaimDetail.tsx` | Detail sections |
| `components/claims/ClaimsListClient.tsx` | Client list with search/sort/filter |
| `components/jobs/JobCard.tsx` | Card for list |
| `components/jobs/JobDetail.tsx` | Tabs + content |
| `components/jobs/JobsListClient.tsx` | Client list |

---

*Next: 25d_UI_04_ENTITY_MODULES.md*
