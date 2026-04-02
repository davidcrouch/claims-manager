# 25b — UI Plan B: Layout & Navigation

## Objective

Implement the app shell, collapsible sidebar, top bar (tenant selector, user menu, notifications), breadcrumbs, and route structure per UI spec §1.1, §2.

---

## Prerequisites

- Plan A (25a_UI_01_FOUNDATION) complete: API client, auth, design system, `EntityPanel`, `EntityCard`, `Breadcrumbs`

---

## Steps

### 1. Route Group Structure

**1.1 Create route groups**

```
src/app/
├── (marketing)/           # Public
│   ├── layout.tsx         # Marketing layout (no sidebar)
│   └── page.tsx           # Landing at /
├── (app)/                 # Authenticated
│   ├── layout.tsx         # App layout with sidebar
│   ├── loading.tsx
│   ├── error.tsx
│   ├── dashboard/
│   ├── claims/
│   ├── jobs/
│   ├── quotes/
│   ├── purchase-orders/
│   ├── invoices/
│   ├── reports/
│   └── vendors/
└── layout.tsx             # Root layout (fonts, providers)
```

**1.2 Root layout**

- Wrap with `AuthProvider` (Kinde)
- Include global styles, font

---

### 2. Marketing Layout

**2.1 `(marketing)/layout.tsx`**

- Full-width layout, no sidebar
- Optional: simple header with logo, Login/Register buttons → Kinde
- Content area for hero, marketing content, pricing placeholder

---

### 3. App Layout (Authenticated)

**3.1 Grid layout (per UI spec §1.1)**

- `7% header / 93% content` — top bar 7%, main content 93%
- Use CSS Grid: `grid-template-rows: 7% 1fr` or equivalent (e.g. `min-height` for header)

**3.2 Create `components/layout/AppShell.tsx`**

- Props: `sidebar`, `header`, `children`
- Structure:
  ```
  <div className="grid grid-rows-[auto_1fr] min-h-screen">
    <header>...</header>
    <div className="flex">
      <aside>...</aside>
      <main className="flex-1">...</main>
    </div>
  </div>
  ```

**3.3 Create `components/layout/AppSidebar.tsx`**

- Collapsible sidebar (per UI spec §1.4)
- Variants: expanded (full width) / collapsed (icon-only)
- Use `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter` (shadcn sidebar or custom)
- `NavMain` with `NavItem[]`: `{ title, href, icon }`

**3.4 Sidebar nav items (per UI spec §2.1)**

| Nav Item | Route | Icon |
|----------|-------|------|
| Dashboard | `/dashboard` | LayoutDashboard |
| Claims | `/claims` | FileText |
| Jobs | `/jobs` | Briefcase |
| Quotes | `/quotes` | FileSpreadsheet |
| Purchase Orders | `/purchase-orders` | ShoppingCart |
| Invoices | `/invoices` | Receipt |
| Reports | `/reports` | ClipboardList |
| Vendors | `/vendors` | Building2 |

- Messages: Option B per spec — only in Job context; omit from top-level nav for now

**3.5 Create `components/layout/AppHeader.tsx`**

- Top bar content:
  - **Breadcrumbs** (left): `BreadcrumbItem[]` with `title`, `href`
  - **Actions** (right): Tenant selector, Notifications bell, User menu

**3.6 Breadcrumbs integration**

- Breadcrumbs are page-specific; pass from layout or page
- Use React context or layout slot: `BreadcrumbProvider` with `useBreadcrumbs()` to set breadcrumbs from each page
- Alternative: Each page renders `<Breadcrumbs items={[...]} />` in a shared header slot

**3.7 Tenant selector**

- Dropdown showing `active-tenant-id` (tenant name)
- Source: Auth context or API; if multi-tenant, fetch user's orgs/tenants
- Store selection in cookie or context; pass to API client as `x-tenant-id`

**3.8 User menu**

- Avatar, user name, logout
- Use Kinde's `LogoutLink` or equivalent
- Dropdown: Profile (placeholder), Logout

**3.9 Notifications**

- Bell icon; placeholder for webhook-driven alerts (new jobs, approvals needed)
- Can be static for now; wire to real data in later phase

---

### 4. App Layout Composition

**4.1 `(app)/layout.tsx`**

```tsx
// Server component
export default function AppLayout({ children }) {
  return (
    <AppShell
      sidebar={<AppSidebar />}
      header={<AppHeader breadcrumbs={[]} />}  // Breadcrumbs from page context
    >
      {children}
    </AppShell>
  );
}
```

- **Breadcrumbs challenge:** Layout is shared; breadcrumbs vary per page.
- **Solution:** Use a client component `BreadcrumbSlot` that reads from context. Each page (or a wrapper) calls `setBreadcrumbs(items)` on mount. Or: use `children` with a pattern where the first child is a fragment that provides breadcrumbs via context.

- **Simpler approach:** Each page passes breadcrumbs as a prop to a layout that accepts `breadcrumbs` from a parallel route or slot. Next.js App Router supports `@breadcrumbs` parallel route:
  - Create `(app)/@breadcrumbs/default.tsx` with default breadcrumbs
  - Each page segment can override via its own `@breadcrumbs/page.tsx` or by rendering a layout that reads from a store/context set by the page.

- **Pragmatic approach:** `AppHeader` accepts `breadcrumbs` as optional prop. Use a client-side `BreadcrumbContext`; each page (client or server) wraps content in a provider that sets breadcrumbs. The layout includes `<BreadcrumbConsumer />` in the header. Pages call `useBreadcrumbs().setItems([...])` in a client child.

- **Simplest:** Each page exports or renders its breadcrumbs. Use a layout that receives `children` and a `breadcrumbs` slot via a wrapper. Since Next.js doesn't have slots, use:
  - **Option A:** Layout reads breadcrumbs from a React context. A client `BreadcrumbProvider` wraps `children`. Each page includes `<SetBreadcrumbs items={[...]} />` (client component that calls `setItems` on mount).
  - **Option B:** Layout renders a fixed header; breadcrumbs are passed via a separate mechanism (e.g. route segment config or a global store). Complex.
  - **Option C:** Each page is responsible for rendering the full layout including breadcrumbs. That would duplicate the shell — not ideal.

- **Recommended:** `BreadcrumbProvider` (client) at app layout. Each page has a small client component `PageBreadcrumbs` that calls `useBreadcrumbs().setItems([...])` in `useEffect`. The `AppHeader` reads from the same context and renders the breadcrumbs. Layout stays server; breadcrumb setter is client.

---

### 5. Loading & Error States

**5.1 `(app)/loading.tsx`**

- Skeleton or spinner for the content area
- Sidebar and header can remain visible

**5.2 `(app)/error.tsx`**

- Error boundary UI
- "Something went wrong" + retry button
- Use `reset()` from error boundary props

---

### 6. Auth Guard

**6.1 Middleware**

- In `middleware.ts`, protect `/(app)/*` — redirect to `/` or Kinde login if unauthenticated
- Allow `/(marketing)/*`, `/api/auth/*` (Kinde callbacks)

---

## Verification

- [ ] Navigate to `/` — marketing layout, no sidebar
- [ ] Navigate to `/dashboard` (authenticated) — app layout with sidebar, header, breadcrumbs
- [ ] Sidebar collapses to icon-only
- [ ] Nav items link to correct routes
- [ ] Tenant selector, user menu, notifications render
- [ ] Loading state shows during navigation
- [ ] Unauthenticated access to `/dashboard` redirects to login

---

## File Summary

| File | Purpose |
|------|---------|
| `components/layout/AppShell.tsx` | Grid layout, sidebar + main |
| `components/layout/AppSidebar.tsx` | Collapsible nav |
| `components/layout/AppHeader.tsx` | Breadcrumbs, tenant, user, notifications |
| `components/layout/BreadcrumbProvider.tsx` | Context for breadcrumbs |
| `app/(marketing)/layout.tsx` | Public layout |
| `app/(app)/layout.tsx` | App layout with shell |
| `app/(app)/loading.tsx` | Loading UI |
| `app/(app)/error.tsx` | Error boundary |

---

*Next: 25c_UI_03_CORE_PAGES.md*