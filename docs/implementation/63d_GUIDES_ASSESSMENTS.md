# 63d — Guides: Assessments

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Depends on:** 63b jobs overview; pairs with 63c assessment playbooks  
**Priority:** P1 — high traffic; tab-aware chat already exists (doc 61)  
**Related:** `49_ASSESSMENT_ENTITY_REDESIGN.md`, `61_ASSESSMENT_TAB_AWARE_CHAT.md`, `53_BUILDER_ASSESSMENT_E2E_AUTOMATION.md`

---

## Objective

Document the **Assessments** list and the nine-tab field assessment, plus how assessment **reports** are generated/uploaded. This is the in-app assessment entity — not the same as “Builder Assessment job” (that job type’s playbook is 63c).

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/assessments/overview.md` | `assessments-overview` | `/assessments`, `/assessments/[id]` | member |
| `operations/assessments/completing-an-assessment.md` | `completing-an-assessment` | `/assessments`, `/assessments/[id]` | member |
| `operations/assessments/assessment-reports.md` | `assessment-reports` | `/assessments`, `/assessments/[id]`, `/documents`, `/jobs/[id]` | member |

Chat on assessment detail is tab-aware (`?tab=`). Guides should name tabs; they do **not** need a separate route per tab.

---

## Live UI (must match)

`AssessmentDetailClient.tsx` tabs:

| Tab id | Label |
|--------|-------|
| `attendance` | Attendance |
| `building` | Building |
| `habitability` | Habitability |
| `hazards` | Hazards |
| `damage` | Damage & Cause |
| `makeSafe` | Make Safe |
| `temporaryAccommodation` | Temp Accommodation |
| `specialists` | Specialists |
| `recommendation` | Recommendation |

Also: autosave, lock when published/locked status (`isAssessmentLocked`), assignee, print, archive, New Assessment on list.

**Sources for field meaning:** section forms under `components/assessments/tabs/`, `assessment-sections.ts`. Do not dump every JSON key — explain **purpose** of each tab and the 3–8 controls users always fill.

Crunchwork `Assessment Reports - How to Upload.md` feeds **assessment-reports** only (rewrite).

---

## 1. Assessments — Overview

### Outline

1. Intro — structured site observations that feed the insurer Field Assessment report; owned by a job.
2. Key Concepts — assessment vs job vs claim; status (draft vs published/locked); sections vs tabs; job filter.
3. Accessing — Customers → **Assessments**. `assessments.read` / `assessments.manage`.
4. List — New Assessment; columns; opening detail.
5. Creating — job picker, name; what is prefilled from job/claim (address, policy — “you don’t re-type these here”).
6. Header — save status, print, lock behaviour.
7. Tab strip — one-line each + “see Completing an Assessment”.
8. AI assist — page agent `assessment-assistant` can fill the **current** tab; **?** still opens these guides.
9. Best practices — finish Attendance before Recommendation; don’t fight locked assessments (clone/new only if product supports — **verify**).

`related_guides`: `completing-an-assessment`, `assessment-reports`, `jobs-overview`, `builder-assessment-workflow`, `journals-overview`

---

## 2. Completing an Assessment

This is the **P1 how-to**. Quality bar = Roles & Permissions: thorough, stepwise.

### Outline

1. When to use (on site / after visit).
2. Order of tabs (recommended sequence = tab strip order).
3. **Per tab H3** — purpose, required-looking fields, callouts:
   - Attendance — who attended, datetime (align with appointment).
   - Building — construction/storeys as on form.
   - Habitability — liveable / uninhabitable reasons.
   - Hazards — asbestos, electrical, etc. as on form.
   - Damage & Cause — cause of loss, areas damaged.
   - Make Safe — whether MS required; may spawn Make Safe job (link 63c).
   - Temp Accommodation — if occupants displaced.
   - Specialists — referrals.
   - Recommendation — outcome, repair vs cash, next actions.
4. Autosave vs explicit save — describe the live save indicator.
5. Publishing / locking — Print vs Publish if both exist; what “locked” means (`locked` copy in UI).
6. Warning — publishing may submit to the insurer; don’t publish an empty recommendation.
7. Best practices — photos in Journals; consistency with estimate scope.

Walk **each tab component** once. If a tab is sparse, say so.

`permissions_discussed`: `assessments.read`, `assessments.manage`  
`related_guides`: `assessments-overview`, `assessment-reports`, `completing-a-builder-assessment-job`, `builder-make-safe-workflow`, `creating-an-estimate`

---

## 3. Assessment Reports

Rewrite CW upload article.

### Outline

1. Two paths (describe only those that exist):
   - **Generate/print** from assessment or job (`PrintButton` / job Reports tab) — templates from Document Templates (63i).
   - **Upload** a finished PDF to Documents or job Attachments with document type **Assessment Report** (confirm exact type label in the picker).
2. Why document type matters (insurer notification) — keep if still true; otherwise say “use the Assessment Report type so the file is classified correctly”.
3. Job-level vs company filesystem — with job selected, you are in the **project** filesystem (doc 47). Don’t upload assessment reports only under Company.
4. Naming the file.
5. Specialist reports — short pointer if a document type exists; else “use an appropriate type and the Specialists tab”.
6. Related — `uploading-documents`, `document-templates`, `jobs-overview`.

Crunchwork: “never upload at Project level” is **inverted** in EnsureOS (project filesystem **is** the job). Spell that out so migrated users are not confused.

---

## Index updates

TOC already lists these three files.

---

## Ingest & smoke

| Check | Expect |
|-------|--------|
| `by-route?route=/assessments` | `assessments-overview` or completing |
| `by-route?route=/assessments/{uuid}` | same |
| **?** on assessment detail | canvas opens an assessment guide |
| Free-form “how do I fill the damage tab?” | completing-an-assessment |

---

## Acceptance

- [ ] Completing guide has an H3 per live tab with real labels.
- [ ] Reports guide uses EnsureOS Documents/filesystem language, not CW Project/Job attachment lore.
- [ ] Locked/published behaviour documented.
- [ ] Ingest + **?** on `/assessments` and a detail URL.
