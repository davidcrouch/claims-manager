# 33a — Sidebar Restructure (Frontend Only)

## Objective

Reorganize `AppSidebar.tsx` from a flat nav list into grouped sections using `SidebarGroupLabel`, matching the Contractor (Prime) role layout. New routes that lack backend/page implementations get "Coming Soon" stub pages.

---

## Prerequisites

- Plan 25b (Layout & Navigation) complete — `AppSidebar`, `AppShell`, `SidebarGroupLabel` all exist
- All existing entity pages functional at current routes

---

## Steps

### 33a.1 Create "Coming Soon" Placeholder Component

**File:** `apps/frontend/src/components/shared/ComingSoon.tsx`

```tsx
'use client';

import { Construction } from 'lucide-react';

interface ComingSoonProps {
  title: string;
  description?: string;
}

export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <Construction className="size-12 text-muted-foreground/40" />
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
```

---

### 33a.2 Restructure Sidebar Nav Config

**File:** `apps/frontend/src/components/layout/AppSidebar.tsx`

Replace the flat `navItems` array with a grouped structure:

```typescript
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  FileSpreadsheet,
  ClipboardCheck,
  Receipt,
  ShoppingCart,
  FileQuestion,
  FileInput,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  CheckSquare,
  Calendar,
  MessageSquare,
  CalendarCheck,
  Users,
  UserCog,
  ClipboardList,
  FolderOpen,
  Settings,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CUSTOMERS',
    items: [
      { title: 'Jobs', href: '/jobs', icon: Briefcase },
      { title: 'Estimates/Quotes', href: '/quotes', icon: FileSpreadsheet },
      { title: 'Work Orders', href: '/work-orders', icon: ClipboardCheck },
      { title: 'Invoices', href: '/invoices', icon: Receipt },
      { title: 'Claims', href: '/claims', icon: FileText },
    ],
  },
  {
    label: 'VENDORS',
    items: [
      { title: 'RFQs', href: '/rfqs', icon: FileQuestion },
      { title: 'Proposals', href: '/proposals', icon: FileInput },
      { title: 'POs', href: '/purchase-orders', icon: ShoppingCart },
      { title: 'Bills', href: '/bills', icon: ReceiptText },
    ],
  },
  {
    label: 'FINANCE',
    items: [
      { title: 'Accounts Receivable', href: '/finance/ar', icon: TrendingUp },
      { title: 'Accounts Payable', href: '/finance/ap', icon: TrendingDown },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { title: 'Tasks', href: '/tasks', icon: CheckSquare },
      { title: 'Schedule', href: '/schedule', icon: Calendar },
      { title: 'Messages', href: '/messages', icon: MessageSquare },
      { title: 'Appointments', href: '/appointments', icon: CalendarCheck },
      { title: 'Contacts', href: '/contacts', icon: Users },
    ],
  },
  {
    label: 'ADMIN',
    items: [
      { title: 'Users', href: '/admin/users', icon: UserCog },
      { title: 'Reports', href: '/reports', icon: ClipboardList },
      { title: 'Documents', href: '/admin/documents', icon: FolderOpen },
      { title: 'Settings', href: '/admin/settings', icon: Settings },
    ],
  },
];
```

### 33a.3 Update Sidebar Rendering

**File:** `apps/frontend/src/components/layout/AppSidebar.tsx`

Add `SidebarGroupLabel` to the import from `@/components/ui/sidebar`. Replace the single `SidebarGroup` render block with a loop over `navGroups`:

```tsx
<SidebarContent>
  {navGroups.map((group, gi) => (
    <SidebarGroup key={group.label ?? 'top'}>
      {group.label && (
        <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {group.items.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' &&
                pathname.startsWith(item.href));
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  render={
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  }
                  isActive={isActive}
                  tooltip={item.title}
                />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ))}
</SidebarContent>
```

---

### 33a.4 Create Stub Pages for New Routes

Each new route needs a minimal `page.tsx` under `apps/frontend/src/app/(app)/`. All stub pages use the `ComingSoon` component and `SetPageHeader`.

**Routes to create:**

| Route | Directory | Title |
|---|---|---|
| `/work-orders` | `work-orders/` | Work Orders |
| `/rfqs` | `rfqs/` | RFQs |
| `/proposals` | `proposals/` | Proposals |
| `/bills` | `bills/` | Bills |
| `/finance/ar` | `finance/ar/` | Accounts Receivable |
| `/finance/ap` | `finance/ap/` | Accounts Payable |
| `/tasks` | `tasks/` | Tasks |
| `/schedule` | `schedule/` | Schedule |
| `/messages` | `messages/` | Messages |
| `/appointments` | `appointments/` | Appointments |
| `/contacts` | `contacts/` | Contacts |
| `/admin/users` | `admin/users/` | Users |
| `/admin/documents` | `admin/documents/` | Documents |
| `/admin/settings` | `admin/settings/` | Settings |

**Stub page template** (example for `/work-orders`):

```tsx
// apps/frontend/src/app/(app)/work-orders/page.tsx
import { ComingSoon } from '@/components/shared/ComingSoon';

export const metadata = { title: 'Work Orders — EnsureOS' };

export default function WorkOrdersPage() {
  return (
    <ComingSoon
      title="Work Orders"
      description="Work order management is coming soon. You'll be able to view and manage work directives received from upstream parties."
    />
  );
}
```

Each stub follows this pattern with entity-specific title and description.

---

### 33a.5 Redirect /connections to Settings

**File:** `apps/frontend/src/app/(app)/connections/page.tsx`

Add a redirect from the existing `/connections` route to `/admin/settings?tab=connections` using Next.js `redirect()`:

```tsx
import { redirect } from 'next/navigation';

export default function ConnectionsRedirect() {
  redirect('/admin/settings?tab=connections');
}
```

The `/connections/[id]` detail route can remain functional for now (deep links from webhook events, etc.) and will be migrated to a modal/drawer within Settings in plan 33i.

---

### 33a.6 Active-State Matching Refinement

The `isActive` logic needs refinement for nested routes like `/finance/ar` and `/admin/users`. Update the matching:

```typescript
const isActive = (() => {
  if (pathname === item.href) return true;
  if (item.href === '/dashboard') return false;
  return pathname.startsWith(item.href + '/');
})();
```

This prevents `/finance/ar` from matching when on `/finance/ap` (the old `startsWith` without trailing slash would match both).

---

## Verification

- [ ] Sidebar renders Dashboard above 5 labeled groups (CUSTOMERS, VENDORS, FINANCE, OPERATIONS, ADMIN)
- [ ] All existing pages still work at their current routes (`/jobs`, `/claims`, `/quotes`, `/purchase-orders`, `/invoices`, `/reports`)
- [ ] "Estimates/Quotes" label links to `/quotes`, "POs" label links to `/purchase-orders`
- [ ] New routes show "Coming Soon" placeholder pages
- [ ] Sidebar collapses to icon-only correctly; group labels hide in collapsed mode
- [ ] Active-state highlighting works for all items including nested routes
- [ ] `/connections` redirects to `/admin/settings?tab=connections`
- [ ] Reports accessible at `/reports` under ADMIN group

---

## File Summary

| File | Purpose |
|---|---|
| `components/shared/ComingSoon.tsx` | Placeholder component for unbuilt pages |
| `components/layout/AppSidebar.tsx` | Grouped nav config + rendering |
| `app/(app)/work-orders/page.tsx` | Stub |
| `app/(app)/rfqs/page.tsx` | Stub |
| `app/(app)/proposals/page.tsx` | Stub |
| `app/(app)/bills/page.tsx` | Stub |
| `app/(app)/finance/ar/page.tsx` | Stub |
| `app/(app)/finance/ap/page.tsx` | Stub |
| `app/(app)/tasks/page.tsx` | Stub |
| `app/(app)/schedule/page.tsx` | Stub |
| `app/(app)/messages/page.tsx` | Stub |
| `app/(app)/appointments/page.tsx` | Stub |
| `app/(app)/contacts/page.tsx` | Stub |
| `app/(app)/admin/users/page.tsx` | Stub |
| `app/(app)/admin/documents/page.tsx` | Stub |
| `app/(app)/admin/settings/page.tsx` | Stub |
| `app/(app)/connections/page.tsx` | Redirect to Settings |

---

*Next: 33b_WORK_ORDERS_MODULE.md*
