# UI Specifications — Crunchwork Pulse Vendor Portal

**Source:** Staging environment at `https://staging-iag.crunchwork.com/pulse/vendor/`
**Captured:** 2026-06-07
**Purpose:** Document the upstream Crunchwork Pulse UI to inform the EnsureOS claims-manager implementation.

---

## Functional Areas

| Spec | File | Description |
|------|------|-------------|
| Auth & Shell | [00_AUTH_AND_SHELL.md](./00_AUTH_AND_SHELL.md) | Login flow (Auth0), app shell, navigation structure |
| Claims (Projects) | [01_CLAIMS.md](./01_CLAIMS.md) | Project list, detail tabs (Overview, Jobs, Communications, Activities, Timeline) |
| Jobs | [02_JOBS.md](./02_JOBS.md) | Job list, detail tabs, create job flow |
| Quotes | [03_QUOTES.md](./03_QUOTES.md) | Quote list, create quote, CSV import, status flow |
| Purchase Orders | [04_PURCHASE_ORDERS.md](./04_PURCHASE_ORDERS.md) | PO list, detail, service window, line items |
| Invoices | [05_INVOICES.md](./05_INVOICES.md) | Invoice list, create invoice, status flow |
| Activities | [06_ACTIVITIES.md](./06_ACTIVITIES.md) | Notes, Emails, Tasks, Appointments, Calls (cross-entity) |

---

---

## Navigation Structure

**Top bar (green):** Projects | Jobs | User menu
**Hamburger menu (☰):** Calendar, Contacts, Dashboards, Invoices, Pulse, Purchase Orders, Quotes, Report Writer

## Activity Types per Entity

All entities support these activity types (distributed across detail tabs):

| Activity | Tab | Action Button |
|----------|-----|---------------|
| Notes | TIMELINE | ADD NOTE |
| Emails | COMMUNICATIONS | NEW EMAIL |
| Tasks | ACTIVITIES | CREATE TASK |
| Appointments | ACTIVITIES | CREATE APPOINTMENT |
| Calls | ACTIVITIES (as Task) | CREATE TASK (type: Call) |

---

## Conventions

- **Route notation:** Paths relative to `https://staging-iag.crunchwork.com/pulse/vendor/`
- **Field references:** CW API field names from Insurance REST API v17
- **UI element naming:** Exact labels as shown in the staging app
- **Status values:** As configured in the IAG tenant environment
- **Observed vs inferred:** Sections marked "(expected)" or "(inferred)" were not directly screenshotted but follow consistent patterns
