# 63 — Help Guide Content Rollout

**Status:** Implemented (content shipped; ingest 2026-08-31)  
**Date:** 2026-08-31  
**Depends on:** `62_ONLINE_HELP_SYSTEM.md` (foundation shipped)  
**Related:** `60_PAGE_AWARE_AGENT_CONTEXT.md`, `61_ASSESSMENT_TAB_AWARE_CHAT.md`, gold-standard guide `docs/guides/configuration/organisation/roles-and-permissions.md`  
**Subplans:** `63a`–`63j`

---

## Overview

Doc 62 shipped the **help platform** (ingest, REST/MCP, Help Assistant, header **?**, markdown canvas). One production-quality guide exists: **Roles & Permissions**.

This tranche is **content only**: write a user guide for every in-app route so **?** and free-form help have something to open. No new chat plumbing per page. New guides are Markdown + frontmatter + ingest.

The outline already lives in `docs/guides/index.md` (and section indexes). This plan:

1. Locks the **authoring contract** (copy the Roles & Permissions quality bar).
2. Publishes a **route → guide coverage matrix** against the live sidebar and `page.tsx` tree.
3. Splits the work into **executable subplans** (`63a`–`63j`) with per-guide outlines, sources, and smoke tests.
4. Adds a small number of **TOC expansions** for pages/workflows the outline missed (vendor directory, Crunchwork job playbooks, variations).

**Non-goals:** Help Centre browse UI, Notion live sync, audience ACL, HTML-authored guides, MCP App walkthroughs. Those remain doc 62 Phase E.

---

## Goals

1. Every **sidebar href** (Operations + Configuration) has at least one ingested guide whose `routes` include that pathname.
2. List **and** detail URLs for the same entity resolve to a useful guide (explicit `routes` entries, not parent-path fallback alone).
3. Pressing **?** on a mapped page opens the correct guide in canvas within one tool round-trip.
4. Authors write in **EnsureOS voice** against the **live UI**, using Roles & Permissions as the quality template.
5. Crunchwork CRM articles under `docs/Crunchwork/Guides/` are **rewritten**, never ingested as-is.

---

## What already exists

| Asset | State |
|-------|--------|
| Help platform (API, MCP, pack, **?**, `GuideMarkdown`) | Done — doc 62 Phase A |
| TOC + folder skeleton | `docs/guides/index.md`, `operations/index.md`, `configuration/index.md` |
| Gold-standard guide | `configuration/organisation/roles-and-permissions.md` (ingested) |
| Remaining TOC files | **Linked but not written** — creating them is this tranche |

---

## Authoring contract

Copy `docs/guides/configuration/organisation/roles-and-permissions.md`. Do not invent a thinner stub format.

### File location & ingest

- Path: `docs/guides/{operations|configuration}/{area}/{slug}.md`
- Skip files starting with `_` and any file **without** `title` + `slug` (indexes are skipped on purpose).
- After each subplan: `pnpm --filter api guides:ingest`
- Unchanged files skip via `content_hash`.

### Required frontmatter

```yaml
---
title: "Human title matching the page"
slug: kebab-case-unique
description: "One sentence; used in list/search."
section: operations          # or configuration
area: claims                 # folder / sidebar group key
routes:
  - /claims
  - /claims/[id]             # use real pathnames; see matrix
audience: member             # all | member | manager | admin  (advisory)
permissions_discussed:
  - claims.read
  - claims.create
tags: [claims, onboarding]
related_guides:
  - creating-a-claim
  - managing-claims
version: 1
last_updated: 2026-08-31
---
```

**`routes` rules**

- Pathname only (no origin, no query). Help lookup is `get_guides_for_route(pathname)`.
- Include **list and detail**: `/quotes` **and** `/quotes/[id]` — even though parent-path fallback exists, explicit entries are required for this tranche.
- Nested admin resources: include the specific path (`/admin/catalog`, `/admin/catalog/[catalogId]`, `/admin/catalog/items/[id]`, `/admin/catalog/new`).
- Query-only filters (`?jobId=`, `?tab=`) are **not** separate routes. Document tabs/filters in the body; mention `?jobId=` as job-scoped sidebar behaviour.
- Estimates live at **`/quotes`**, communications at **`/messages`**, filesystem categories at **`/admin/documents`**. Never invent `/estimates` or `/admin/connections`.

**`slug` rules**

- Stable, unique globally, matches filename without `.md`.
- Do not collide with existing `roles-and-permissions`.

### Body structure (required sections)

Every guide includes, in this order unless a subplan says otherwise:

1. **H1** matching `title`.
2. Short intro (what the page is for; 2–4 sentences).
3. **Key Concepts** — bullets for domain terms the page uses.
4. **Accessing …** — numbered nav from the sidebar or gear menu, matching real labels.
5. Feature sections as **H2** / **H3** with **numbered steps** that name real buttons, tabs, and drawers.
6. **Required permission** / **Note** / **Warning** / **Tip** callouts using the exact prefixes `GuideMarkdown` styles:
   - `> **Required permission:** …`
   - `> **Note:** …`
   - `> **Warning:** …`
   - `> **Tip:** …`
7. **Reference tables** where the UI is a matrix, status list, or field list.
8. **Best Practices** (5–7 items) for operational guides; 3–5 for simple admin pages.

### Voice

| Do | Do not |
|----|--------|
| “EnsureOS”, “this page”, “your organisation” | Crunchwork CRM screen names, “this article”, Notion tone |
| Match **live** button/tab labels | Copy outdated `docs/implementation/ui/*.md` tab lists when the component differs |
| Explain what the user **does** | Nest/Drizzle/MCP internals, file paths, migration numbers |
| British/Australian spelling already used in-product (Catalogues, Organisation) | Mix US/UK randomly |

**Live UI is the source of truth.** Implementation docs and UI specs are supporting context. If they disagree with `JobDetail.tsx` / list clients, trust the component.

### Length

| Kind | Target |
|------|--------|
| Overview / list+detail tour | 150–350 lines |
| How-to (create / complete / publish) | 120–280 lines |
| Job-type playbook (Crunchwork rewrite) | 200–400 lines |
| Thin admin page (e.g. Features) | 80–160 lines |
| Roles & Permissions (reference) | already ~390 lines — exception |

Stubs that only say “coming soon” are **out of scope**. If a screen is genuinely incomplete (e.g. Notifications placeholders), document **what is visible today** and a short “planned” note — still ingestable.

### Related guides

Populate `related_guides` with slugs that exist **or** are scheduled in this tranche (so ingest order within a subplan can be any; cross-subplan links are allowed). After all subplans, every listed slug must exist.

---

## Pages out of scope

| Path | Reason |
|------|--------|
| `/` marketing landing `(marketing)/page.tsx` | Public site, not in-app help |
| `/shared/chat/[token]` | Ephemeral shared conversation |
| Auth/login callbacks | Not product pages |

`getting-started` may mention signing in and landing on `/dashboard`; it does **not** document the marketing site.

---

## TOC expansions (beyond current `docs/guides/index.md`)

Add these files and link them from the indexes when their subplan lands:

| New guide | Subplan | Why |
|-----------|---------|-----|
| `operations/vendors/overview.md` | 63g | `/vendors` + `/vendors/[id]` exist; not in the sidebar but used from RFQ/PO/bill links |
| `operations/estimates/creating-a-variation.md` | 63e | Crunchwork “Variations – How to Create”; estimate overview has “Reason for variation” |
| `operations/jobs/builder-assessment-workflow.md` | 63c | Crunchwork workflow rewrite |
| `operations/jobs/completing-a-builder-assessment-job.md` | 63c | Crunchwork how-to (EnsureOS job + assessment screens) |
| `operations/jobs/builder-make-safe-workflow.md` | 63c | Crunchwork workflow rewrite |
| `operations/jobs/completing-a-builder-make-safe-job.md` | 63c | Includes **Create Make Safe** drawer on job detail |
| `operations/jobs/builder-works-workflow.md` | 63c | Crunchwork workflow rewrite |
| `operations/jobs/completing-a-builder-works-job.md` | 63c | Crunchwork how-to |

Do **not** ingest `docs/Crunchwork/Guides/*`. Rewrite into the paths above.

---

## Coverage matrix — Operations (sidebar)

Routes from `AppSidebar` `navGroups`. Detail paths from `apps/frontend/src/app/(app)/**/page.tsx`.

| Sidebar | Pathnames | Primary guide slug | Also on | Subplan |
|---------|-----------|--------------------|---------|---------|
| Dashboard | `/dashboard` | `dashboard` | `getting-started` | 63a |
| Claims | `/claims`, `/claims/[id]` | `claims-overview` (file `claims/overview.md`) | creating / managing | 63b |
| Jobs | `/jobs`, `/jobs/[id]` | `jobs-overview` | job-types, job-lifecycle, 63c playbooks | 63b / 63c |
| Journals | `/journals`, `/journals/[id]` | `journals-overview` | | 63b |
| Assessments | `/assessments`, `/assessments/[id]` | `assessments-overview` | completing, reports | 63d |
| Estimates | `/quotes`, `/quotes/[id]` | `estimates-overview` | creating, publishing, variation | 63e |
| Work Orders | `/work-orders`, `/work-orders/[id]` | `work-orders-overview` | | 63e |
| Invoices | `/invoices`, `/invoices/[id]` | `invoices-overview` | creating | 63f |
| RFQs | `/rfqs`, `/rfqs/[id]` | `rfqs` | | 63g |
| Proposals | `/proposals`, `/proposals/[id]` | `proposals` | | 63g |
| Purchase Orders | `/purchase-orders`, `/purchase-orders/[id]` | `purchase-orders` | | 63g |
| Bills | `/bills`, `/bills/[id]` | `bills` | | 63g |
| Tasks | `/tasks` | `tasks` | | 63h |
| Schedule | `/schedule` | `schedule` | | 63h |
| Communications | `/messages` | `communications-overview` | | 63h |
| Appointments | `/appointments` | `appointments` | | 63h |
| Contacts | `/contacts`, `/contacts/[id]` | `contacts-overview` | | 63h |
| Documents | `/documents` | `documents-overview` | uploading | 63h |
| Accounts Receivable | `/finance/ar` | `accounts-receivable` | | 63f |
| Accounts Payable | `/finance/ap` | `accounts-payable` | | 63f |
| Reports | `/reports`, `/reports/[id]` | `reports` | | 63f |

**Slug vs filename:** TOC uses paths like `operations/claims/overview.md`. Frontmatter `slug` should be globally unique. Prefer **filename-based** slugs (`overview` is too generic). Use:

- `claims-overview`, `creating-a-claim`, `managing-claims`
- `jobs-overview`, `job-types`, `job-lifecycle`
- `journals-overview`
- `assessments-overview`, `completing-an-assessment`, `assessment-reports`
- `estimates-overview`, `creating-an-estimate`, `publishing-an-estimate`, `creating-a-variation`
- `work-orders-overview`
- `invoices-overview`, `creating-an-invoice`
- `getting-started`, `dashboard`
- Vendor files: `vendors-overview`, `rfqs`, `proposals`, `purchase-orders`, `bills`
- Ops: `tasks`, `schedule`, `appointments`, `communications-overview`, `contacts-overview`, `documents-overview`, `uploading-documents`
- Finance: `accounts-receivable`, `accounts-payable`, `reports`

Roles already uses `roles-and-permissions`. Keep that slug.

---

## Coverage matrix — Configuration (admin + integration pages)

| Sidebar | Pathnames | Primary slug | Subplan |
|---------|-----------|--------------|---------|
| Users | `/admin/users` | `managing-users` | 63a |
| Roles & Permissions | `/admin/roles` | `roles-and-permissions` | **done** |
| Company | `/admin/settings` | `company-settings` | 63a |
| Organisation Claims | `/admin/claims` | `organisation-claims` | 63a |
| Catalogues | `/admin/catalog`, `/admin/catalog/new`, `/admin/catalog/[catalogId]`, `/admin/catalog/items/[id]` | `catalogues` | 63i |
| Document Templates | `/admin/document-templates`, `/admin/document-templates/[documentType]` | `document-templates` | 63i |
| Filesystem Categories | `/admin/documents` | `filesystem-categories` | 63i |
| Filesystem Templates | `/admin/filesystem-templates` | `filesystem-templates` | 63i |
| Agents | `/admin/agents` | `agents` | 63j |
| Skills | `/admin/skills` | `skills` | 63j |
| Capability Packs | `/admin/capability-packs` | `capability-packs` | 63j |
| AI Audit | `/admin/ai-audit` | `ai-audit` | 63j |
| Connections | `/connections`, `/connections/[id]` | `connections` | 63j |
| MCP Connections | `/mcp-connections` | `mcp-connections` | 63j |
| MCP Servers | `/admin/mcp-servers` | `mcp-servers` | 63j |
| Features | `/admin/features` | `features` | 63j |
| Notifications | `/admin/notifications` | `notifications` | 63j |

---

## Coverage matrix — extra routes (not in sidebar)

| Pathnames | Guide | Subplan |
|-----------|-------|---------|
| `/vendors`, `/vendors/[id]` | `vendors-overview` | 63g |

Job-scoped lists (`/tasks?jobId=…` etc.) share the same guide as the unfiltered list. Document the job filter in **Getting Started** and in each list guide’s Accessing / Filters section.

---

## Subplan index

Execute in this order unless a later domain is blocking a support ticket (then pull that slug forward; ingest is idempotent).

| Doc | Title | Guides (approx.) | Priority |
|-----|-------|------------------|----------|
| [63a](./63a_GUIDES_ONBOARDING_AND_ORGANISATION.md) | Getting started, dashboard, remaining organisation | 5 | P0 |
| [63b](./63b_GUIDES_CLAIMS_JOBS_JOURNALS.md) | Claims, jobs (generic), journals | 7 | P1 |
| [63c](./63c_GUIDES_JOB_TYPE_PLAYBOOKS.md) | Builder Assessment / Make Safe / Works playbooks | 6 | P1 |
| [63d](./63d_GUIDES_ASSESSMENTS.md) | Assessment entity + reports | 3 | P1 |
| [63e](./63e_GUIDES_ESTIMATES_AND_WORK_ORDERS.md) | Estimates, variations, work orders | 5 | P1 |
| [63f](./63f_GUIDES_INVOICES_FINANCE_REPORTS.md) | Invoices, AR/AP, reports | 5 | P2 |
| [63g](./63g_GUIDES_VENDOR_PROCUREMENT.md) | Vendors, RFQs, proposals, POs, bills | 5 | P2 |
| [63h](./63h_GUIDES_OPERATIONS_WORKSPACE.md) | Tasks, schedule, appointments, comms, contacts, documents | 7 | P2 |
| [63i](./63i_GUIDES_CONFIGURATION_CONTENT.md) | Catalogues, document templates, filesystems | 4 | P1 catalogues / P2 rest |
| [63j](./63j_GUIDES_AI_INTEGRATIONS_ADMIN.md) | AI admin, connections, features, notifications | 9 | P2–P3 |

**Total new Markdown guides:** 56 (plus 1 already shipped) → **57** ingested documents when complete.

---

## Process per guide (all subplans)

1. Open the live page (list + detail if any). Note header actions, tabs, drawers, empty states, permissions that hide chrome.
2. Draft Markdown + frontmatter under the path in the subplan.
3. Link from `docs/guides/index.md` and the section `index.md` if the link is missing or the title/slug changed.
4. `pnpm --filter api guides:ingest`
5. Smoke:
   - `GET /api/v1/guides/by-route?route=<pathname>` returns the expected slug.
   - `GET /api/v1/guides/<slug>/content` returns body without frontmatter.
   - In the app: open the page → **?** → canvas shows the guide; first chat reply summarises steps.
6. If **?** says no guide: fix `routes` (pathname vs label is a known footgun — see doc 62).

### Batch ingest

Ingest once per subplan, not necessarily per file. Re-ingest is cheap (hash skip).

### Index files

`docs/guides/index.md`, `operations/index.md`, `configuration/index.md` have **no slug** — they are TOC only. Update links when adding 63c/63e/63g expansions. Do not add frontmatter slugs to indexes.

---

## Optional code (not required to ship content)

Only if a subplan is blocked:

| Item | When |
|------|------|
| Extend `ADMIN_ROUTE_MAP` / `ROUTE_ENTITY_MAP` so **?** messages use a human `pageLabel` | Unmapped admin areas currently get `Admin: Document Templates`-style labels — still works for route lookup |
| Coverage script: every sidebar `href` appears in some ingested `routes` | Nice-to-have after 63j |
| `related_guides` footer in `GuideMarkdown` | Doc 62 Phase E |

Do **not** add a specialist agent per page. **?** already forces Help Assistant (`help-assistant`).

---

## Testing plan (programme-level)

### After each subplan

- [ ] All new files ingest (no missing `title`/`slug`).
- [ ] `by-route` for every pathname in that subplan’s matrix returns a guide.
- [ ] **?** on at least one list and one detail page in the batch.

### After 63j (exit)

- [ ] Sidebar coverage: 22 operations + 17 configuration hrefs all resolve.
- [ ] Extra: `/vendors`, catalogue nested paths, document-template type path, connection detail.
- [ ] Free-form: “How do I create a custom role?” still works; “How do I complete an assessment?” opens assessment guide.
- [ ] Page with no guide remains only marketing/shared-chat.
- [ ] Crunchwork folder still **not** in `guide_document.file_path`.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Authors copy Crunchwork field names (Zone, Project Attachments) | 63c rewrite rules; map to EnsureOS tabs (Overview, Parties, Attachments, Reports) |
| UI spec docs list tabs the app no longer has | Author against components; call out known drifts in each subplan |
| Generic slugs (`overview`) collide | Use prefixed slugs in the matrices above |
| Incomplete admin screens (Notifications) | Document current UI honestly |
| Embeddings unset locally | Route lookup still works; ingest warns; prod must have Vertex (doc 62) |
| Stale TOC links before files exist | Create the file in the same change as the index link |

---

## Success criteria

1. **?** on every sidebar page opens a rendered, read-only guide that describes **that** screen.
2. High-traffic how-tos (users, assessments, estimates, catalogues) match Roles & Permissions depth: concepts, steps, permissions, best practices.
3. Job-type playbooks exist in EnsureOS voice and are linked from Jobs + Assessments TOCs.
4. Ingest remains the only deploy step for new content (`pnpm --filter api guides:ingest`).

---

## Suggested work-hours (content)

AI-assisted authoring against live UI is **Tier 2/3**: reading screens + rewriting Crunchwork. Roughly **0.5–1.5 h per guide** including review; playbooks toward the high end. Subplan docs estimate hours at execution time from `git diff --stat` per the work-hours guide — do not pre-commit hours here.
