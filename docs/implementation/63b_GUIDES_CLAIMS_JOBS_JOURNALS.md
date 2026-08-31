# 63b — Guides: Claims, Jobs, Journals

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Depends on:** 63a (getting-started nav language)  
**Priority:** P1 — core Customers group  
**Follow-on:** `63c` job-type playbooks (do not duplicate those workflows here)

---

## Objective

Document the generic **claim → job → journal** surfaces: lists, detail tabs, create/edit, filters, job context. Job-type-specific insurer workflows (Builder Assessment / Make Safe / Works) are **63c**.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/claims/overview.md` | `claims-overview` | `/claims`, `/claims/[id]` | member |
| `operations/claims/creating-a-claim.md` | `creating-a-claim` | `/claims`, `/claims/[id]` | member |
| `operations/claims/managing-claims.md` | `managing-claims` | `/claims`, `/claims/[id]` | member |
| `operations/jobs/overview.md` | `jobs-overview` | `/jobs`, `/jobs/[id]` | member |
| `operations/jobs/job-types.md` | `job-types` | `/jobs`, `/jobs/[id]` | member |
| `operations/jobs/job-lifecycle.md` | `job-lifecycle` | `/jobs`, `/jobs/[id]` | member |
| `operations/journals/overview.md` | `journals-overview` | `/journals`, `/journals/[id]` | member |

---

## Shared UI notes (author against components)

**Claims list/detail** — `ClaimsListClient.tsx`, `ClaimDetail.tsx`.

Claim detail tabs (live): **Overview**, **Policy & Financial**, **Loss Details**, **Parties**, **Jobs**, **Compliance**, **Timeline**.

**Jobs list/detail** — `JobsListClient.tsx`, `JobDetail.tsx`.

Job detail tabs (live): **Overview**, **Type Details** (conditional — TA / specialist / rectification / internal audit), **Parties**, **Reports**, **Attachments**, **Timeline**.

> **Drift:** `docs/implementation/ui/02_JOBS.md` lists Quotes, POs, Invoices, Tasks, etc. as job tabs. Those records are reached via the **sidebar + job filter**, not those extra tabs. **Do not** document the spec’s extra tabs.

Header actions to verify: archive, print, assignee, **Create Make Safe** (`JobCreateMakeSafeDrawer`) — mention in overview with a pointer to 63c; appointment/quote drawers if present.

**Journals** — `journals/page.tsx`, journal detail, photo pages. Tie to `37_JOURNALS_MODULE.md` only for behaviour, not schema.

---

## 1. Claims — Overview

### Outline

1. Intro — claim is the policy/loss container; jobs hang off it.
2. Key Concepts — claim vs job vs assessment; claim number; status.
3. Accessing — Customers → **Claims**. `claims.read`.
4. List — columns, search, filters, New Claim (if `claims.create`).
5. Detail header — claim number, status, links into jobs.
6. Tab tour — one short paragraph each (not a field dump). Point creating/managing guides for edits.
7. Job-scoped — claims list is not `jobFilterable`; jobs on a claim appear on the Jobs tab.
8. Best practices — don’t create duplicate claims for the same loss; use search by claim number.

`permissions_discussed`: `claims.read`, `claims.create`, `claims.update`, `claims.delete`  
`related_guides`: `creating-a-claim`, `managing-claims`, `jobs-overview`, `organisation-claims`

**Sources:** `08_CLAIMS_MODULE.md`, `ui/06_CLAIMS.md` (verify columns live).

---

## 2. Creating a Claim

### Outline

1. When to create vs when the insurer allocates a job (inbound claim already exists).
2. New Claim button / drawer or form — **walk live create UI** (header action on list).
3. Required fields (policy, loss date, address, parties as shown).
4. What happens after save — appears in list; can add jobs.
5. Warning — creating locally may also sync to the connected insurer platform; don’t double-enter if the job already arrived inbound.
6. Best practices.

Keep this **procedural**. Field-level policy/excess detail belongs in Managing Claims / Policy tab.

---

## 3. Managing Claims

### Outline

1. Editing overview vs Policy & Financial vs Loss Details.
2. Parties — adding insured/broker/contacts.
3. Linked jobs — opening a job; creating a job from the claim if the UI allows.
4. Compliance tab — what testers actually see (don’t invent).
5. Timeline / activity.
6. Archive/delete — `claims.delete`; warning.
7. Best practices — keep loss type and address accurate; they feed assessments and reports.

---

## 4. Jobs — Overview

### Outline

1. Intro — a job is a unit of work (assessment, make safe, works, …) on a claim.
2. Key Concepts — job type, status, assignee, vendor snapshot, request date, make-safe required, parent/child jobs.
3. Accessing — Customers → **Jobs**. `jobs.read`. Filters: status, type. Search: reference, suburb.
4. List columns — Job Ref, Status, Type, Address, Requested, Updated (verify live).
5. Opening a job — header badges, View Claim, Create Make Safe, print, assignee.
6. Tab tour — Overview fields users actually edit (booked/attendance dates, instructions); Parties; Reports; Attachments (job-level — Crunchwork “never upload at project level” becomes “upload on the job’s Attachments tab”); Timeline.
7. Type Details tab — only for certain types; see `job-types`.
8. Job filter — how other sidebar items pick up `?jobId=`.
9. Best practices — set contact/attendance dates (they drive tasks/automations); don’t leave jobs unassigned.

`permissions_discussed`: `jobs.read`, `jobs.create`, `jobs.update`, `jobs.assign`  
`related_guides`: `job-types`, `job-lifecycle`, `builder-assessment-workflow`, `builder-make-safe-workflow`, `builder-works-workflow`, `claims-overview`, `assessments-overview`

---

## 5. Job Types

### Outline

1. Intro — type drives fields, automations, and which playbook to follow.
2. Table of types users will see (lookup `job_type`):

   | Type (typical name) | What it’s for | Guide |
   |---------------------|---------------|-------|
   | Builder Assessment | Site investigation + report/quote | 63c + 63d |
   | Builder Make Safe | Urgent make-safe works | 63c |
   | Builder Works | Approved repairs | 63c |
   | Temporary Accommodation | TA panel on Type Details | this page |
   | Specialist | Specialist panel | this page |
   | Rectification / Internal Audit | Type Details panels | this page |

   Confirm names from `getLookupsByDomain('job_type')` in the running tenant — don’t hardcode insurer-only names that aren’t in the dropdown.

3. Type Details tab — `hasTypeDetails()` kinds in `jobType.ts`.
4. Filtering the jobs list by type.
5. Creating a job — `JobFormDrawer` type picker; provider-scoped types.
6. Pointers to 63c playbooks for the three builder types.

`related_guides`: `jobs-overview`, `job-lifecycle`, plus the six 63c slugs.

---

## 6. Job Lifecycle

### Outline

1. Typical statuses (from live status filter — e.g. allocated → in progress → complete). Do not copy Crunchwork automation tables wholesale; summarise:
   - Dates: request, contact, attendance due, attendance, completed.
   - Completing **Call to Contact** / attendance tasks may stamp dates (if still true in EnsureOS task names — **verify on a sample job**).
2. Assignee and `jobs.assign`.
3. Child jobs (Make Safe spawned from Assessment) — pointer to Create Make Safe + 63c.
4. Invoicing happens on **Invoices**, not as a hidden job tab.
5. Best practices — don’t skip contact date; complete tasks rather than only editing dates if both exist.

`related_guides`: `jobs-overview`, `tasks`, `invoices-overview`, 63c completing-* guides.

---

## 7. Journals — Overview

### Outline

1. Intro — photo journal / site notes, often job-scoped.
2. Key Concepts — journal vs documents vs assessment notes; pages.
3. Accessing — Customers → **Journals**; with a job selected the list filters.
4. List + New Journal. `journals.read` / `journals.manage`.
5. Detail — pages, photos, notes; linking to job/claim/estimate if the UI shows it (quotes have a Journals tab — cross-link `estimates-overview`).
6. Best practices — one journal per visit; don’t use journals as the legal assessment record (use Assessments).

`related_guides`: `jobs-overview`, `assessments-overview`, `documents-overview`, `estimates-overview`

---

## Index updates

TOC already lists these seven files. No expansion rows.

---

## Ingest & smoke

| Route | Expect a guide in |
|-------|-------------------|
| `/claims` | `claims-overview` (and/or creating/managing) |
| `/jobs` | `jobs-overview` |
| `/journals` | `journals-overview` |
| `/jobs/{uuid}` | same jobs guides |

**?** on a job detail page should open a jobs guide, not claims.

---

## Acceptance

- [ ] Seven guides; job tabs match `JobDetail.tsx`, not `ui/02_JOBS.md`.
- [ ] Job types table points at 63c without copying full playbooks.
- [ ] Claim vs Organisation Claims distinction is explicit.
- [ ] Ingest + **?** on `/claims` and `/jobs`.
