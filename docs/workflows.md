# Job workflows

This document explains how Builder Assessment, Builder Make Safe, and Builder Works jobs are driven end to end. It is written as a story of what happens on a claim, not as a technical specification of the workflow engine.

The three job types follow the same idea: a person does work in claims-manager (complete a task, book a visit, publish a quote, upload a file). The system notices, advances the job, and creates the next piece of work. The person does not have to remember which status to set next.

---

## The loop in plain language

Three systems share the work.

**Claims-manager** is the application people use. Jobs, tasks, quotes, appointments, documents, invoices, and purchase orders live here.

**The workflow engine** (more0-ensure) holds a playbook for each job type. When a matching job is created, claims-manager starts that playbook and then waits. The playbook never talks to the database itself. It either *does something* through a tool, or *waits* for news.

**Claims-mcp** is the bridge for those tools. When the playbook says “create a task” or “update this job”, that request is an MCP tool call (`tool.claims…`). The MCP server turns it into a normal API request on claims-manager. The job and task lists update as if a user had done it.

News travels the other way. When something important happens in claims-manager, it fires a **domain event** at the workflow engine (for example `task.completed` or `quote.published`). If the playbook is sitting in a wait that matches that event, it wakes up and continues.

```
  Person or timer does something in claims-manager
           │
           ▼
  Domain event  ──────────────────────────►  workflow waits / resumes
           │
           ▼
  Workflow MCP call  ──►  claims-mcp  ──►  claims-manager (create task, update job, …)
           │
           ▼
  Job fields, status, and next tasks change
```

Nothing in the playbook is a “click” in the UI. Transitions are always: **an event arrived** or **a choice inside the playbook** (for example “is excess required?”). The **result** of a transition is almost always one or more MCP calls, then another wait.

---

## How a workflow starts

When a job is created whose type is one of:

| Job type in claims-manager | Playbook that starts |
|----------------------------|----------------------|
| Builder Assessment | `workflow.job.assessment` |
| Builder Make Safe | `workflow.job.make-safe` |
| Builder - Scope of Works | `workflow.job.works` |

claims-manager invokes that playbook and passes starting facts: the job id, the claim id, request date, whether excess should be collected, the excess amount, the claim recommendation, and lookup ids so a child job can be created later (Make Safe or Works).

Creating a Works job from an approved assessment uses the same path: the assessment playbook calls `create_job`, claims-manager saves the new job, and the Works playbook starts on that new job.

---

## What “waiting” means

Most of the time a running job is **paused** in a wait. The wait lists the events it cares about. Other events are ignored. Completing the wrong task does not move the job.

Several waits listen for more than one kind of news. For example, after “Call to Schedule” exists, the assessment playbook will continue if the user completes that task *or* books the appointment directly. Booking first is treated as “we already know the date — close the call task and skip booking another one.”

Some waits also listen for a **side track**. Repair Update on Works, Make Safe Required on Assessment, and variation quotes during repairs are examples: the main story pauses, a short branch runs, then the playbook returns to the same wait.

---

## Domain events (what wakes a wait)

These are the events claims-manager currently sends for job workflows. Each is about a **job** (the workflow is always keyed to the job id).

| Event | When it is sent | Typical payload the wait uses |
|-------|-----------------|-------------------------------|
| `task.created` | A task is created on a job (including inbound sync from Crunchwork) | Task id, task name, origin |
| `task.completed` | A task is marked completed | Task name, completed time |
| `task.failed` | A task is marked failed | Task name |
| `appointment.scheduled` | A site visit is booked on the job | Appointment id, booked time, visit date |
| `attendance_date_passed` | A scheduler sees that the job’s attendance date is in the past and the job is still in the scheduled phase | Job id |
| `quote.published` | A quote on the job is published | Quote id, quote type (original vs variation), auto-approval flags |
| `quote.status_changed` | Quote status changes (Approved, Declined, Resubmission Required, …) | New status |
| `field.updated` | Certain job fields change (see below) | Field name and new value |
| `document.uploaded` | A job document finishes upload or is assigned a category | Category name as `documentType` |
| `purchase_order.completed` | The job’s purchase order is fully invoiced / completed | Purchase order id |
| `invoice.approved` | An invoice on the job is approved | Invoice id |
| `job.created` | A job is created | Job type, parent job if any |

### Fields that emit `field.updated`

When these are written on the job (usually under custom data), a `field.updated` event is sent so a wait can treat a **field change** the same as a **task completion**:

- `workflowPhase`
- `makeSafeRequired`
- `scopeSignedDate`
- `excessPaymentCollected`
- `estimatedDatesSet` (also auto-set when both estimated start and estimated completion dates exist)
- `dateCustomerConfirmedCompletion`
- `dateMakeSafeCompleted`

Setting both estimated start and estimated completion dates is enough: claims-manager sets `estimatedDatesSet` and fires the event with those dates plus `scheduledAt`. The Works playbook does not require a separate “Schedule Repairs” task completion.

When the playbook (or a user) sets `workflowPhase`, claims-manager also tries to set the job’s visible **status** to the matching name (Allocated, Awaiting Scope, Repairs In Progress, Job Complete, and so on). That is how the list and Crunchwork stay aligned with the playbook.

---

## MCP tools the playbooks call (what actually happens)

The playbooks only use a small set of tools. Each call is a side effect in claims-manager.

| Tool | What it does | What you see afterwards |
|------|----------------|-------------------------|
| `tool.claims.create_task` | Creates an open task on the job | A new work item (Send Scope, Call to Schedule, …) |
| `tool.claims.update_task` | Updates a task (usually mark completed, sometimes link an appointment) | The task closes; it may point at the booking |
| `tool.claims.update_job` | Writes custom data and/or dates on the job | Dates filled in; phase (and usually status) changes |
| `tool.claims.create_job` | Creates a child job on the same claim | A Make Safe or Works job appears and starts its own playbook |
| `tool.claims.approve_quote` | Approves the published quote | Quote becomes approved; downstream PO / works spawn can proceed |
| `tool.claims.calculate_dates` | Computes SLA dates from contact or attendance dates | Attendance due date (from contact) or submission due date (from attendance) |

The playbook stores the tool result in its memory (for example the new task id) and then either waits or calls the next tool.

---

## How the three jobs relate

A typical claim does not run all three at once.

1. The insurer allocates a **Builder Assessment**. That playbook runs until the assessment quote is approved (automatically or by the insurer).
2. On approval, the assessment playbook **creates a Builder Works job**. Works then runs independently: scope, excess if needed, schedule, repairs, certificate, invoice.
3. If, while waiting for the assessment visit date to pass, someone sets **Make Safe required**, the assessment playbook **creates a Builder Make Safe job**. Assessment does not stop; it keeps waiting for the attendance date. Make Safe is a separate job with its own playbook (and its own cancel path if Make Safe is later set to no).

Works is also started if a Works job is created by hand or by inbound sync, not only from assessment.

```
Builder Assessment ──(quote approved)──► Builder Works
        │
        └──(make safe required, during scheduled wait)──► Builder Make Safe
```

---

## Builder Assessment

**Purpose:** Contact the customer, attend the property, submit an assessment quote, get it approved, then finish invoicing. When the quote is approved, start Works.

**Starts when:** A Builder Assessment job is created.

### Opening: attach or create “Call to Schedule”

The playbook first tries to reuse a Call to Schedule task that already exists (passed in at start, or arriving as `task.created` from Crunchwork within a short wait). If nothing arrives, it **creates** the task itself (`create_task`).

Then it **updates the job** to phase Allocated and stores the request date (`update_job`).

It waits at **contact or schedule**.

### Contact and booking

| Trigger | What the playbook does |
|---------|-------------------------|
| `task.completed` for Call to Schedule | Treat as “customer contacted”. `update_job` writes contact date and phase Contacted. `calculate_dates` works out attendance due date from contact. `update_job` stores that due date. `create_task` opens **Book Site Attendance**. Then wait for a booking. |
| `task.failed` for Call to Schedule | `create_task` opens **Call to Schedule #2**. Wait again (complete that task or book). |
| `appointment.scheduled` while still on the call task | Booking happened first. `update_job` writes booked date, attendance date, contact date, phase Scheduled. `update_task` completes Call to Schedule and links the appointment. Skip creating Book Site Attendance. Then calculate submission due date and wait for the visit day to pass. |
| `appointment.scheduled` after Book Site Attendance exists | Same date writes and phase Scheduled, then submission due date, then wait for the visit day. |

After a booking, `calculate_dates` uses the **attendance date** to set **submission due date**, then `update_job` stores it.

### After the visit is booked: wait for the day, or spawn Make Safe

The playbook waits until the visit day is over **or** Make Safe is flagged.

| Trigger | What the playbook does |
|---------|-------------------------|
| `attendance_date_passed` (scheduler in claims-manager, typically every 15 minutes, when attendance date is past and phase is still scheduled) | `update_job` sets phase Awaiting Submission. `create_task` opens **Submission Required**. Then wait for a quote. |
| `field.updated` with `makeSafeRequired` = true | `create_job` creates a Builder Make Safe job on the same claim (parent = this assessment). Assessment **returns to the same wait** — it does not skip submission. |

### Quote published

| Trigger | What the playbook does |
|---------|-------------------------|
| `quote.published` | `update_job` writes first/last submission dates and phase Awaiting Review. Then a **choice**: if the quote payload says Accept, auto-approval applies, claim decision Accept, and within delegate authority → `approve_quote`, then `create_job` for **Builder Works** (passing collect excess and excess from this job), then wait for invoice / PO. Otherwise wait for the insurer. |

### Insurer review (when auto-approval does not apply)

| Trigger | What the playbook does |
|---------|-------------------------|
| `quote.status_changed` → Approved | `create_job` for Builder Works (same excess flags), then wait for invoice / PO |
| `quote.status_changed` → Resubmission Required | `update_job` phase Awaiting Resubmission. `create_task` another **Submission Required**. Wait for `quote.published` again |
| `quote.status_changed` → Cash Settled, Declined, or Cancelled | `update_job` records a closed / quote-finalized style phase and the outcome. Workflow **succeeds** (job finished without Works) |

### Invoicing

The playbook waits for `purchase_order.completed` or `invoice.approved`. If the invoice arrives first, it still waits for the PO. When the PO is complete, `update_job` sets phase Complete and the playbook **succeeds**.

---

## Builder Make Safe

**Purpose:** Temporary make-safe at the property: contact, attend, submit a make-safe quote, approve it, then invoice. Can be **cancelled** at several waits if Make Safe is no longer required.

**Starts when:** A Builder Make Safe job is created (from assessment, by a user, or by inbound allocation).

Unlike Assessment, this playbook **always creates** Call to Schedule itself (it does not wait for Crunchwork to sync that task). It also sets claim recommendation to Accept on the job at the start.

The contact → book → attendance date → submit quote story is the same shape as Assessment: complete the call task (or fail and get a second call), book an appointment, write booked/attendance dates, calculate attendance due then submission due, wait for `attendance_date_passed`, create Submission Required, wait for `quote.published`.

### Extra: cancel at any of those waits

| Trigger | What the playbook does |
|---------|-------------------------|
| `field.updated` with `makeSafeRequired` = false (while waiting for contact, booking, or attendance date) | `update_job` sets a cancelled phase. Playbook **succeeds** as cancelled. No quote or invoice path. |

### After the quote

Auto-approval uses the same four flags as Assessment, plus the job’s claim recommendation of Accept. If they all pass: `approve_quote`, then wait for completion and invoice.

If not: wait for `quote.status_changed`.

| Trigger | What the playbook does |
|---------|-------------------------|
| Approved | Wait for PO / variations |
| Resubmission Required | Phase Awaiting Resubmission, new Submission Required task, wait for quote again |
| Declined or Cancelled | Record closed phase and outcome, succeed |

While waiting for the PO, a **variation** quote (`quote.published` with quote type variation) pauses the invoice wait until that variation is Approved or Declined, then returns to waiting for the PO.

`purchase_order.completed` → `update_job` phase Complete → succeed.

Make Safe does **not** spawn a Works job. Works still comes from Assessment (or a separately created Works job).

---

## Builder Works

**Purpose:** After the assessment is approved, get the customer on a signed scope (and collect excess if required), schedule and carry out repairs, prove completion, then finish the purchase order.

**Starts when:** A Builder - Scope of Works job is created, including when Assessment creates it on quote approval. Starting facts include `collectExcess` and `excess`.

### Opening tasks

Always:

1. `create_task` **Send Scope / Contract**
2. `create_task` **Repair Update** (description tells the user it is due within five business days)

Then a **choice**: if `collectExcess` is true, also `create_task` **Send Excess** and wait on the **combined** scope-and-excess wait. If false, wait only on the **scope** wait.

Repair Update can be completed at several later waits. Each time, the playbook `create_task` another Repair Update and **returns to the same wait**. It does not skip ahead. The five-business-day due date is guidance on the task; the engine does not currently schedule a timer for it.

### Path A — no excess

Wait: Send Scope completed, **or** phase set to Awaiting Scope, **or** Repair Update.

| Trigger | What the playbook does |
|---------|-------------------------|
| Send Scope / Contract completed, or `field.updated` phase `awaiting_scope` | `update_job` writes scope sent date and phase Awaiting Scope. `create_task` **Signed Scope / Contract**. Wait for signature. |
| Signed Scope completed, or `field.updated` `scopeSignedDate` | `update_job` writes scope signed date and phase Scope Signed. `create_task` **Schedule Repairs**. Wait for estimated dates. |

### Path B — excess required

First wait: Send Scope, Send Excess, or Repair Update. Completing **one** of the send tasks moves on; the other send task is not still listened for on that first wait.

| Trigger | What the playbook does |
|---------|-------------------------|
| Send Scope completed | `update_job` scope sent date, phase Awaiting Scope. `create_task` Signed Scope. Then wait for **both** signed scope and collected excess. |
| Send Excess completed | `update_job` excess sent date, phase Awaiting Excess. `create_task` **Collect Excess**. Then the same combined wait. |

Second wait (gate): Signed Scope completed, Collect Excess completed, `scopeSignedDate` set, or `excessPaymentCollected` set.

Each side of the gate is remembered. Completing only one side **returns to the same wait**. When **both** scope signed and excess collected are true:

- Collect Excess also `update_job` excess collected date, `excessPaymentCollected`, phase Excess Collected
- Then `create_task` **Schedule Repairs**

Repairs cannot be scheduled until that gate is met.

### Scheduling and commencing

Wait for estimated dates (or Repair Update).

| Trigger | What the playbook does |
|---------|-------------------------|
| `field.updated` `estimatedDatesSet` | `update_job` works scheduled date, estimated start/completion, phase Scheduled. `create_task` **Commence Repairs**. |

Wait for commence (or phase repairs in progress, or Repair Update).

| Trigger | What the playbook does |
|---------|-------------------------|
| Commence Repairs completed, or phase `repairs_in_progress` | `update_job` commencement date, phase Repairs In Progress. `create_task` **Upload Completion Certificate**. |

### During repairs

Wait for repairs complete, Repair Update, or a **variation** quote.

| Trigger | What the playbook does |
|---------|-------------------------|
| `field.updated` phase `repairs_complete` | `update_job` works completion date, phase Repairs Complete. Wait for certificate or verbal confirmation. |
| `quote.published` with quote type variation | Wait until that quote is Approved or Declined, then **return** to waiting for repairs complete. |

### Proof of completion

| Trigger | What the playbook does |
|---------|-------------------------|
| `document.uploaded` with document type **Completion Certificate** (folder/category name on the job file) | `update_job` certificate upload date, phase certificate uploaded. Wait for PO. |
| `field.updated` `dateCustomerConfirmedCompletion` | `update_job` phase completion confirmed (verbal completion). Wait for PO. |

The document event is sent when a job file finishes uploading **or** when it is given a category, if that category name is present. The wait matches the category name “Completion Certificate”.

### Invoicing and late variations

| Trigger | What the playbook does |
|---------|-------------------------|
| `purchase_order.completed` | `update_job` phase Complete. Playbook **succeeds**. |
| Variation quote while waiting for PO | Same as during repairs: wait for Approved/Declined, then wait for PO again. |

---

## Auto-approval (shared idea)

Assessment and Make Safe both pause after a quote is published and ask: should the system approve this without an insurer click?

All of these must be true on the published quote (and Make Safe also requires the job’s claim recommendation to be Accept):

- Claim recommendation is Accept
- Auto-approval applies
- Claim decision is Accept
- Quote is within delegate authority

If yes: `approve_quote`. Assessment then creates Works. Make Safe goes to the invoice wait.

If no: the playbook waits for `quote.status_changed` from the insurer.

---

## What a person actually does vs what the system does

**People (or inbound Crunchwork)** complete tasks, book appointments, publish and review quotes, set dates, upload files, collect excess, confirm completion, and invoice against the PO.

**The system** creates the next task, fills dates that the Crunchwork guides describe as “automation”, moves job status via `workflowPhase`, starts child jobs, and auto-approves when the rules pass.

**Timers** currently matter in one place: `attendance_date_passed` after a visit is booked. Works Repair Update is recreated when the previous one is completed, not when five days elapse on their own.

---

## Where the playbooks live

The stories above follow the ASL definitions in the workflow engine:

- Assessment: `more0-ensure/definitions/workflows/job/assessment/asl.json`
- Make Safe: `more0-ensure/definitions/workflows/job/make-safe/asl.json`
- Works: `more0-ensure/definitions/workflows/job/works/asl.json`

Implementation notes (gaps closed, event wiring) are under `docs/implementation/53_*`, `54_*`, and `55_*`. Operator-facing Crunchwork behaviour that these playbooks aim to match is under `docs/Crunchwork/Guides/`.
