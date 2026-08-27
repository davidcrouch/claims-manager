# Crunchwork E2E Test Cases — Coverage Analysis

**Source:** `docs/Crunchwork/Ensure E2E Test Cases_Revised.xlsx` (revised workbook; companion plan is `docs/Crunchwork/Testing Plan – Vendor System Integration_ Make Safe, Builder Assessment & Works Jobs-v2-20260302_065235.pdf`)  
**Date:** 2026-08-26  
**Instigator:** Crunchwork / ClaimCentre v8 (IAG). The insurer system starts every allocation, excess change, inbound message, quote resubmit/approve/cash-settle, invoice approve, and claims-side cancel.  
**This system’s actor:** **Builder** (vendor). claims-manager is the builder UI + API. more0-ensure / claims-mcp are Builder-side automation, not Crunchwork.

This review grades steps against two questions:

1. **Impl** — can this Builder system satisfy the *Builder* assertion (receive + display, or perform the Builder action)?
2. **Auto E2E** — is there an automated test in this repo that asserts that Builder step?

All 18 workbook cases are marked **Manual**. There is **no automated suite** that walks this spreadsheet against a live Crunchwork staging allocation.

---

## 0. Builder actor — what this changes

The workbook already splits each flow into **Builder** rows and **CW / CCv8** rows. This system only plays Builder. That does **not** add new features we must build, but it **does change what “coverage” and “gap” mean**.

| Workbook actor | Who owns the step | How we treat it |
|----------------|-------------------|-----------------|
| **Builder** / Builders UI | **Us** | Product coverage. Receive inbound CW data, or perform the action (fail task, publish quote, send message, …). |
| **CW / CCv8** | IAG | Not our SUT. These rows are the **outbound contract**: if our previous Builder action hit the Insurance REST API correctly, CW/CCv8 should look right. We do not implement CCv8 alerts, Claim Notes, or workplan activities. |
| **System automation** | Usually **CW Pulse** (status, next task, dates, auto-approval). Our more0 ASL is a parallel Builder engine. | Builder duty is to **show** the result (`UPDATE_JOB`, `NEW_TASK`, …). Creating the next CTS task or calculating Attendance Due Date is CW’s job on a CW-instigated run unless staging proves otherwise. |
| **Instruction / test lead** | Process | Out of scope. |

**Sheet row mix (parsed from the workbook, including comment rows):** ~89 Builder (84 titled Builder + 5 “Builder” unknowns), ~75 CW/CCv8, ~51 automation, ~26 instruction, ~17 mixed. **Only Builder (+ Builder-visible inbound) steps are the coverage denominator.**

What this revises from the first pass:

1. **G1 is not an IAG E2E blocker by default.** After CW allocates, Call to Schedule already exists on the CW Activities tab. Builder must **receive** it (`NEW_TASK` → `ProjectTaskUseCase`) and fail/complete it outbound. `JobsService.startWorkflowForJob` is required for *our* more0 phases and the direct-provider path — not for seeing a CW-created task.
2. **CTS #2–#5, attendance dates, Book Site Attendance, auto-approval, job status, specialist-report → PO line** are CW Pulse / CCv8 expected results. Drop them from “we must implement” unless a Builder row says *we* create the next task.
3. **G3 (inbound quote/PO events into more0)** matters for *our* workflow UI, not for IAG’s CW assertions. Builder still must **display** Resubmission Required / Cash Settled / Approved after projection.
4. **Do not score the 255-step sheet as one product backlog.** CW-only fails (workplan alerts, Doc SubType, Claim Notes) are IAG’s system.
5. **Our harness should act as Builder:** after CW allocates, assert job/task/message in our UI/API, then perform Builder actions. `POST /jobs?provider=direct` is Builder *creating* a job (TC02 registration only), not Builder *receiving* an allocation.

---

## 1. How Crunchwork instigates the test

```
CCv8 (IAG) ──allocate / message / approve / cancel──► Crunchwork
                                                         │
                                                         │ webhook NEW_* / UPDATE_*
                                                         ▼
                                              claims-manager webhooks
                                                         │
                              ┌──────────────────────────┼──────────────────────────┐
                              ▼                          ▼                          ▼
                     Project*UseCase              process-inbound-event      more0-ensure ASL
                     (DB + UI)                    (fetch + project only)    (tasks / phases)
```

**Consequence for this Builder system:** our local scripts (`apps/api/test-e2e-trigger.mjs`) **create** a job (`POST /jobs?provider=direct`) and start more0. IAG’s run **allocates** a job in CW; we must **receive** it. `ProjectJobUseCase` persists the job and does not start more0. That is fine for the IAG path if CW already created Call to Schedule and webhooks `NEW_TASK`. more0 start remains necessary for *our* phases and for direct-provider tenants — see §0 and staging checks S1–S3.

---

## 2. Coverage rubric

| Grade | Meaning |
|-------|---------|
| **Covered** | Builder implementation exists and should pass the builder assertion if the workflow is running. |
| **Partial** | Some expected fields or APIs exist; at least one required behaviour is missing, gated, or inbound-only. |
| **Not covered** | No implementation, or the CW-instigated path cannot produce the expected builder result. |
| **CW-only** | IAG assertion. Not Builder coverage. Noted only as the outbound contract for the previous Builder action. |
| **Instruction** | Procedural note, pause, or “confirm with builder” — not a product assertion. |

**Auto E2E** is `None` on every step unless stated. Existing automated tests are listed in §4.

---

## 3. Executive summary

Workbook Quick Reference totals **18 cases / 255 steps**. **Builder is the SUT for ~89 of those rows.** The rest are IAG (CW/CCv8), CW Pulse automation, or instructions.

| Area | Cases | All steps | Builder steps (approx.) | Builder **Covered** | Builder **Partial** | Builder **Not covered** | Auto E2E |
|------|-------|-----------|-------------------------|---------------------|---------------------|-------------------------|----------|
| BMS | 1–4 | 60 | ~21 | Receive job/message; create/publish quote; invoice submit; create appt; create BMS | CTS fail/receive #2; dates from CW; cancel job wording | Ack; appt cancel | **0** |
| BA | 5–14 | 104 | ~37 | Vulnerable flag; inbound docs/messages; publish quote; invoice submit; report upload | Excess display; cash-settled lines; liability rec; inbound quote status | Hazardous waste; ack; complaint/CEV templates; appt cancel | **0** |
| BW | 15–18 | 91 | ~26 | Variation create/publish; two-way messages; invoice submit | Excess collected; schedule/commence fields; inbound approve | Ack | **0** |
| **Total** | **18** | **255** | **~89** | **~30** | **~45** | **~14** | **0** |

Counts are approximate. CW-only and instruction rows are **not** in the Builder totals.

### Highest-impact **Builder** gaps for a live Crunchwork E2E

1. **Inbound display after CW allocates** — job, CTS task (`NEW_TASK`), excess, auto-approval flag, attachments. Confirm on staging that CTS arrives by webhook without our more0 workflow. If it does not, *then* G1 (start workflow / create task) becomes a Builder blocker.
2. **Builder actions that are gated or missing:** message acknowledge, appointment cancel (+ reason + IAG message), complaint / CEV **body templates**, hazardous waste mapping, cash-settled line status on publish, claim-recommendation values.
3. **Builder UI must reflect CW-driven status** after we act or IAG acts: Allocated, Resubmission Required, Cash Settled, Approved, Cancelled, Underway/Finished. Projection exists; more0 events are optional for IAG.
4. **No Builder-actor automated harness** — planned Jest files in docs 53i / 54g / 55g were never added; `test-e2e-trigger.mjs` creates a job as Builder instead of receiving one.

**No longer treated as Builder gaps (first-pass over-attribution):**

- CCv8 Service Request Alerts, Quote Review, Complaint Review, CEV Referral workplan items
- CW auto-approval execution (we publish; CW approves)
- CW creating CTS #2–#5, Book Site Attendance, Attendance Due Date, specialist-report PO line
- more0 `quote.status_changed` / `purchase_order.completed` as IAG blockers (still useful for *our* workflow)

---

## 4. Automated test inventory (this repo)

| Artifact | What it covers vs this workbook |
|----------|----------------------------------|
| `apps/api/test/app.e2e-spec.ts` | `GET /` only. **No coverage.** |
| `apps/api/test/crunchwork-auth.e2e-spec.ts` | Live CW OAuth + `GET /jobs`. **Auth smoke only.** |
| `apps/api/test-e2e-trigger.mjs` | Creates **direct-provider** BA job; logs more0 run. **Not CW-instigated. No assertions.** |
| `apps/api/test-e2e-monitor.mjs` / `test-e2e-check.mjs` | Debug polls. **No coverage.** |
| `apps/api/test/e2e/builder-*-workflow.e2e-spec.ts` | Documented in 53i / 54g. **Files do not exist.** |
| Unit specs (webhooks, job transformer, line-item sync, invoice publish, task types) | Isolated units. **Do not walk workbook steps.** |
| more0-ensure `assessment-full-e2e.ts` / `works-full-e2e.ts` | External repo, **mocked MCP**, not live CW. Works suite documented as implemented; assessment/make-safe live E2E not in this repo. |

---

## 5. Cross-cutting capability map

Used when grading steps. “IN” = Crunchwork → us. “OUT” = us → Crunchwork.

| Capability | Impl | IN | OUT | Notes |
|------------|------|----|-----|-------|
| Receive allocated BA / BMS / BW job | Partial | Yes | — | `ProjectJobUseCase` + `JobTransformer`. Builder SUT = show the job. more0 start is *our* engine, not required to *receive* the allocation. |
| Status Allocated, claim recommendation, auto-approval | Partial | Yes | Yes | Stored from CW payload / job create. Default Accept is ASL-side. |
| Call to Schedule / Book Site Attendance / fail / complete | Partial | Partial | Yes | `TasksService` emits `task.failed` / `task.completed`. Retry numbering is more0 ASL. Inbound task updates do not emit events. |
| Appointments create / update | Covered | Yes | Yes | `AppointmentsService`. Status Booked/Underway/Finished is CW-driven after push. |
| Appointment cancel | Not covered (default) | — | Gated | `APPOINTMENT_CANCEL_ENABLED=false`. |
| Inbound Status Update message | Covered | Yes | — | `ProjectMessageUseCase`. |
| Outbound message subjects | Covered | — | Yes | `MESSAGE_SUBJECTS` includes complaint + vulnerable. |
| Complaint / CEV body templates | Not covered | — | — | Free-text editor only (`MessageFormDrawer`). |
| Message acknowledge | Not covered (default) | — | Gated | `MESSAGE_ACKNOWLEDGE_ENABLED=false`. |
| Inbound attachment | Covered | Yes | — | `ProjectAttachmentUseCase`. |
| Outbound attachment / assessment report | Covered | — | Yes | Attachments + `AssessmentsService.publish`. |
| Specialist report types → PO line | Not covered | — | Partial | Upload possible; PO mutation not implemented. |
| Quote create / publish | Covered | Partial | Yes | Draft stays local until publish (matches workbook “NA if builder UI”). |
| Auto-approval context on publish | Covered | — | — | `QuotesService.resolveAutoApprovalContext`. Execution is more0 `approve_quote`. |
| Inbound quote reject / resubmit / cash settle | Partial | Yes | — | Projected; no `quote.status_changed` event. |
| Liability Quote type | Covered | — | Yes | `QUOTE_TYPES` includes `Liability Quote`. |
| Line item Cash Settled | Partial | Yes | Partial | Synced from CW; UI badge gap; builder set-on-publish rules unclear. |
| Inbound PO | Covered | Yes | — | `ProjectPurchaseOrderUseCase`. |
| Invoice submit | Covered | — | Yes | `InvoicesService.publish`. |
| Invoice approved (inbound) | Partial | Yes | — | `ProjectInvoiceUseCase.emitIfApproved`. |
| Excess / collectExcess inbound | Partial | Yes | — | Job + claim transformers. Waiver vs collectExcess=No not distinguished. |
| Excess collected (builder marks) | Partial | — | Yes | `excessPaymentCollected` + `field.updated`. |
| Hazardous waste | Not covered | No | — | UI reads `apiPayload.hazardousWaste`; not in `ClaimTransformer`. |
| Vulnerable customer flag | Covered | Yes | — | `ClaimTransformer.vulnerableCustomer`. |
| Builder-created BMS job | Covered | — | Yes | `JobsService.create` starts make-safe workflow; forces `makeSafeRequired=true`. |
| Cancel job (claims) | Partial | Yes | — | `UPDATE_JOB` projects status; no dedicated cancel event / auto invoice reminder. |
| Cancel job (builder) | Partial | — | Partial | Can set `makeSafeRequired=false` / cancelled phase; CW “Closed” vs “Cancelled” wording differs. |
| Works schedule / commence / completion cert | Partial | — | Yes | Tasks + `estimatedDatesSet` + `document.uploaded`. Depends on works workflow running. |

---

## 6. Make Safe (BMS) — step analysis

### TC01 — Call to Schedule and Appointments (26 steps)

Crunchwork allocates a BMS job from CCv8 (excess Yes, make safe Yes, document attached). Builder must see the job, work Call to Schedule (including fail ×4), receive a Status Update, acknowledge it, then complete schedule + appointment.

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | Test lead | Confirm API + staging allocation config | Instruction | Instruction | None | Process check, not product. |
| 2 | CCv8 | Create claim; allocate BMS; attach document | CW: BMS Allocated, recommendation Accept, auto-approval Yes. CCv8: BA + BMS lines. | CW-only | None | IAG instigator. Builder follow-on is step 3. |
| 3 | Builder | Validate BMS allocated in builder UI | Status = Allocated; Auto Approval = Yes | Partial | None | **This is our SUT.** Job must appear from `NEW_JOB`. Status/auto-approval from CW payload (`JobTransformer` / claim). more0 workflow is not required to *show* the allocated job. |
| 4 | Builder | Call to Schedule exists | Task visible; confirm view vs action | Partial | None | **SUT = receive + show + allow fail/complete.** CW already has CTS on Activities (step 5). Expect `NEW_TASK`. Fail/complete APIs exist. Confirm staging webhook; do not assume more0 must create the task. |
| 5 | CW / CCv8 | Call to Schedule #1 on Activities | CW-only (edit/complete/fail) | CW-only | None | IAG. Proves CW created the task. |
| 6 | Builder | Fail Call to Schedule #1 | Builder receives #2; confirm history of completed tasks | Partial | None | **SUT = fail outbound** (`TasksService.update` → CW). Receiving #2 is inbound `NEW_TASK` from CW Pulse, not more0 retry, unless staging shows CW does not create #2. UI lists historical tasks. |
| 7 | CW / CCv8 | After fail #1: Contact Date, Attendance Due Date +3 days, #2 created | CW-only | CW-only | None | CW Pulse dates + next task. Builder later *displays* those fields via `UPDATE_JOB`. |
| 8 | Builder | Fail Call to Schedule #2 | Receive #3 | Partial | None | Same as step 6: fail outbound, receive next task. |
| 9 | CW / CCv8 | #3 created; two failed + one open | CW-only | CW-only | None | IAG. |
| 10 | Builder | Fail #3 | Receive #4 | Partial | None | Same as step 6. |
| 11 | CW / CCv8 | #4 created | CW-only | CW-only | None | IAG. |
| 12 | Builder | Fail #4 | Receive #5 | Partial | None | Same as step 6. |
| 13 | CW / CCv8 | #5 created; CCv8 Service Request Alert after 4 fails | CW-only | CW-only | None | Alert is CCv8 — not Builder. |
| 14 | CCv8 | Send Status Update on BMS | CW receives IAG Status Update | CW-only | None | Instigator step. |
| 15 | Builder | Status Update visible | Message type Status Update from IAG | Covered | None | `NEW_MESSAGE` → `ProjectMessageUseCase`. Subject list includes Status Update. Sender display depends on payload mapping. |
| 16 | Builder | Acknowledge message | Ack from builder UI | **Not covered** | None | `POST /messages/:id/acknowledge` exists but throws unless `MESSAGE_ACKNOWLEDGE_ENABLED=true`. UI has “Requires Acknowledgement” on **outbound** compose, not an inbound ack action wired for E2E. |
| 17 | CW / CCv8 | Message leaves CW dashboard | CW-only | **Not covered** | None | Requires step 16 outbound ack to CW. |
| 18 | Instruction | Option 1 (complete CTS then book) vs Option 2 (appt only) | Instruction | Instruction | None | Test design note. |
| 19 | Builder | Option 1: complete CTS #5 | Book Site Attendance created | Partial | None | **SUT = complete task outbound.** Book Site Attendance should arrive as `NEW_TASK` from CW after complete. more0 create is our duplicate path. |
| 20 | CW / CCv8 | Book Site Attendance exists; fail/complete history | CW-only | CW-only | None | IAG. |
| 21 | Builder | Create Inspection / Make Safe / Onsite / future appt | Appt Booked; job In Progress | Covered | None | `AppointmentsService.create` pushes to CW. Job “In Progress” is a CW status we should re-project (`UPDATE_JOB`), not a more0-only phase. |
| 22 | CW / CCv8 | Booked; Book Site Attendance auto-complete; Scheduled; Attendance/Booked dates | CW-only | CW-only | None | CW Pulse after our create. |
| 23 | Builder | Move appt date/time to now | Status = Underway | Partial | None | Update appointment API exists. Underway is a CW status after sync; we do not locally compute Underway from “now”. |
| 24 | CW / CCv8 | Underway + timezone | CW-only | Partial | None | Relies on outbound update. |
| 25 | Builder | Cancel appt; reason required; send IAG message | Status Cancelled; locked | **Not covered** | None | Cancel gated off. No forced cancellation reason. No required outbound message on cancel. Workbook prefers edit over cancel. |
| 26 | CW / CCv8 | Cancelled appt + message | CW-only | **Not covered** | None | Comment on sheet: cancel-before-quote should **not** generate a cancellation message (IAG fix). |

**TC01 result (Builder only):** Receive allocated job + inbound Status Update are closest to ready. Fail/complete CTS is implemented if the task is projected. Hard Builder fails: **ack (16)** and **appt cancel (25)**. Step 4 is a staging check (`NEW_TASK`), not a more0-start requirement.

---

### TC02 — Cancellations and Registrations (12 steps)

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | CCv8 | Cancel BMS from CCv8 | CW/CCv8 status Cancelled. Known CW queue bug (allocation ID on message). | CW-only | None | Instigator. |
| 2 | Builder | Job shows Cancelled | Status = Cancelled | Partial | None | `UPDATE_JOB` projects status if CW sends Cancelled. No workflow cancel event. UI must map CW status lookup. |
| 3 | Builder | **Create** BMS from builder UI | In Progress; Call to Schedule; Accept; Auto Approval Yes | Covered | None | This is the **one** BMS path that matches `JobsService.create` (same as our local trigger). `applyMakeSafeRequiredDefault` forces make-safe true. Auto-approval Yes is the workbook’s go-live gate. |
| 4 | CW / CCv8 | CW receives builder-created BMS; Auto Approval **must be Yes** | CW-only | Partial | None | Outbound job create exists (`job-outbound.utils`). Auto-approval Yes must be on the CW payload — confirm `autoApprovalApplies` is sent. |
| 5 | Builder | Cancel BMS from builder UI (or CW Make Safe Required = No) | Status = Closed | Partial | None | We can emit `field.updated` for `makeSafeRequired` and set cancelled phase. Workbook expects **Closed**; we more often use **Cancelled**. Confirm UX exists to cancel. |
| 6 | CW / CCv8 | Cancelled; open CTS auto-complete; possible stray Book Site Attendance (known CW issue) | CW-only | Partial | None | Outbound cancel / makeSafeRequired=false. |
| 7 | Builder | Create second BMS after cancel | Allocated; CTS; Accept; Auto Approval Yes | Covered | None | Same as step 3. |
| 8 | CW / CCv8 | Second BMS received | CW-only | Partial | None | Same as step 4. |
| 9 | Builder | Create Inspection appt **in the past** | Appointment status = Finished | Partial | None | Create works. Finished is CW-computed from past datetime after push; we do not set Finished locally. |
| 10 | CW / CCv8 | Finished; last appt wins Attendance Date | CW-only | Partial | None | Attendance date last-appt rule is CW. |
| 11 | Automation | Appt Finished → Awaiting Submission + Submission Required + due date | Builder sees those fields | Partial | None | `AttendanceDateScheduler` / more0 `attendance_date_passed`. Needs workflow. |
| 12 | CW / CCv8 | Same; CCv8 Await AR | CW-only | Partial | None | Sheet comment: Adriana said this step may be NA for BMS — validate next run. |
| 13 | Instruction | Pause; switch to BA | Instruction | Instruction | None | |

**TC02 result:** Builder-created BMS (registration) is the strongest BMS coverage we have. Claims-cancel inbound and Finished→Awaiting Submission are Partial. Closed vs Cancelled wording is a likely fail.

---

### TC03 — Quotes and Purchase Orders (10 steps)

Workbook creates/publishes a make-safe quote expecting auto-approval, then a second quote path. Draft steps are **NA if using builder UI** (we do not push drafts).

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | Builder | Create draft quote | Draft in builder UI | Covered | None | Quotes stay local until publish. |
| 2 | Instruction | Draft not sent until publish | Instruction | Instruction | None | Matches our design. |
| 3 | Builder | Publish; auto-approval path | Publish from UI | Covered | None | `QuotesService.publish` → CW + `quote.published` with auto-approval context. |
| 4 | CW / CCv8 | Auto-approved; PO created | CW-only | Partial | None | Auto-approve is more0 `approve_quote`. PO arrives as `NEW_PURCHASE_ORDER` — inbound Covered. End-to-end depends on workflow receiving `quote.published`. |
| 5 | Builder | Second draft quote | Draft | Covered | None | |
| 6 | Instruction | NA if builder UI | Instruction | Instruction | None | |
| 7 | Builder | Publish second (auto-approval) | Publish | Covered | None | |
| 8–9 | CW / CCv8 | Auto-approval + PO validation | CW-only | Partial | None | Same as step 4. Sheet has duplicated publish/validate rows. |
| 10 | Builder | Confirm auto-approval / PO in UI | PO visible on job | Covered | None | Inbound PO projection. |

**TC03 result:** Publish + inbound PO are implemented. Auto-approval **execution** is more0, and only if the job workflow is running. Variation-after-make-safe (PDF TC09) is not a separate workbook case here; variation is tested on BW TC17.

---

### TC04 — Invoicing (12 steps)

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | Builder | Create invoice | Invoice draft | Covered | None | |
| 2 | Builder | Submit invoice | Published to CW | Covered | None | `InvoicesService.publish`. |
| 3 | CW / CCv8 | Invoice received | CW-only | CW-only | None | |
| 4 | Builder | See Approved | Status Approved | Partial | None | Inbound `UPDATE_INVOICE` + `emitIfApproved`. UI must refresh from projection. |
| 5 | CCv8 | Approve invoice | CW-only | CW-only | None | Instigator. |
| 6 | Automation | Invoice completed | Builder sees Completed | Partial | None | CW status projection. |
| 7 | CW / CCv8 | Completed | CW-only | Partial | None | |
| 8 | Automation | Invoice attachments appear | Attachments on invoice | Partial | None | Inbound attachments Covered; linking to invoice depends on CW parent refs. |
| 9 | CW / CCv8 | Attachments | CW-only | Partial | None | |
| 10 | Automation | Job status Complete | Job Complete | Partial | None | Requires `purchase_order.completed` event. Inbound PO complete **does not emit** that event — only API `PurchaseOrdersService.update`. **Blocker** if CW marks PO complete. |
| 11 | CW / CCv8 | Job Complete | CW-only | Partial | None | |
| 12 | Instruction | Return to BA Reports | Instruction | Instruction | None | |

**TC04 result:** Submit invoice is Covered. Job Complete after CW-approved invoice is Partial because inbound PO completion does not advance more0.

---

## 7. Builder Assessment (BA) — step analysis

### TC05 — Excess (8 steps + prereqs)

Same claim as BMS. Crunchwork changes excess amount, collect-excess No, then Yes+waive.

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | Test lead | Confirm API + staging; continues BMS claim | Instruction | Instruction | None | |
| 2 | CCv8 | Allocate BA; excess Yes; make safe Yes; document | CW/CCv8 flags | CW-only / inbound Partial | None | Job + `collectExcess` / `makeSafeRequired` mapped. Document via `NEW_ATTACHMENT`. Workflow not started. |
| 3 | Builder | BA received: contacts, claim status, PO, excess = Yes | Those fields in UI | Partial | None | Contacts and excess project. PO may be empty at allocation. Claim status from claim projection. |
| 3b | CCv8 | Reduce excess to $100 | CW excess $100 | CW-only | None | Instigator. |
| 4 | Builder | Excess shows $100 | Value updates | Partial | None | `JobTransformer` / `ClaimTransformer` map `excess`. Needs `UPDATE_JOB` or `UPDATE_CLAIM`. No automated test that UI refreshes. |
| 5 | CCv8 | Collect excess = No | CW Collect Excess = No | CW-only | None | |
| 6 | Builder | Collect excess flag = No | Flag updates | Partial | None | `collectExcess` mapped. |
| 7 | CCv8 | Collect Yes then waive | CW ends Collect Excess = No | CW-only | None | Waiver is a CCv8 action; we only see resulting `collectExcess`. |
| 8 | Builder | Flag = No after waive | Same as collect=No | Partial | None | We cannot distinguish waived vs not-collected. Workbook only checks the flag. |

**TC05 result:** Field mapping exists. No E2E. Waiver semantics are not modelled separately.

---

### TC06 — Hazardous Waste and Vulnerable Customer (4 steps)

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | CCv8 | Hazardous waste Yes; Mould, Asbestos | CW Hazardous Waste text | CW-only | None | |
| 2 | Builder | Confirm API shares hazardous waste | Flag + types in UI | **Not covered** | None | UI `ClaimDetail` reads `hazardousWaste` from payload. `ClaimTransformer` does **not** persist it. `claim-cw-api-db-ui-gap.md` treats it as non-contract. Workbook expects builder to receive it. |
| 3 | CCv8 | Vulnerable customer + type | CW Vulnerable = Yes | CW-only | None | |
| 4 | Builder | Confirm API shares vulnerable customer | Flag in UI | Covered | None | `vulnerableCustomer` + `vulnerabilityCategory` in transformer and Compliance UI. |

**TC06 result:** Vulnerable customer Covered. Hazardous waste **Not covered** as a first-class inbound field.

---

### TC07 — Call to Schedule (10 steps)

Same fail ×4 pattern as BMS TC01 steps 6–13, on the BA job.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1 | Builder | Fail CTS to drive CCv8 alert (intro) | Partial | None | Same blockers as BMS: workflow not started on inbound job. |
| 2 | CW / CCv8 | CTS #1 exists | Partial | None | |
| 3–10 | Builder / CW | Fail 1–4; #2–#5 created; CCv8 alert | Partial | None | `task.failed` + more0 retry. **No coverage** as a CW-instigated automated test. |

**TC07 result (Builder only):** Same as BMS CTS — fail outbound + receive next task. Not a more0-start requirement unless staging S1/S2 fail.

---

### TC08 — Specialist Appointments and Inspections (15–18 sheet rows)

Option 1 vs both-options appointment flow, then update, cancel, **specialist** appt, **inspection** appt, Finished automation.

| Step | Actor | Action (summary) | Builder assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|-------------------|------|----------|----------|
| 1 | Instruction | Option 1 vs both | Instruction | Instruction | None | |
| 2–3 | Builder / CW | Option 1: complete CTS #5 → Book Site Attendance | Partial | None | Same as BMS 19–20. |
| 4–5 | Builder | Both options: create future Inspection appt | Booked | Covered | None | Generic appointment create. |
| 6–7 | Builder / CW | Complete CTS #5 (duplicate numbering on sheet) | Partial | None | Workflow. |
| 6b–7b | Builder / CW | Update appt to now → Underway | Partial | None | Same as BMS 23–24. |
| 8–9 | Builder / CW | Cancel appt | **Not covered** | None | Flag off; no required IAG message. |
| 10–11 | Builder / CW | Specialist appointment | Visible to insurer | Partial | None | Assessment specialists section + generic appointments. No distinct CW “specialist appointment” type or specialist-type-visit enforcement. PDF TC18 expects insurer visibility. |
| 12–13 | Builder / CW | Inspection appointment | Inspection type | Covered | None | Type = Inspection is supported if lookup exists. |
| 14–15 | Automation / CW | Finished → Awaiting Submission + Submission Required | Partial | None | Scheduler + more0. |
| 16 | Instruction | Pause; return to BMS quotes | Instruction | Instruction | None | |

**TC08 result:** Inspection create is Covered. Specialist-specific appointment and cancel are Partial / Not covered.

---

### TC09 — Reports (6 steps)

| Step | Actor | Action (summary) | Builder / inbound assertion | Impl | Auto E2E | Analysis |
|------|-------|------------------|------------------------------|------|----------|----------|
| 1 | Builder | Share Assessment Report | Document type Assessment Report | Covered | None | `AssessmentsService.publish` + `document.uploaded` type Assessment Report. Attachments API also accepts a type. |
| 2 | CW / CCv8 | CW Attachments; CCv8 Report / Building | CW-only | CW-only | None | CCv8 DocType mapping is IAG. Builder duty is sending the correct CW document type on step 1. |
| 3 | Builder | Share Plumbing Report (or listed specialist types) | Specialist document type | Partial | None | Upload works if the type exists in lookups. No template/picker guaranteed for Solar / Asbestos / Roofing / etc. |
| 4 | CW / CCv8 | Plumbing Report on BA; **PO gains Plumbing line** | CW-only | CW-only | None | PO line is **CW Pulse** after we upload the right type. Not a Builder implementation gap. |
| 5 | CCv8 | Attach previously imported document to SR | CW Project Attachment | CW-only | None | Instigator. |
| 6 | Builder | Document received from CW | File visible / downloadable | Covered | None | `NEW_ATTACHMENT` + download proxy. |

**TC09 result (Builder only):** Assessment report + inbound docs Covered. Specialist **upload type** is Partial (picker/lookups). The PO line on step 4 is CW, not us.

---

### TC10 — Quotes, Purchase Orders and Messaging (20 steps)

Null quote (No Resultant Damage) to force auto-approval **fail**, resubmit, inbound Status Update, ack, then a second quote with Cash Settled + Draft lines and Accept – Component Requires Settlement.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1 | Builder | Draft null quote; catalog No Resultant Damage; Claim Rec = Cancel – No Resultant Damage | Partial | None | Quote create + catalog Covered. Claim recommendation values and “No Resultant Damage” catalog item must exist in staging. Estimated start/end are on quote overview. |
| 2 | CW | Draft visible — **NA if builder UI** | Instruction | None | We skip draft push. |
| 3 | Builder | Publish (auto-approval fail) | Covered | None | Publish API. Fail is expected when recommendation ≠ Accept or other CW rules (workbook also lists repair value and claim decision). |
| 4 | CW / CCv8 | Published; Awaiting Review; SOW + Quote PDFs; CCv8 Quote Review alert | CW-only | CW-only | None | Auto-approval fail + alert are IAG. We must have published with fields CW can score. |
| 5 | CCv8 | Resubmit quote | CW-only | None | Instigator. |
| 6 | Builder | Quote = Resubmission Required; job Awaiting Resubmission | Partial | None | **SUT = display inbound status.** `UPDATE_QUOTE` / `UPDATE_JOB` project. more0 `quote.status_changed` is our engine, not required for IAG to see the status in CW. |
| 7 | CCv8 | Status Update with resubmit reason | CW-only | None | |
| 8 | Builder | Message from IAG visible | Covered | None | |
| 9–10 | Builder / CW | Acknowledge | **Not covered** | None | Flag off. |
| 11 | Builder | New quote or revision: mix Cash Settled + Draft; recommendation Accept – Component Requires Settlement | Partial | None | Revision/create Covered. Setting line scope to Cash Settled on publish is Partial (sync inbound; builder-set + UI badge gap). |
| 12 | CW | Draft — NA if builder UI | Instruction | None | |
| 13–20 | Builder / CW | Publish quote 2, PO, remaining messaging (sheet remainder) | Partial | None | Same publish/PO/message pattern as TC03 + TC13. |

**TC10 result:** Publish and inbound messages Covered. Resubmission status, claim-recommendation catalog, cash-settled line mix, and ack are Partial / Not covered.

---

### TC11 — Quote – Partial Settlement (11 steps)

Workbook repeats a dedicated claim/job for partial settlement (cash-settled components + accept remainder). Structure mirrors TC10 quote 2.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–3 | CCv8 / Builder | New/confirm BA allocation | Partial | None | Inbound job; no workflow. |
| 4–7 | Builder / CW | Draft + publish quote with partial cash settlement | Partial | None | Quote type Quote; mixed lineScopeStatus. No dedicated “partial settlement” API. |
| 8–11 | CCv8 / Builder | Insurer actions + builder confirmation of statuses / PO | Partial | None | Inbound quote/PO projection; no status events. |

**TC11 result:** **Not covered** as a named business rule. Closest path is generic quote + lineScopeStatus.

---

### TC12 — Liability Quote (11 steps)

Must be a **new claim**, not a new allocation on the same BA.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–3 | CCv8 / Builder | New claim + BA allocated | Partial | None | Inbound job. |
| 4 | Builder | Liability Quote; all lines Cash Settled; rec = Accept – Customer Requests Settlement; **new quote not amendment** | Partial | None | `QUOTE_TYPES` includes Liability Quote. Estimated dates on overview. Claim recommendation + all-lines Cash Settled are Partial. |
| 5 | CW | Draft — NA if builder UI | Instruction | None | |
| 6–7 | Builder / CW | Publish; auto-approval fails; Awaiting Review; PDFs; CCv8 alert for Customer Requests Settlement | Partial | None | Publish Covered. Alert text is CCv8. |
| 8 | CCv8 | Cash Settle action on liability quote | CW-only | None | Instigator. |
| 9 | Builder | Quote status Cash Settled; job still Awaiting Review | Partial | None | Projection only; no workflow event. |
| 10 | CCv8 | Cancel BA allocation; auto cancel message | CW-only | None | Known CW queue bug. |
| 11 | Builder | Job Cancelled; PO unchanged; cancel message from IAG | Partial | None | Status + inbound message Covered if CW sends them. PO “unchanged” is default (we do not auto-close PO). |

**TC12 result:** Liability Quote **type** is Covered. Cash Settled insurer action and cancel-message pairing are Partial. No automated coverage.

---

### TC13 — Messaging, Customer Complaint and Vulnerable Customer (8 steps)

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–2 | Builder / CW | Auto-cancel message from IAG on prior cancel | Partial | None | Inbound message Covered. Workbook requires sender = IAG, not in Claim Notes (CCv8). |
| 3–4 | Builder / CW | Send **Customer Complaint – Supplier Services** with full template | Partial | None | Subject exists. **Body template not prefilled.** CCv8 Complaint Review Required is CW-only. |
| 5–6 | Builder / CW | Send **Customer Complaint – Insurance Services** with template; second workplan activity | Partial | None | Same: subject only. |
| 7–8 | Builder / CW | Send **Vulnerable Customer** with CEV template (category number only, etc.) | Partial | None | Subject exists. **Template not prefilled.** CCv8 Review CEV Referral is CW-only. |

**TC13 result:** Subjects Covered. Template-driven bodies **Not covered**. Will fail the “template populates in message field” assertion.

---

### TC14 — Invoicing (11 steps)

Same shape as BMS TC04: create → submit → CW approve → completed → attachments → job complete.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–3 | Builder / CW | Create + submit invoice | Covered / CW-only | None | |
| 4–5 | CCv8 / Automation | Approve; builder sees Approved | Partial | None | Inbound `emitIfApproved`. |
| 6–9 | Automation / CW | Completed + attachments | Partial | None | |
| 10–11 | Automation / CW | Job Complete | Partial | None | Same inbound PO-complete event gap as BMS. |

---

## 8. Builder Works (BW) — step analysis

Works jobs are typically **spawned by Crunchwork** after BA quote approval (Crunchwork instigates), not created by our BA workflow spawn unless more0 calls create-job.

### TC15 — Excess Changes (22 steps)

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–2 | Test lead / CCv8 | Prereqs; comment says steps may belong at tail of BA | Instruction | None | |
| 3–4 | Builder / CW | Works job created & allocated | Partial | None | Inbound `NEW_JOB` for works type. `WORKFLOW_CAP_MAP` uses `Builder - Scope of Works`. Confirm CW job type name matches. **Workflow not started.** |
| 5–6 | Builder / CW | Excess collection UI | Partial | None | `collectExcess` / `excess` on job. Works ASL tasks Send/Collect Excess are more0. |
| 7–8 | CCv8 / Builder | Alter excess amount | Partial | None | Same as BA TC05. |
| 9–10 | CCv8 / Builder | Excess No | Partial | None | |
| 11–12 | CCv8 / Builder | Excess waived | Partial | None | No distinct waived flag. |
| 13–14 | CCv8 / Builder | Excess reinstated | Partial | None | Another `UPDATE_JOB`/`UPDATE_CLAIM`. |
| 15–16 | Builder / CW | Awaiting Excess status | Partial | None | Workflow phase. |
| 17–18 | Automation / CW | Awaiting Excess automated tasks | Partial | None | more0 works ASL. |
| 19–20 | Builder / CW | Mark excess collected | Partial | None | `excessPaymentCollected` + `field.updated`. |
| 21–22 | Automation / CW | Tasks after collected | Partial | None | more0. External `works-full-e2e.ts` covers a mocked excess scenario — **not** live CW. |

**TC15 result:** Field updates Partial. Full Awaiting Excess automation **Not covered** for CW-instigated works until inbound workflow start.

---

### TC16 — Schedule and Commence Repairs (8 steps)

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–2 | Builder / CW | Schedule repairs (estimated start/end) | Partial | None | Job customData + `estimatedDatesSet` (55d). |
| 3–4 | Automation / CW | Schedule tasks complete / next tasks | Partial | None | more0. |
| 5–6 | Builder / CW | Repairs in Progress; Works Commencement Date | Partial | None | Status + `worksCommencementDate`. |
| 7–8 | Automation / CW | Commence Repairs complete; Upload Completion Certificate created; Repair Update cycle | Partial | None | Task types exist. Repair-update due dates are ASL (55e). |

**TC16 result:** Data fields Partial. Automation is more0 and untested against CW.

---

### TC17 — Quotes and Messaging (35 steps)

Positive variation (auto-approve), messages both ways, ack, auto-approval **fail** variation, insurer approve, then **negative** variation.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1 | Builder | Create variation (dates, Quote Type = Variation, reason) | Covered | None | `QUOTE_TYPES` includes Variation; `reasonForVariation` on overview. |
| 2 | Instruction | Draft NA if builder UI | Instruction | None | |
| 3–4 | Builder / CW | Publish variation | Covered / CW-only | None | `quote.published` includes quoteType. |
| 5–8 | Automation / CW | Tasks after variation publish (two waves) | Partial | None | more0 works variation path. Mocked in external works E2E scenario 3. |
| 9–10 | Builder / CW | Outbound builder message | Covered | None | Subjects include Repair Update / Status Update / General. |
| 11–12 | CCv8 / Builder | Inbound IAG message | Covered | None | |
| 13–14 | Builder / CW | Acknowledge | **Not covered** | None | Flag off. |
| 15–16 | CCv8 / Builder | Auto-approval fail setup; builder checks project status | Partial | None | |
| 17–20 | Builder / CW | Create + publish variation that fails auto-approval | Covered / Partial | None | Publish Covered; fail is CW rules. |
| 21–22 | CCv8 / Builder | Insurer approves variation; builder sees Approved | Partial | None | Inbound quote status; **no `quote.status_changed`**. |
| 23–24 | Automation / CW | Approval automation tasks | Partial | None | more0. |
| 25–35 | Builder / CW / Automation | Negative variation create/publish/tasks | Partial | None | Variation with negative value is just another quote; no dedicated negative-variation validator. Task waves are more0. |

**TC17 result:** Variation create/publish and two-way messaging (except ack) are the strongest BW coverage. Insurer-approve event and negative-variation automation are Partial. No live CW auto E2E.

---

### TC18 — Invoicing and Job Completion (26 steps)

Two invoice cycles (progress + final) plus repairs-complete and job complete.

| Step | Actor | Action (summary) | Impl | Auto E2E | Analysis |
|------|-------|------------------|------|----------|----------|
| 1–2 | Builder / CW | Submit invoice 1 | Covered | None | |
| 3–4 | CCv8 | Approve invoice 1 | Partial | None | Inbound approve event. |
| 5–8 | Automation / CW | Completed + attachments; status stays Repairs in Progress | Partial | None | Progress invoice not a separate type — generic invoice. |
| 9–10 | Automation / CW | Job still Repairs in Progress | Partial | None | |
| 11–14 | Builder / CW / Automation | Repairs Complete; completion certificate; task close | Partial | None | `document.uploaded` if category matches completion certificate. |
| 15–22 | Builder / CW | Submit + approve final invoice; attachments | Covered / Partial | None | Same as first cycle. |
| 23–26 | Builder / CW | Job Complete (duplicated builder/CW rows) | Partial | None | Needs PO complete event. Inbound PO complete does not emit `purchase_order.completed`. |

**TC18 result:** Invoice submit Covered. Job Complete on a CW-closed PO is **Not covered** as a workflow trigger.

---

## 9. Steps with no meaningful coverage

**Builder-actor gaps only.** CW/CCv8 rows are IAG’s system.

### Confirm on staging (not assumed product gaps)

| ID | Check | If it fails |
|----|-------|-------------|
| S1 | After CW allocates, does `NEW_TASK` (Call to Schedule) land in our UI without more0 starting? | Then start workflow or create the task — **then** it is G1. |
| S2 | After we fail CTS via API, does CW create #2 and webhook it? | Then more0 retry is required (old G9). |
| S3 | After we publish, does CW auto-approve / fail without our `approve_quote`? | more0 auto-approve is only for our engine. |

### Builder features gated or missing

| ID | Gap | Builder steps |
|----|-----|---------------|
| G4 | Message acknowledge disabled | TC01 16; TC10 9; TC17 13 |
| G5 | Appointment cancel disabled; no reason; no required IAG message | TC01 25; TC08 8 |
| G6 | Complaint / CEV message **body templates** | TC13 3, 5, 7 |
| G7 | Hazardous waste inbound mapping | TC06 2 |
| G12 | Set Cash Settled line status + claim-recommendation values on publish | TC10 1, 11; TC11; TC12 4 |
| G13 | Builder cancel BMS → status CW expects (Closed vs Cancelled) | TC02 5 |

### Dropped as Builder gaps (IAG / CW Pulse)

| Old ID | Why dropped |
|--------|-------------|
| G1 as workbook blocker | CTS is created on CW Activities; Builder receives it. more0 start is our engine / fallback if S1 fails. |
| G2 as “255 steps uncovered” | Denominator is ~89 Builder steps. Still **0** automated Builder E2E. |
| G3 as IAG blocker | more0 events are our workflow. Builder must **display** inbound quote/PO/invoice status (projection). |
| G8 specialist report → PO line | CW expected result after Builder upload. |
| G9 CTS #2–#5 in this repo | CW Pulse after we fail, unless S2 fails. |
| G10 Underway/Finished | CW computes; we re-project. Not a Builder algorithm gap. |
| G11 waived vs collectExcess=No | Workbook Builder row only checks the flag. |
| G14 cancel message pairing | CW generates the IAG cancel message; Builder **receives** it (TC13 1). |

### Covered enough to attempt as Builder (no more0 start required)

- Inbound job + claim + excess + vulnerable customer **display**
- Inbound Status Update / general messages
- Outbound Status Update / General / Repair Update (free text)
- Builder-created BMS job (TC02 registration)
- Quote / variation / liability **type** create + publish
- Invoice submit
- Assessment report upload
- Inbound attachments
- Appointment **create** (Inspection)
- Task complete/fail **APIs** once the inbound task exists

---

## 10. Mapping to the older 20-case testing plan

The PDF (`TC01`–`TC20`) is a shorter parent of this workbook.

| PDF | Workbook | Coverage |
|-----|----------|----------|
| TC01 Automatic BMS creation | TC01 step 2–3 | Partial — Builder must **show** inbound job (workflow start not required) |
| TC02 Automatic BA creation | TC05 / TC07 prereqs | Partial — same |
| TC03 Automatic Works creation | TC15 3–4 | Partial — same |
| TC04 Data storage all types | Spread across prereqs | Partial |
| TC05 BMS E2E | TC01–TC04 | Partial; no auto E2E |
| TC06 BA E2E | TC05–TC14 | Partial; no auto E2E |
| TC07 Works E2E | TC15–TC18 | Partial; mocked works E2E external only |
| TC08 BMS quote auto-transfer | TC03 | Partial (publish Covered) |
| TC09 BMS variation after further works | Not a standalone revised case (see TC17) | Partial |
| TC10 BA quote + cash settlement lines | TC10 / TC11 | Partial |
| TC11 Works variations | TC17 | Partial |
| TC12 Vendor attachment upload | TC09 1–4; invoice attachment rows | Partial |
| TC13 Receive insurer attachments | TC09 5–6; BMS prereq document | Covered |
| TC14 Vendor sends messages | TC13; TC17 9–10 | Partial (no templates) |
| TC15 Receive insurer messages | TC01 14–15; TC10 7–8; TC17 11–12 | Covered |
| TC16 BMS appointment complete | TC01 21–24; TC02 9–11 | Partial |
| TC17 BA appointment complete | TC08 | Partial |
| TC18 Specialist appointment | TC08 10–11 | Partial |
| TC19 Specialist report | TC09 3–4 | Partial upload types; PO line is CW |
| TC20 Vendor creates BMS | TC02 3–4, 7–8 | Covered (create path) |

---

## 11. Recommended order to become E2E-ready (Builder)

1. **Staging checks S1–S3** — after a real CW allocation, confirm job + CTS task + dates arrive by webhook with more0 **not** started. That decides whether G1/G9 are real Builder work.
2. **Builder-actor harness** — receive webhook → assert job/task/message in our API/UI → fail task / publish quote / send message. Do not treat `POST /jobs?provider=direct` as the IAG path (that is TC02 registration only).
3. Turn on or productise **message acknowledge** and **appointment cancel** (or tell IAG those Builder steps are out of scope).
4. Add complaint / CEV **message body templates**.
5. Map **hazardous waste** if IAG will fail the Builder row of TC06.
6. Let Builder set **Cash Settled** line status and the claim-recommendation values the quotes cases name.
7. Optionally emit inbound `quote.status_changed` / `purchase_order.completed` for *our* more0 UI — not required for IAG CW checks.

---

## 12. Source sheet index

| Sheet | Cases | Official step counts (Quick Reference) |
|-------|-------|----------------------------------------|
| Quick Reference | Categories 1–18 | 255 |
| Make Safe (BMS) | TC01–TC04 | 26 + 12 + 10 + 12 |
| Builder Assessment (BA) | TC05–TC14 | 8 + 4 + 10 + 15 + 6 + 20 + 11 + 11 + 8 + 11 |
| Builder Works (BW) | TC15–TC18 | 22 + 8 + 35 + 26 |

All steps are **TestType = Manual**. Story IDs used on the sheet include `PFTCE-3351` (allocation / registration), `PFTCE-3352` (tasks), `PFTCE-3353` (appointments), `PFTCE-3355` (documents from claims), `PFTCE-3356` (messages), `PFTCE-3357` (status / cancel), `PFTCE-3358` (reports), `PFTCE-3359` (quotes).
