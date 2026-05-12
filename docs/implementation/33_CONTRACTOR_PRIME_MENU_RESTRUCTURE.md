# 33 — Contractor (Prime) Menu Restructure & New Entity Implementation

**Date:** 2026-05-13
**Source:** `docs/Ensure Roles.pdf` — Contractor (Prime) role layout
**Scope:** Full stack — DB schema, API modules, frontend pages, sidebar navigation

---

## Overview

Restructure the left sidebar navigation from a flat list into five grouped sections matching the **Contractor (Prime)** role layout. Introduce new entity types (Work Orders, RFQs, Proposals, Bills), expand Tasks to support polymorphic entity attachment, promote Operations items (Tasks, Messages, Appointments, Contacts) to standalone cross-entity pages, add Finance views (AR/AP), and build Admin pages (Users, Documents, Settings).

---

## Current State

**Sidebar** (`apps/frontend/src/components/layout/AppSidebar.tsx`): flat `navItems` array with 9 entries — Dashboard, Claims, Jobs, Quotes, Purchase Orders, Invoices, Reports, Vendors, Connections.

**Existing API modules** (`apps/api/src/modules/`): claims, jobs, quotes, purchase-orders, invoices, reports, tasks, messages, appointments, vendors, contacts, dashboard, attachments, webhooks, lookups, providers, external, internal, webhook-tools.

**DB schema** (`apps/api/src/database/schema/index.ts`): Drizzle ORM with `pgTable` definitions for all existing entities. Tasks currently constrained to `claim_id OR job_id`.

**Sidebar primitives**: `SidebarGroupLabel` already exported from `apps/frontend/src/components/ui/sidebar.tsx` but not yet used in app code.

---

## Target Sidebar Structure

```
Dashboard                     ← standalone, above groups
─────────────────────────────
CUSTOMERS
  Jobs                        ← existing /jobs
  Estimates/Quotes            ← existing /quotes (relabel)
  Work Orders                 ← NEW
  Invoices                    ← existing /invoices
  Claims                      ← existing /claims
─────────────────────────────
VENDORS
  RFQs                        ← NEW
  Proposals                   ← NEW
  POs                         ← existing /purchase-orders (relabel)
  Bills                       ← NEW
─────────────────────────────
FINANCE
  Accounts Receivable         ← NEW (accounting view of Invoices)
  Accounts Payable            ← NEW (accounting view of Bills)
─────────────────────────────
OPERATIONS
  Tasks                       ← NEW standalone page (cross-entity)
  Schedule / Calendar         ← NEW
  Messages + Attachments      ← NEW standalone page (cross-entity)
  Appointments / Meetings     ← NEW standalone page (cross-entity)
  Contacts                    ← NEW standalone page
─────────────────────────────
ADMIN
  Users                       ← NEW
  Reports                     ← existing /reports (moved from top-level)
  Documents                   ← NEW
  Settings                    ← NEW (Connections migrated as tab within)
```

---

## Disposition of Existing Items

| Current Item | New Location | Notes |
|---|---|---|
| Dashboard | Top of sidebar (above groups) | Stays; enhanced with clickable metric cards |
| Claims | CUSTOMERS group | Direct move |
| Jobs | CUSTOMERS group | Direct move |
| Quotes | CUSTOMERS group | Relabeled "Estimates/Quotes" |
| Purchase Orders | VENDORS group | Relabeled "POs" |
| Invoices | CUSTOMERS group | Customer-facing invoices (AR) |
| Reports | ADMIN group | Moved from top-level |
| Vendors | VENDORS group header only | `/vendors` page accessible from vendor detail links; no standalone sidebar entry |
| Connections | Tab in Settings (ADMIN) | `/connections` route redirects to `/admin/settings?tab=connections` |

---

## Design Principle: Recursive Contractor Chain

> **Critical**: The `Ensure Roles.pdf` document shows "Contractor (Prime)" and "Contractor (Sub)" as two *example* positions in a chain. The actual design supports **infinite levels** of recursively chained contractors. Any tenant in the system can simultaneously be a sub-contractor to an upstream party and a prime contractor to its own downstream parties.

**Implications for this plan:**

- **No hardcoded role names** in schema, API, or UI. The terms "Contractor" and "Sub-contractor" are used throughout this plan only as **relative labels** — "Contractor" means "the active tenant's perspective" and "Sub-contractor" means "a downstream party from that tenant's perspective."
- The **CUSTOMERS** group represents entities involving the tenant's upstream relationship (work received, invoices sent up).
- The **VENDORS** group represents entities involving the tenant's downstream relationships (work delegated, bills received from below).
- A Work Order received by tenant A is the same underlying data as the PO sent by tenant A's upstream party. A Bill received by tenant A is the same underlying data as the Invoice sent by tenant A's downstream party.
- Entity tables use generic FK columns (`source_tenant_id`, `vendor_id`) rather than role-specific columns. No `prime_contractor_id` or `sub_contractor_id`.
- The sidebar group labels (CUSTOMERS, VENDORS) describe **direction of relationship**, not fixed organizational roles.

---

## Domain Model Context

### Upstream / Downstream Party Relationships

Every tenant sees the same menu structure. The labels describe direction, not identity:

```
  ┌──────────────────────────────────────────────┐
  │  UPSTREAM PARTY (any tenant above in chain)   │
  │  Sends: Work Orders (scope directives)        │
  │  Receives: Invoices, Claims                   │
  └─────────────────────┬────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────┐
  │  THIS TENANT ("Contractor" = active user)     │
  │                                               │
  │  CUSTOMERS group:                             │
  │    Receives from upstream: Work Orders        │
  │    Sends to upstream: Invoices, Claims        │
  │                                               │
  │  VENDORS group:                               │
  │    Sends to downstream: RFQs, POs             │
  │    Receives from downstream: Proposals, Bills │
  └─────────────────────┬────────────────────────┘
                        │
  ┌─────────────────────▼────────────────────────┐
  │  DOWNSTREAM PARTY (any tenant below in chain) │
  │  Receives: RFQs, POs                         │
  │  Sends: Proposals, Bills                      │
  └──────────────────────────────────────────────┘
                        │
                       ...  (chain continues indefinitely)
```

This pattern repeats at every level. A downstream party's own tenant view shows the same CUSTOMERS / VENDORS structure, where *its* upstream party is the tenant that sent it the PO.

### Entity Definitions

- **Work Order**: A scope-of-work directive received from an upstream party. Structurally mirrors a PO. Links to the upstream party's PO via `source_purchase_order_id` / `source_tenant_id`.
- **RFQ**: Generated from a subset of Estimate/Quote line items and sent to a downstream party. Optionally excludes unit pricing and quantities.
- **Proposal**: An estimate/quote received from a downstream party, optionally in response to an RFQ.
- **Bill**: An invoice received from a downstream party. Represents Accounts Payable viewed as a job cost against a PO.
- **Finance AR**: Invoices (sent upstream) viewed from the accountant's perspective — aging, payment tracking.
- **Finance AP**: Bills (received from downstream) viewed from the accountant's perspective.
- **Tasks**: Polymorphic — attachable to Job, Claim, Quote, Work Order, Invoice, RFQ, Proposal, PO, Bill, Appointment, Contact.

---

## Sub-plans

| # | Document | Title | Scope |
|---|----------|-------|-------|
| 33a | `33a_SIDEBAR_RESTRUCTURE.md` | Sidebar Restructure | Frontend sidebar groups + stub pages |
| 33b | `33b_WORK_ORDERS_MODULE.md` | Work Orders Module | DB + API + frontend for Work Orders |
| 33c | `33c_RFQS_MODULE.md` | RFQs Module | DB + API + frontend for RFQs |
| 33d | `33d_PROPOSALS_MODULE.md` | Proposals Module | DB + API + frontend for Proposals |
| 33e | `33e_BILLS_MODULE.md` | Bills Module | DB + API + frontend for Bills |
| 33f | `33f_FINANCE_AR_AP.md` | Finance AR & AP | API endpoints + frontend for accounting views |
| 33g | `33g_TASKS_POLYMORPHIC_EXPANSION.md` | Tasks Polymorphic Expansion | Schema change + API update for cross-entity tasks |
| 33h | `33h_OPERATIONS_STANDALONE_PAGES.md` | Operations Standalone Pages | Schedule, Messages, Appointments, Contacts pages |
| 33i | `33i_ADMIN_PAGES.md` | Admin Pages | Users, Documents, Settings (with Connections tab) |
| 33j | `33j_DASHBOARD_ENHANCEMENT.md` | Dashboard Enhancement | Clickable metric cards linking to new pages |

---

## Implementation Order

**Critical path**: 33a (sidebar) is the foundation. Entity sub-plans (33b–33e, 33g) can be parallelized after 33a. Finance (33f) depends on Bills (33e). Operations pages (33h) depend on Tasks expansion (33g). Admin (33i) and Dashboard (33j) come last.

```
33a ──┬── 33b (Work Orders)
      ├── 33c (RFQs) ──────────┐
      ├── 33e (Bills) ── 33f   │
      └── 33g (Tasks) ──┐      │
                         ├── 33h (Operations)
         33d (Proposals) ┘      │
                                └── 33i (Admin) ── 33j (Dashboard)
```

---

## Files Impacted (Existing)

| File | Sub-plan | Change |
|---|---|---|
| `apps/frontend/src/components/layout/AppSidebar.tsx` | 33a | Sidebar groups |
| `apps/api/src/database/schema/index.ts` | 33b–33g | New tables + tasks modification |
| `apps/api/src/app.module.ts` | 33b–33i | Register new modules |
| `apps/api/src/database/database.module.ts` | 33b–33e, 33g | Register new repositories |
| `apps/api/src/database/repositories/index.ts` | 33b–33e, 33g | Export new repositories |
| `apps/api/src/modules/tasks/` | 33g | Polymorphic expansion |
| `apps/api/src/modules/messages/` | 33h | Add cross-entity list endpoint |
| `apps/api/src/modules/appointments/` | 33h | Add cross-entity list endpoint |
| `apps/api/src/modules/dashboard/` | 33j | New stats |
| `apps/frontend/src/lib/api-client.ts` | 33b–33j | New API client methods |
| `apps/frontend/src/components/connections/` | 33i | Migrate into Settings tab |

---

*Next: 33a_SIDEBAR_RESTRUCTURE.md*
