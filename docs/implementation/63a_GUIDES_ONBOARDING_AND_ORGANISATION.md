# 63a — Guides: Onboarding & Organisation

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Depends on:** `62_ONLINE_HELP_SYSTEM.md`  
**Priority:** P0 — unblocks first-run and admin support questions

---

## Objective

Ship the five guides that sit next to the already-complete **Roles & Permissions** guide: first-run navigation, the dashboard inbox, and the remaining Organisation admin pages.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `docs/guides/operations/getting-started.md` | `getting-started` | `/dashboard` | all |
| `docs/guides/operations/dashboard.md` | `dashboard` | `/dashboard` | member |
| `docs/guides/configuration/organisation/managing-users.md` | `managing-users` | `/admin/users` | manager |
| `docs/guides/configuration/organisation/company-settings.md` | `company-settings` | `/admin/settings` | manager |
| `docs/guides/configuration/organisation/organisation-claims.md` | `organisation-claims` | `/admin/claims` | admin |

`getting-started` and `dashboard` **share** `/dashboard`. That is intentional: **?** on Dashboard may return both; Help Assistant should open the best match (`dashboard` for “how does this inbox work”, `getting-started` when the user is clearly new). Pin `dashboard` as the `open_help_guide` default for this route by listing it first in search ranking if needed — in practice the skill picks the best metadata match. Give `getting-started` a description that mentions onboarding/navigation so free-form “how do I get started” finds it.

**Do not** put `/` on these guides (marketing landing).

---

## 1. Getting Started

**Sources:** `AppSidebar.tsx`, `AppHeader.tsx`, `AppShell.tsx` (job context, **?**), `docs/implementation/ui/00_OVERVIEW.md` (layout only — verify live), gold-standard callout style.

### Outline

1. Intro — EnsureOS is claims/jobs operations for your organisation.
2. Key Concepts — organisation/tenant, sidebar groups (Customers, Vendors, Operations, Finance), Admin (gear), job context (`?jobId=`), AI chat vs **?** help.
3. Signing in — land on Dashboard.
4. Finding your way — sidebar groups; collapsing; gear → Admin Settings.
5. Job-scoped lists — selecting a job filters Journals, Assessments, Estimates, etc. (jobFilterable items).
6. Asking for help — **?** on the right of the header (after notifications); chat can search all guides.
7. Where to go next — table linking Dashboard, Claims, Jobs, Assessments, Estimates, Users/Roles.
8. Best practices — least privilege (point at Roles), don’t skip Dashboard decisions.

### Permissions / related

- `permissions_discussed`: none required (all authenticated users).
- `related_guides`: `dashboard`, `claims-overview`, `jobs-overview`, `managing-users`, `roles-and-permissions`.
- `tags`: onboarding, navigation, help, sidebar.

### UI to name accurately

- Gear icon → Admin Settings.
- Header **?** (Help).
- Chat drawer (do not document agent picker internals).

---

## 2. Dashboard

**Sources:** `dashboard/page.tsx`, `DashboardInboxClient.tsx`, `DashboardSnapshotBar.tsx`, `docs/implementation/ui/01_DASHBOARD.md`, `21_DASHBOARD_AGGREGATION.md`. Ignore superseded KPI-grid in `33j`.

### Outline

1. Intro — ops inbox, not a KPI scoreboard.
2. Key Concepts — snapshot bar, decision queues, Today vs Schedule, unread, active jobs (yours vs team).
3. Accessing — sidebar **Dashboard**.
4. Snapshot bar — Active jobs, Needs action, Unread, AR overdue, AP overdue (deep-links).
5. Active jobs list — status, type, address; **View all** → `/jobs`.
6. Rail — Today (`/schedule`), Needs a decision (work orders to accept, proposals to review, RFQs awaiting, estimates to publish), overdue tasks, My tasks (only when assigned to you), unread → Communications.
7. Empty states — “all clear” subtitle.
8. Best practices — start the day here; don’t ignore overdue AR/AP tiles.

### Permissions / related

- `permissions_discussed`: implicit read of jobs/tasks/finance as the user’s roles allow; mention tiles may be empty without `finance.read`.
- `related_guides`: `getting-started`, `tasks`, `schedule`, `communications-overview`, `accounts-receivable`, `accounts-payable`, `work-orders-overview`, `estimates-overview`.
- `tags`: dashboard, inbox, decisions, onboarding.

---

## 3. Managing Users

**Sources:** `UsersListClient.tsx`, `InviteUserDrawer.tsx`, `EditUserRolesDrawer.tsx`, `admin/users/actions.ts`. Roles guide already describes assigning roles — **do not duplicate** the permission matrix; link it.

### Outline

1. Intro — invite, assign roles, disable/remove members.
2. Key Concepts — member vs invite vs disabled; roles as union of permissions; privileged grants (`roles.grant.*`) — one paragraph + link to Roles guide.
3. Accessing — gear → Organisation → **Users**. Required `org.users.read`.
4. User list — name, email, status badges (active / invited / disabled), last activity.
5. Invite User — drawer; `org.users.invite`; what the invitee receives; resend invite from row menu.
6. Edit Roles — drawer; toggle chips; `org.users.manage`; cannot grant Org Admin / Platform Admin without `roles.grant.admin` / `roles.grant.platform_admin`.
7. Disable vs remove — `updateOrgUserStatusAction` vs `removeOrgUserAction` / `org.users.remove`; warn that remove drops org membership.
8. Best practices — invite with the smallest role; test with a second login; don’t share logins.

### Permissions / related

```yaml
permissions_discussed:
  - org.users.read
  - org.users.manage
  - org.users.invite
  - org.users.remove
related_guides:
  - roles-and-permissions
  - company-settings
  - getting-started
```

### UI to name accurately

- **Invite User** (header).
- Row **⋯** menu: Edit Roles, Resend invite, Disable, Remove — confirm labels against the live dropdown before publishing.

---

## 4. Company Settings

**Sources:** `SettingsPageClient.tsx`, `admin/settings/page.tsx` (redirects `?tab=features` and `?tab=notifications` to standalone pages).

### Outline

1. Intro — organisation profile used on documents and identity.
2. Key Concepts — legal name vs trading (if trading name exists on API; **verify** — current form: name, ABN, email, phone, address).
3. Accessing — gear → Organisation → **Company**. `org.settings.manage` to save.
4. Fields — Company name (required), ABN, primary email, phone, address autocomplete.
5. Save / Cancel — dirty state; toast on success.
6. Related admin — Features and Notifications are **separate** pages (not tabs on this screen anymore).
7. Best practices — keep ABN/email accurate for invoices; address feeds job/claim documents.

### Permissions / related

- `permissions_discussed`: `org.settings.manage`
- `related_guides`: `managing-users`, `organisation-claims`, `features`, `notifications`, `filesystem-templates`

---

## 5. Organisation Claims

**Sources:** `admin/claims/page.tsx`, `ClaimsAdminPanel.tsx` — approve/reject organisation claims; ghost organisations.

### Outline

1. Intro — this is **not** the Claims list under Customers. It is admin review of **organisation-level claim relationships** (who can work which insurer/org links). Walk the live panel and name the real entities (pending claims, ghosts).
2. Key Concepts — organisation claim vs insurance claim (`/claims`); statuses: pending / under_review / approved / rejected (from `statusColor`).
3. Accessing — gear → Organisation → **Organisation Claims**.
4. Review queue — approve / reject actions (`approveClaimAction`, `rejectClaimAction`).
5. Ghost organisations — what they are (orphaned/unlinked orgs from the panel copy) and what an admin should do.
6. Warning — approving grants cross-org operational access; don’t rubber-stamp.
7. Best practices.

Author **must** click through the panel once; do not invent a multi-tenant architecture essay. Stick to buttons and statuses on screen.

### Permissions / related

- `permissions_discussed`: likely `org.settings.manage` / platform claims — **confirm** which permission hides the nav item (sidebar currently has **no** `permission:` on this href — document that visibility may still be role-gated in the API).
- `related_guides`: `company-settings`, `claims-overview`, `connections`

---

## Index updates

TOC already links these four organisation files plus getting-started and dashboard. No new index rows required unless titles change.

`roles-and-permissions.md` `related_guides` already lists `managing-users` and `company-settings` — those files must exist after this subplan.

---

## Ingest & smoke

```text
pnpm --filter api guides:ingest
```

| Check | Expect |
|-------|--------|
| `GET /guides/by-route?route=/dashboard` | `dashboard` and/or `getting-started` |
| `GET /guides/by-route?route=/admin/users` | `managing-users` |
| `GET /guides/by-route?route=/admin/settings` | `company-settings` |
| `GET /guides/by-route?route=/admin/claims` | `organisation-claims` |
| **?** on `/admin/users` | canvas: Managing Users |
| **?** on `/dashboard` | canvas: Dashboard or Getting Started with a useful summary |

---

## Acceptance

- [ ] Five files written to the quality bar (not stubs).
- [ ] Users guide does not paste the full permission matrix (link Roles).
- [ ] Company guide matches the live form fields.
- [ ] Ingest + **?** smoke for users and dashboard.
