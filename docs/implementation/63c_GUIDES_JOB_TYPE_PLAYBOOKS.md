# 63c — Guides: Job-Type Playbooks (Crunchwork Rewrite)

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Depends on:** 63b (generic jobs), 63d (assessment tabs — may land in parallel; link slugs anyway)  
**Priority:** P1 — highest support volume for builder tenants  
**Migration source (do not ingest):** `docs/Crunchwork/Guides/`

---

## Objective

Rewrite the Crunchwork CRM job playbooks into EnsureOS guides that follow **this app’s** job detail, tasks, appointments, assessments, estimates, documents, and invoices. These are the “how we actually run a builder job” documents.

---

## Source map

| Crunchwork file | Target EnsureOS file | Slug |
|-----------------|----------------------|------|
| `Builder Assessment Workflow.md` | `operations/jobs/builder-assessment-workflow.md` | `builder-assessment-workflow` |
| `Builder Assessment Jobs.md` | fold field-tour into workflow + 63b job-types; **do not** ship a separate “CW fields” clone | — |
| `Builder Assessment Job - How to Complete.md` | `operations/jobs/completing-a-builder-assessment-job.md` | `completing-a-builder-assessment-job` |
| `Builder Make Safe Workflow.md` | `operations/jobs/builder-make-safe-workflow.md` | `builder-make-safe-workflow` |
| `Builder Make Safe Jobs.md` | fold into make-safe workflow | — |
| `Builder Make Safe Job - How to Complete.md` | `operations/jobs/completing-a-builder-make-safe-job.md` | `completing-a-builder-make-safe-job` |
| `Builder Works Workflow.md` | `operations/jobs/builder-works-workflow.md` | `builder-works-workflow` |
| `Builder Works Jobs.md` | fold into works workflow | — |
| `Builder Works Job - How to Complete.md` | `operations/jobs/completing-a-builder-works-job.md` | `completing-a-builder-works-job` |
| Flow images (`*.png`, `*.jpg`) | **omit** unless replaced with EnsureOS screenshots later | — |

Empty Crunchwork how-to files: reconstruct from the sibling Workflow + Overview files plus live EnsureOS UI (`53_*`, `54_*`, `55_*` E2E docs are better procedural sources than empty MD).

**Also use (EnsureOS):**

- Assessment: `53_BUILDER_ASSESSMENT_E2E_AUTOMATION.md`, `61_ASSESSMENT_TAB_AWARE_CHAT.md`, `49_ASSESSMENT_ENTITY_REDESIGN.md`
- Make Safe: `54_BUILDER_MAKE_SAFE_E2E_AUTOMATION.md`, `JobCreateMakeSafeDrawer.tsx`
- Works: `55_BUILDER_WORKS_E2E_AUTOMATION.md`

---

## Rewrite rules

1. **Voice:** EnsureOS. Strip “this article”, “Crunchwork CRM”, “Project vs Job attachments”.
2. **Attachments:** “Upload on the job **Attachments** tab” (and Documents with job selected). Never tell users to upload at a CW “project” level.
3. **Banner fields:** Map CW “Account / Zone / Job suffix” to what Job Overview **actually** shows (claim link, type badge, address, status). If Zone is not in the UI, don’t document it.
4. **Automations:** Only document behaviours you can see in EnsureOS (task completion → dates, attendance due calculation). If unsure, describe the **user action** (“complete the Call to Contact task”) and a **Note** that dates may update automatically.
5. **Assessments:** Completing site findings is the **Assessments** module (63d), not a CW “report form on the job”. Job **Reports** tab is for generated/print documents.
6. **Estimates:** Creating/publishing quotes is `/quotes` (63e), not a CW-only quote screen.
7. Each playbook `routes`: `/jobs`, `/jobs/[id]` plus the related module paths users will jump to (see tables below).

---

## Guides (6)

### 1. Builder Assessment Workflow

**Routes:** `/jobs`, `/jobs/[id]`, `/assessments`, `/quotes`, `/invoices`  
**Audience:** member  
**Related:** `completing-a-builder-assessment-job`, `assessments-overview`, `completing-an-assessment`, `assessment-reports`, `creating-an-estimate`, `job-lifecycle`

**H2 outline**

1. When this job type is allocated (insurer wants cause + scope).
2. Stages (adapt CW list to EnsureOS nouns):
   1. Job appears (Dashboard / Jobs list, email if notifications on)
   2. Contact customer (Tasks / job dates)
   3. Book attendance (Appointments)
   4. Attend site (Assessment + Journal)
   5. Submit assessment report (Documents / job Reports — 63d)
   6. Submit estimate if required (63e)
   7. Invoice report fee (Purchase Order inbound + Invoices — keep honest if PO is auto-created)
   8. Insurer review
3. What you’ll see on the job (header, Overview dates, Parties).
4. Related records table — Assessment, Estimate, Invoice, Tasks.
5. Best practices.

---

### 2. Completing a Builder Assessment Job

**Routes:** `/jobs`, `/jobs/[id]`, `/assessments`, `/assessments/[id]`, `/documents`  
**Related:** `builder-assessment-workflow`, `completing-an-assessment`, `assessment-reports`, `uploading-documents`

**H2 outline** — numbered **checklist** the estimator ticks:

1. Open the job; confirm type is Builder Assessment.
2. Assign yourself if needed.
3. Complete contact task; set/confirm dates.
4. Create/book appointment.
5. Create or open the **Assessment**; complete tabs (link 63d — don’t reprint every field).
6. Photo journal.
7. Upload **Assessment Report** with the correct document type (rewrite CW “Attachments section” → Documents or job Attachments; name the document type control as it appears).
8. Create/publish estimate if the job requires a quote.
9. Raise/submit invoice for the assessment fee when eligible.
10. Warning — don’t mark complete before the report is visible to the insurer.

---

### 3. Builder Make Safe Workflow

**Routes:** `/jobs`, `/jobs/[id]`, `/quotes`, `/invoices`  
**Related:** `completing-a-builder-make-safe-job`, `creating-a-variation`, `creating-an-estimate`

**H2 outline**

Stages from CW, mapped:

1. Allocation **or** spawn from another job (**Create Make Safe** on job header).
2. Contact → book → attend.
3. Complete make-safe works on site.
4. Submit make-safe **estimate** (quote type — verify live type name).
5. Invoice.
6. Variations when scope changes after approval (link 63e).

Document `JobCreateMakeSafeDrawer` explicitly (button label, parent job, claim carry-over).

---

### 4. Completing a Builder Make Safe Job

Checklist style, parallel to assessment completing. Include:

- Safety / make-safe required flags on Overview if present.
- Estimate vs variation.
- Completion evidence (photos in journal + attachments).

---

### 5. Builder Works Workflow

**Routes:** `/jobs`, `/jobs/[id]`, `/work-orders`, `/quotes`, `/invoices`, `/purchase-orders`

**H2 outline**

CW stages mapped:

1. Allocation after assessment quote approval (PO with approved items).
2. Send scope/contract to customer (document generation / print — `PrintButton` / reports).
3. Collect excess if required (Overview excess fields + invoice).
4. Schedule works (Schedule / Appointments / Tasks).
5. Commence / complete repairs.
6. Upload completion certificate (Documents + type).
7. Invoice insurer.

---

### 6. Completing a Builder Works Job

Checklist. Cross-link work orders if the tenant issues WOs to subcontractors (63e / 63g). Variations for cost changes.

---

## Index updates

Add under **Jobs** in `docs/guides/index.md` and `operations/index.md`:

```markdown
- **Jobs** — [Overview](…) · [Job Types](…) · [Job Lifecycle](…)
  · [Builder Assessment](operations/jobs/builder-assessment-workflow.md)
  · [Make Safe](operations/jobs/builder-make-safe-workflow.md)
  · [Works](operations/jobs/builder-works-workflow.md)
```

Also link the three “completing” guides from the operations jobs subsection (can be nested bullets).

Update 63b `job-types.md` related_guides once these slugs exist (or write job-types last).

---

## Ingest & smoke

| Check | Expect |
|-------|--------|
| `by-route?route=/jobs` | includes playbook slugs **and** `jobs-overview` |
| Free-form “how do I complete a make safe job?” | `completing-a-builder-make-safe-job` or workflow |
| File path in DB | `docs/guides/operations/jobs/…` never `docs/Crunchwork/…` |

**?** on `/jobs` will return **multiple** guides. That is OK. Help skill should open the overview unless the user message names a job type. Playbook descriptions/tags must include “builder assessment”, “make safe”, “works” for search.

---

## Acceptance

- [ ] Six new files; no Crunchwork ingest.
- [ ] Create Make Safe drawer documented.
- [ ] Assessment/estimate/document steps point at 63d/63e/63h rather than duplicating field lists.
- [ ] TOC updated.
- [ ] Ingest + semantic search smoke for “make safe workflow”.
