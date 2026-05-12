# 33i — Admin Pages

## Objective

Implement the Admin group pages: Users, Documents, and Settings (with Connections migrated as a tab within Settings). Reports moves into the Admin group label-wise but keeps its existing route and implementation.

---

## Prerequisites

- Plan 33a (Sidebar Restructure) complete — stub routes at `/admin/users`, `/admin/documents`, `/admin/settings`
- Existing modules: attachments (for Documents), providers/connections (for Settings > Connections)
- Users table exists in DB schema (`users`, `user_identities`, `organization_users`)
- Reports remain at `/reports` — only the sidebar label placement changes (already handled in 33a)

---

## Steps

---

### 33i.1 Users Page

**Route:** `/admin/users`

#### API

The `users`, `user_identities`, and `organization_users` tables already exist in the schema. A dedicated API module is needed.

**Directory:** `apps/api/src/modules/users/`

```
users/
├── users.module.ts
├── users.controller.ts
└── users.service.ts
```

| Method | Route | Description |
|---|---|---|
| `GET` | `/users` | List users in the current tenant/organization |
| `GET` | `/users/:id` | Get user detail |
| `POST` | `/users/:id` | Update user (limited — name, active status) |
| `GET` | `/users/me` | Get current authenticated user profile |

**Service notes:**
- Users are scoped via `organization_users` join — only return users belonging to the current tenant's organization
- User creation/invitation is handled via the auth provider (Kinde) — the `/users` endpoints are read/update only
- The `users` table is populated by the auth flow (login callback syncs user data)

**Repository:** `apps/api/src/database/repositories/users.repository.ts`

```typescript
async findAll(params: { organizationId: string; page?; limit?; search? });
async findOne(params: { id: string });
async update(params: { id: string; data: Partial<UserUpdate> });
async findByOrganization(params: { organizationId: string });
```

Register in `database.module.ts` and `app.module.ts`.

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/admin/users/page.tsx` | Server page — fetch user list |
| `app/(app)/admin/users/actions.ts` | Server actions |
| `components/admin/UsersPageClient.tsx` | Client wrapper |
| `components/admin/UsersListClient.tsx` | User list |

**List columns:** Name, Email, Role(s), Status (Active/Inactive), Last Login, Created

**Sort options:** `full_name`, `email`, `created_at`

**Detail view:** Click a user row to expand or navigate to a detail view showing:
- Profile info (name, email, identities)
- Organization membership
- Role assignments (future: RBAC integration)
- Recent activity (tasks assigned, messages sent)

**Actions:** Deactivate user, resend invite (both depend on auth provider capabilities)

---

### 33i.2 Documents Page

**Route:** `/admin/documents`

An aggregated view of all attachments/documents across all entity types, providing a central document management interface.

#### API

The existing `attachments` controller has `GET /attachments`. Verify it supports:
- Pagination
- Filter by `related_record_type`
- Filter by `document_type_lookup_id`
- Search by `title`, `file_name`
- Sort by `created_at`, `file_name`, `file_size`

If enhancements are needed, extend `AttachmentsService.findAll()`.

Add a summary endpoint:

| Method | Route | Description |
|---|---|---|
| `GET` | `/attachments/summary` | Counts by entity type and document type |

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/admin/documents/page.tsx` | Server page |
| `app/(app)/admin/documents/actions.ts` | Server actions |
| `components/admin/DocumentsPageClient.tsx` | Client wrapper |
| `components/admin/DocumentsListClient.tsx` | Document browser |

**Layout:**

1. **Summary cards** at top — total documents, by entity type (Claims, Jobs, Quotes, etc.)
2. **Filter bar:** Entity type, document type, date range, search
3. **Document table:** File Name, Title, Entity (type + reference), Document Type, Size, Uploaded By, Date
4. **Actions per row:** Download, view entity, delete (with confirmation)

**Upload:** A global "Upload Document" action that allows:
- Select target entity type + entity (search picker)
- Select document type (from `document_type` lookup domain)
- File upload

---

### 33i.3 Settings Page

**Route:** `/admin/settings`

A tab-based settings page that consolidates configuration and integrations.

#### Frontend

**Files:**

| File | Purpose |
|---|---|
| `app/(app)/admin/settings/page.tsx` | Server page with tab routing |
| `components/admin/SettingsPageClient.tsx` | Tab-based client layout |
| `components/admin/settings/GeneralTab.tsx` | General settings |
| `components/admin/settings/ConnectionsTab.tsx` | Migrated Connections content |
| `components/admin/settings/IntegrationsTab.tsx` | API keys, webhook config |
| `components/admin/settings/NotificationsTab.tsx` | Notification preferences |

**Tab routing:** URL-synced via `?tab=` query param (same pattern as Job detail).

#### Tabs

**General tab:**
- Tenant/organization details (name, code, logo)
- Timezone and locale settings
- Placeholder for future: branding, custom fields

**Connections tab:**
- **Migrates existing Connections page** (`/connections`) content
- Reuse `ConnectionsPageClient` component from `components/connections/`
- Shows provider connections with status, webhook event counts
- Connection detail: either inline expand or navigate to `/connections/[id]` (keep detail route working)
- Webhook event log per connection

Implementation approach:
```tsx
// components/admin/settings/ConnectionsTab.tsx
import { ConnectionsPageClient } from '@/components/connections/ConnectionsPageClient';

export function ConnectionsTab({ initialConnections }: Props) {
  return <ConnectionsPageClient initialData={initialConnections} embedded />;
}
```

Add an `embedded` prop to `ConnectionsPageClient` that:
- Hides the page header (since it's within the Settings page)
- Uses the settings page's breadcrumb context

**Integrations tab:**
- API key management (placeholder — show tenant API keys if implemented)
- Webhook endpoint configuration (placeholder)
- External system integrations overview

**Notifications tab:**
- Email notification preferences per event type (placeholder)
- In-app notification settings (placeholder)

#### Redirect from /connections

As specified in 33a, the existing `/connections` page.tsx becomes a redirect:

```tsx
import { redirect } from 'next/navigation';
export default function ConnectionsRedirect() {
  redirect('/admin/settings?tab=connections');
}
```

The `/connections/[id]` detail route remains functional for deep links and can be accessed from the Connections tab.

---

### 33i.4 Reports (No Changes Needed)

Reports keeps its existing route (`/reports`) and implementation. The only change was in plan 33a — moving it under the ADMIN group label in the sidebar. No code changes needed here.

---

## Acceptance Criteria

- [ ] `/admin/users` lists organization users with search and sort
- [ ] User detail shows profile, organization membership, role info
- [ ] `/admin/documents` shows aggregated document browser across all entity types
- [ ] Document filters work (entity type, document type, search)
- [ ] Document upload works with entity picker
- [ ] `/admin/settings` renders tab-based settings page
- [ ] Settings General tab shows tenant info (placeholder OK for initial build)
- [ ] Settings Connections tab reuses existing Connections components
- [ ] `/connections` redirects to `/admin/settings?tab=connections`
- [ ] `/connections/[id]` detail route still works for deep links
- [ ] Settings Integrations and Notifications tabs render (placeholder OK)
- [ ] `/reports` continues to work under ADMIN group in sidebar

---

## File Summary

| Directory | Files |
|---|---|
| `modules/users/` (API) | `users.module.ts`, `users.controller.ts`, `users.service.ts` |
| `repositories/` (API) | `users.repository.ts` |
| `app/(app)/admin/users/` | `page.tsx`, `actions.ts` |
| `app/(app)/admin/documents/` | `page.tsx`, `actions.ts` |
| `app/(app)/admin/settings/` | `page.tsx` |
| `components/admin/` | `UsersPageClient.tsx`, `UsersListClient.tsx`, `DocumentsPageClient.tsx`, `DocumentsListClient.tsx`, `SettingsPageClient.tsx` |
| `components/admin/settings/` | `GeneralTab.tsx`, `ConnectionsTab.tsx`, `IntegrationsTab.tsx`, `NotificationsTab.tsx` |

---

*Next: 33j_DASHBOARD_ENHANCEMENT.md*
