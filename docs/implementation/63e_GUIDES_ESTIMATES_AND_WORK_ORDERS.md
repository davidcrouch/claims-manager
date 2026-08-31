# 63e — Guides: Estimates & Work Orders

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Depends on:** 63b jobs; 63i catalogues (can land after — mention picker without full catalogue admin)  
**Priority:** P1  
**Related:** `10_QUOTES_MODULE.md`, `ui/03_ESTIMATES_QUOTES.md`, `57_CATALOGUE_CHAT_UX.md`, `33b_WORK_ORDERS_MODULE.md`, `ui/04_WORK_ORDERS.md`, Crunchwork `Variations - How to Create.md`

---

## Objective

Document Estimates (routes under `/quotes`), including take-off, catalogue pick, publish/approval, **variations**, and Work Orders.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/estimates/overview.md` | `estimates-overview` | `/quotes`, `/quotes/[id]` | member |
| `operations/estimates/creating-an-estimate.md` | `creating-an-estimate` | `/quotes`, `/quotes/[id]` | member |
| `operations/estimates/publishing-an-estimate.md` | `publishing-an-estimate` | `/quotes`, `/quotes/[id]` | member |
| `operations/estimates/creating-a-variation.md` | `creating-a-variation` | `/quotes`, `/quotes/[id]` | member |
| `operations/work-orders/overview.md` | `work-orders-overview` | `/work-orders`, `/work-orders/[id]` | member |

**TOC expansion:** add Creating a Variation under Estimates in both indexes.

---

## Live UI — Estimates

`QuoteDetail.tsx` tabs:

| Id | Label |
|----|-------|
| `overview` | Overview |
| `line-items` | **Take Off** |
| `parties` | Parties |
| `activities` | Activities |
| `journals` | Journals |
| `timeline` | Timeline |

Header: Publish (`EstimatePublishWizard`), approval (`EstimateApprovalWizard`) when applicable, print, archive, assignee, catalogue toolbar on Take Off (`QuoteCatalogToolbar`), create work order drawer.

List: `/quotes` labelled **Estimates** in the sidebar. Filters include quote type (variation types will show here).

> **Drift:** `ui/03_ESTIMATES_QUOTES.md` mentions Communications and Attachments tabs. Live tabs are Overview / Take Off / Parties / Activities / Journals / Timeline. Trust the component.

Permissions: `procurement.read`, `procurement.manage`; catalogue write-back `catalogs.update-from-estimate` (Roles guide already explains it — link).

---

## 1. Estimates — Overview

### Outline

1. Intro — priced scope for a job; sent upstream as a proposal from the insurer’s point of view.
2. Key Concepts — estimate vs invoice vs work order vs RFQ/proposal (direction of trade); quote types; groups/combos/items at a **user** level (“sections and lines”, not table names).
3. Accessing — Customers → **Estimates**. Job filter.
4. List — New, filters (status, type), totals.
5. Detail header — status, type, job/claim links, lock icon when published.
6. Tab tour.
7. Catalogue vs free-typed lines.
8. Best practices — don’t edit take-off after publish; use a variation.

`related_guides`: `creating-an-estimate`, `publishing-an-estimate`, `creating-a-variation`, `catalogues`, `jobs-overview`, `work-orders-overview`, `proposals`

---

## 2. Creating an Estimate

### Outline

1. New estimate from list or from job (Quote form drawer on job if present).
2. Overview fields — job, type, dates, totals as calculated.
3. Take Off — add group, add lines, catalogue picker (`CatalogPickerDrawer`), assemblies/scopes exploding to lines (plain language from doc 57).
4. CSV import if **Create from CSV** still exists on the list (verify).
5. Parties.
6. `catalogs.update-from-estimate` — when org settings enable write-back; Senior Estimator role.
7. Autosave / undo on take-off.
8. Tip — page agent `estimator` can help; **?** opens these guides.

---

## 3. Publishing an Estimate

### Outline

1. Difference between save, publish, and insurer approval.
2. **Publish** button → `EstimatePublishWizard` steps (walk live wizard: validations, documents, confirm).
3. Statuses after publish (Published, Approved, Resubmission Required, Cancelled — match list filters).
4. **Approval wizard** — when it appears (inbound approval vs outbound).
5. Locked take-off.
6. Warning — publishing notifies the insurer / creates upstream proposal.
7. Best practices — complete recommendation/assessment first for assessment jobs.

---

## 4. Creating a Variation

Rewrite Crunchwork variations article.

### Outline

1. When — quote already approved; cost/scope up or down; extra damage; items no longer required. Typical on Make Safe and Works.
2. Variation **types** as they appear in EnsureOS quote type lookup (walk the dropdown; don’t copy CW type names blindly). Overview field **Reason for variation**.
3. Create new estimate with variation type **linked to the job** (and parent quote if the UI has a parent control — **verify**).
4. Take-off only the delta vs cloning the whole quote — describe whatever the product actually does.
5. Publish/approval; **Note** that approved variation lines may update the job PO (if still true — check PO UI / doc 11).
6. Warning — don’t silently edit the original approved estimate.
7. Related: `builder-make-safe-workflow`, `builder-works-workflow`, `purchase-orders`.

---

## 5. Work Orders — Overview

**Sources:** work-order list/detail components, `ui/04_WORK_ORDERS.md` (verify tabs).

### Outline

1. Intro — instruction to a vendor/crew to perform scoped work; often spawned from an approved estimate.
2. Key Concepts — WO vs PO vs estimate; accept/decline if Dashboard queue “work orders to accept” applies.
3. Accessing — Customers → **Work Orders**. Job filter. `procurement.read` / `manage`.
4. List + detail (header, statuses, line items if present).
5. Creating from estimate (drawer on quote detail — `workOrderDrawerOpen`).
6. Dashboard decision queue.
7. Best practices.

If the detail page is thinner than estimates, one overview file is enough (no separate creating-*.md unless the UI is large).

---

## Index updates

In `docs/guides/index.md` Estimates line, add Creating a Variation. Mirror in `operations/index.md`.

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/quotes` | `estimates-overview` |
| `/quotes/{id}` | estimates guides |
| `/work-orders` | `work-orders-overview` |
| Free-form “how do I publish an estimate?” | `publishing-an-estimate` |
| Free-form “variation after approval” | `creating-a-variation` |

---

## Acceptance

- [ ] Sidebar word **Estimates** vs URL `/quotes` explained once in overview.
- [ ] Take Off label used, not “Line Items”, unless both appear.
- [ ] Variation guide is EnsureOS-native.
- [ ] Publish wizard steps match the live wizard.
- [ ] Ingest + **?** on `/quotes` and `/work-orders`.
