# Features, enhancements, and questions

Open non-bug staging feedback (plus duplicates). Full payloads: [`../_raw-staging-dump.json`](../_raw-staging-dump.json).

Legend: **Partial** = some code exists · **New** = greenfield · **Docs** · **Dup** · **Close** = resolve with note

---

## `26bc1c5c` — Contact Date vs Booked Date for SMS

| Class | Status |
|-------|--------|
| enhancement | Partial |

**Context:** Contact date is distinct from booked date for SMS-on-receipt then later booking. Overview has read-only Contact date plus editable Customer Contact Date / Booked date (`JobOverviewTab.tsx`).

**Proposed solution:** Make the SMS workflow use an explicitly editable **Customer Contact Date** (or rename Contact date → “First contacted”). Keep Booked date for appointment confirmation. Document which field triggers SMS; if Contact date must stay system-set, stop implying it is editable in help copy.

---

## `916f3dd1` — Where to log general job notes (no visit date)

| Class | Status |
|-------|--------|
| question | Partial · **Close with docs** |

**Context:** Journals require a visit date; users need notes during booking/authority.

**Proposed solution:** Answer in Feedback note + guides: use Communications → **Notes** (`NotesListPanel` / `job_notes`). Optionally later make journal visit date optional for non-site entries. Close the question once docs/help assistant know this path.

---

## `85708758` — Photos on jobs without site visit date

| Class | Status |
|-------|--------|
| enhancement | New/Partial |

**Context:** Want photos on a job without a formal site-visit journal.

**Proposed solution:** Prefer uploading into the job **Documents / Photos** folder (filesystem mapping) rather than forcing a journal. If journal upload remains the AI path, allow journal create without visit date (or a “General / no visit” type). Pair with `916f3dd1`.

---

## `545ef1b0` — Photo attachments on Purchase Orders

| Class | Status |
|-------|--------|
| feature | New |

**Context:** PO Attachments tab is a placeholder.

**Proposed solution:** Same implementation as bug `068be261` — replace stub with `EntityAttachmentsTab` + `jobId`, and allow selecting job photos when issuing a PO so vendors receive them. Do this in one PR with the WO/RFQ send attachment work.

---

## `3cdc4a44` — Filter task count to open only

| Class | Status |
|-------|--------|
| enhancement | Partial |

**Proposed solution:** Change `jobs.repository.countRelatedByJob` (and any sidebar consumer of `countKey: 'tasks'`) to count only open/active tasks (exclude completed/cancelled). Keep optional “show all” if needed later.

---

## `c9a1bb0f` — Highlight job completion steps as tasks

| Class | Status |
|-------|--------|
| feature | New |

**Proposed solution:** Phase 1 — assessment submit validation that blocks with a checklist of missing required fields. Phase 2 — generate open tasks from the Builder Assessment playbook steps for the assigned user. Do not invent process beyond existing guides / CW workflow.

---

## `65f78cc1` — Reserve estimation time before confirmation

| Class | Status |
|-------|--------|
| feature | New |

**Proposed solution:** Add appointment status `tentative` / `held` (or equivalent) so estimators can reserve a slot on the schedule before customer confirmation; confirm action promotes to booked. Show held slots distinctly on the schedule UI.

---

## `747630b4` / `c612dd40` — Out-of-hours Make Safe communication (dup)

| Class | Status |
|-------|--------|
| feature | **Dup** · New |

**Proposed solution:** Merge to one feedback item. Implement on-call routing: when an urgent/out-of-hours Make Safe arrives from Crunchwork, create/notify via Messages + configurable on-call contacts (start with org setting / role; integrate Robyn’s process later). Close the duplicate.

---

## `fe0a50a5` — Help Enter key & pop-out window

| Class | Status |
|-------|--------|
| enhancement | Partial |

**Proposed solution:** In Help/`ChatInputBar`, make **Enter** insert newline and **Ctrl/Cmd+Enter** send (or a clear footer hint if product prefers current send-on-Enter). Add an optional “Open in window” control that opens chat on a dedicated pop-out route so users can follow steps while navigating. Bundle with help UX cluster (`06718a97`).

---

## `c9b4eb25` — Help closed / conversation history

| Class | Status |
|-------|--------|
| feature | **Dup** of `06718a97` |

**Proposed solution:** Close as duplicate of `06718a97`. Ship history discoverability (tooltip / toast “Conversation saved — open History”) rather than a new logging feature.

---

## `5035c011` — Track insurer-caused delays for KPI

| Class | Status |
|-------|--------|
| enhancement | New |

**Proposed solution:** Add a job/claim **delay attribution** model (cause = insurer / internal / insured / other, with notes + dates). Surface on job overview and a simple export/report. Scope with Brett / Matt Nas before building UI; start with manual flagging, not automatic detection.

---

## `f56a47c3` — Tool availability vs workflow progression

| Class | Status |
|-------|--------|
| question | **Close** |

**Proposed solution:** Close with David’s existing note — CW allows parallel quote/report; tool availability is intentional; train estimators procedurally. No code gate unless product later wants soft warnings.

---

## `bd7f379c` — Enhance Builder Assessment Workflow guide

| Class | Status |
|-------|--------|
| enhancement / docs | Docs |

**Proposed solution:** Update EnsureOS guide to (1) link/clarify that the CW/IAG Builder Assessment Workflow owns insurer-triggered steps/tasks, (2) document EnsureOS-specific extras (specialists, journals, vendor booking) without inventing CAPS process. Do not expand the guide into a full “invoice paid” end-state unless product owns that lifecycle.

---

## `22a3d812` / `d975ef83` — Auto-compare vendor bills to POs (dup)

| Class | Status |
|-------|--------|
| feature | **Dup** · Partial |

**Proposed solution:** Merge duplicates. On Bill detail (and optionally PO), show line/total variance vs linked PO using existing `bill-line-progress` / link data — highlight over/under with thresholds. No OCR required for v1 if amounts already on both entities.

---

## `1ab27464` — Edit journal entries

| Class | Status |
|-------|--------|
| feature | Partial |

**Proposed solution:** Match other detail pages: Name / Description / Visit date are always editable inline, changes autosave after debounce, header shows save status + **Undo** (same pattern as jobs/contacts). Keep page content editing as-is (`PageEntryDrawer`). Soft-constrain edits after publish/sync if CW linkage requires it.

---

## `081791e9` — Search schedule by estimator

| Class | Status |
|-------|--------|
| feature | Partial |

**Proposed solution:** Add schedule/appointments filter by assignee / estimator (user select). Persist filter in URL query so Back preserves it. Goal: see one estimator’s jobs/times for a given day.

---

## `e60ffed4` — Specific field for makesafe PO line items

| Class | Status |
|-------|--------|
| feature | New |

**Proposed solution:** Prefer catalogue/convention first — dedicated makesafe scope or line naming pattern (e.g. “Roof — makesafe”). If that is insufficient, add an optional PO line **category/tag** (makesafe) stored on line payload and shown on Take Off + PDF. Avoid a one-off free-text-only field without catalogue support.

---

## Suggested feature sequencing

1. PO attachments (`545ef1b0`) — with bug `068be261`
2. Task count open-only (`3cdc4a44`)
3. Schedule by estimator (`081791e9`)
4. Contact vs booked date SMS clarity (`26bc1c5c`)
5. Edit journals (`1ab27464`) + notes docs (`916f3dd1` / `85708758`)
6. Larger: OOH make-safe, KPI delays, bill vs PO compare, completion-step tasks, reserve estimation time

## Resolved elsewhere

Invoice payment tracking + PO buy cost editable — already resolved/closed in feedback DB.
