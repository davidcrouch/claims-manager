# 13 — Admin Pages

**Sidebar group:** ADMIN
**Pages:** Users, Settings (includes Connections)

---

## Users (`/admin/users`)

### List Columns

| Column | Field |
|--------|-------|
| Name | `givenName + familyName` |
| Email | `email` |
| Role | assigned role |
| Status | Active / Invited / Disabled |
| Last login | datetime |
| Actions | Edit, Disable |

**Header action:** INVITE USER

### Invite User Form

| Field | Type | Required |
|-------|------|----------|
| Email | Email input | Yes |
| Given name | Text | Yes |
| Family name | Text | Yes |
| Role | Select | Yes |

---

## Settings (`/admin/settings`)

Tabbed settings page.

### Tabs

| Tab | Content |
|-----|---------|
| General | Organisation name, address, logo |
| Connections | Integration connections (Crunchwork, etc.) |
| Notifications | Webhook and email notification preferences |
| Billing | Subscription/plan info |

### Connections Tab

| Column | Field |
|--------|-------|
| Provider | Crunchwork, etc. |
| Status | Connected / Disconnected |
| Last sync | datetime |
| Actions | Edit, Test, Disconnect |

**Header action:** ADD CONNECTION

---

## Documents (`/admin/documents`)

See Operations spec (11_OPERATIONS.md) — Documents listed under OPERATIONS in sidebar.
