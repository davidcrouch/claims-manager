NOTE: THIS GUIDE DOCUMENTS SYSTEM-CREATED TASKS ON BUILDER JOBS IN THE CRUNCHWORK CRM (VENDOR VIEW). THIS APPLICATION IS AN ALTERNATIVE TO USING CRUNCHWORK CRM AND SHOULD SUPPORT THE SAME FEATURES AND FUNCTIONALITY (CONCEPTUALLY).

Sources:

- `Builder Assessment Flow - Vendor.png`
- `Builder Make Safe Flow - Vendor.jpg`
- `Builder Works Flow - Vendor.jpg`
- Matching “How to Complete” guides in this folder

In the BPMN diagrams, **white service-task boxes** (gear icon, label like `'…' task created`) are system automations that create tasks. **Yellow boxes** are usually manual vendor work (complete a task, publish a quote, upload a document) and are not listed here as creations.

---

# Builder Job Tasks — Vendor

This document lists every step where the Crunchwork system **creates a task** on Builder Assessment, Builder Make Safe, and Builder Works jobs (vendor side), including what triggers creation and what typically happens next.

## Quick comparison

| Task | Assessment | Make Safe | Works |
|------|:----------:|:---------:|:-----:|
| Call to Schedule | Yes | Yes | — |
| Call to Schedule #2 (failed contact) | — * | Yes | — |
| Book Site Attendance | Yes | Yes | — |
| Submission Required | Yes | Yes | — |
| Submission Required (resubmission) | Yes | Yes | — |
| Quote Review Required (parent / insurer) | — | Yes | — |
| Repair Update (recurring) | — | — | Yes |
| Send Scope / Contract | — | — | Yes |
| Signed Scope / Contract | — | — | Yes |
| Send Excess | — | — | Yes (if required) |
| Collect Excess | — | — | Yes (if required) |
| Schedule Repairs | — | — | Yes |
| Commence Repairs | — | — | Yes |
| Upload Completion Certificate | — | — | Yes |
| Follow up with Customer | Yes | Yes | Yes |
| Follow up with Supplier | Yes | Yes | Yes |
| Close all open tasks | — | Yes (cancel path) | — † |

\* Assessment “How to Complete” is incomplete in-repo; failure follow-up may mirror Make Safe but is not confirmed on the Assessment BPMN.  
† Works cancel / cash-settle path does not show a “close all open tasks” box on the vendor flow diagram.

---

## 1. Builder Assessment

Flow diagram: `Builder Assessment Flow - Vendor.png`

### 1.1 Call to Schedule

| | |
|---|---|
| **Created when** | Report fee purchase order is created (after **Builder Assessment Job Allocated** and allocation email) |
| **Purpose** | Contact the customer to arrange a site assessment appointment |
| **Typically completes when** | Vendor records that the customer has been contacted |
| **On complete** | Contact Date populated; Attendance Due Date calculated; **Book Site Attendance** task created |

### 1.2 Book Site Attendance

| | |
|---|---|
| **Created when** | **Call to Schedule** completed successfully (`YES`) |
| **Purpose** | Book the site inspection in Crunchwork |
| **Typically completes when** | Appointment is scheduled |
| **On complete** | Booked Date and Attendance Date populated; job moves toward scheduled |

### 1.3 Submission Required (initial)

| | |
|---|---|
| **Created when** | Attendance Date has elapsed → job status updated to **Awaiting Submission** |
| **Purpose** | Submit the assessment report and/or quote to the insurer |
| **Typically completes when** | Report/quote is submitted (and related yellow steps such as upload report / publish quote are done) |

### 1.4 Submission Required (resubmission)

| | |
|---|---|
| **Created when** | Quote review outcome = **Resubmission Required** → quote status **Resubmission Required** → outcome email to vendor → job status **Awaiting Resubmission** |
| **Purpose** | Revise and resubmit the assessment quote/report |
| **Typically completes when** | Revised quote is published / submission completed |

### 1.5 Follow up with Customer

| | |
|---|---|
| **Created when** | Job status set to **Awaiting Customer** (bottom status sub-flow) |
| **Purpose** | Follow up with the customer while the job is waiting on them |
| **Typically completes when** | Follow-up task is completed; job status returns to the current stage |

### 1.6 Follow up with Supplier

| | |
|---|---|
| **Created when** | Job status set to **Awaiting Supplier** (same bottom sub-flow) |
| **Purpose** | Follow up with the supplier / trade while the job is waiting on them |
| **Typically completes when** | Follow-up task is completed; job status returns to the current stage |

### Assessment — not shown as system task creation

These appear as yellow/manual vendor steps on the Assessment diagram, not as `'…' task created` boxes:

- Create and publish quote  
- Upload report PDF  
- Create calendar appointment (in or outside Crunchwork)  
- Upload invoice PDF and submit invoice  

Invoice, payment, remedial, and major-works task creations are **not** on this vendor Assessment diagram.

---

## 2. Builder Make Safe

Flow diagram: `Builder Make Safe Flow - Vendor.jpg`  
Also: `Builder Make Safe Job - How to Complete.md`

### 2.1 Call to Schedule

| | |
|---|---|
| **Created when** | **Builder Make Safe Job Allocated** (task is open on allocation) |
| **Purpose** | Contact the customer to arrange make-safe attendance |
| **On complete** | Contact Date populated; Attendance Due Date calculated from insurer SLA; **Book Site Attendance** task created |
| **On fail** | System creates a **Call to Schedule #2** follow-up task (documented in How to Complete; BPMN shows a failure loop via Contact Date back into Call to Schedule creation) |

### 2.2 Call to Schedule #2

| | |
|---|---|
| **Created when** | **Call to Schedule** is failed |
| **Purpose** | Follow-up contact attempt |
| **Notes** | Same family of contact task as the initial Call to Schedule |

### 2.3 Book Site Attendance

| | |
|---|---|
| **Created when** | **Call to Schedule** completed successfully |
| **Purpose** | Schedule make-safe site attendance in Crunchwork |
| **Typically completes when** | Appointment is scheduled |
| **On complete** | Book Site Attendance completed; Booked Date and Attendance Date populated; job status → **Scheduled** |
| **Shortcut** | If the appointment is booked before Call to Schedule is completed, the system can complete Call to Schedule, populate Contact Date, and run the related automations |

### 2.4 Submission Required (initial)

| | |
|---|---|
| **Created when** | Attendance Date passes → job status → **Awaiting Submission** |
| **Purpose** | Submit the make-safe quote (and report if required) after attendance |
| **Typically completes when** | Quote is created and published |

### 2.5 Quote Review Required (parent project)

| | |
|---|---|
| **Created when** | Auto-approval does **not** apply / limit not sufficient (`NO` path), in parallel with job status → **Awaiting Review** |
| **Purpose** | Insurer / parent-side review of the published make-safe quote |
| **Notes** | Diagram labels this as create **"Quote Review Required" task on parent project** — insurer-side, not a vendor work queue item in the same sense as Call to Schedule |

### 2.6 Submission Required (resubmission)

| | |
|---|---|
| **Created when** | Quote review outcome = **Resubmission Required** → job status → **Awaiting Resubmission** (vendor also receives outcome email) |
| **Purpose** | Revise the make-safe quote and publish a revision |
| **Typically completes when** | Revised quote is published |

### 2.7 Follow up with Customer / Follow up with Supplier

| | |
|---|---|
| **Created when** | Job status set to **Awaiting Customer** or **Awaiting Supplier** (bottom sub-flow) |
| **Purpose** | Chase the waiting party |
| **Typically completes when** | Follow-up task completed; status updated back to current stage |

### 2.8 Close all open tasks (cancel path)

| | |
|---|---|
| **Triggered when** | **Make Safe Required** field changed to **No** |
| **Behaviour** | Close all open tasks (parallel with job/PO cancellation) → **Builder Make Safe Cancelled** |
| **Notes** | This is task cleanup, not creation of a new work task |

### Make Safe — chain summary

```text
Allocated
  → Call to Schedule (+ #2 on fail)
  → Book Site Attendance
  → (Attendance Date passes) Submission Required
  → Publish quote
      → Auto-approve → PO
      → Manual review → Quote Review Required (parent)
          → Resubmission Required → Submission Required (again)
  → Invoice / complete
```

---

## 3. Builder Works

Flow diagram: `Builder Works Flow - Vendor.jpg`  
Also: `Builder Works Job - How to Complete.md`

Assessment-style contact tasks (**Call to Schedule**, **Book Site Attendance**) do **not** appear on the Works vendor flow.

### 3.1 Repair Update (recurring)

| | |
|---|---|
| **Created when** | **Builder Works Job Allocated** (with PO creation and status → Allocated) |
| **Recreated when** | Previous **Repair Update** is completed and job is **not** Complete / Cash Settled / Cancelled |
| **Cadence** | New task due date **5 business days** later (per How to Complete) |
| **Purpose** | Regular progress updates to the insurer throughout repairs |
| **Stops when** | Job reaches a terminal status (Complete / Cash Settled / Cancelled) |

### 3.2 Send Scope / Contract

| | |
|---|---|
| **Created when** | Job allocated (parallel branch with excess path) |
| **Purpose** | Record that the repair scope/contract was sent to the customer (usually off-platform) |
| **Completes via** | Complete the task **or** set job status → **Awaiting Scope** |
| **On complete** | Scope Sent Date populated; status → Awaiting Scope; **Signed Scope / Contract** task created |

### 3.3 Signed Scope / Contract

| | |
|---|---|
| **Created when** | **Send Scope / Contract** completed **or** job status → **Awaiting Scope** |
| **Purpose** | Record that the customer signed and returned the scope |
| **Completes via** | Complete the task, set status → **Scope Signed**, or populate Scope Signed Date |
| **On complete** | Scope Signed Date populated; status → Scope Signed; contributes to unlocking **Schedule Repairs** |

### 3.4 Send Excess (if required)

| | |
|---|---|
| **Created when** | Job allocated and **Collect Excess Required?** → **YES** |
| **Purpose** | Record that the excess invoice was sent to the customer (off-platform) |
| **Completes via** | Complete the task **or** set job status → **Awaiting Excess** |
| **On complete** | Excess Sent Date populated; status → Awaiting Excess; **Collect Excess** task created |
| **Skipped when** | Excess is not required |

### 3.5 Collect Excess (if required)

| | |
|---|---|
| **Created when** | **Send Excess** completed **or** job status → **Awaiting Excess** |
| **Purpose** | Record that excess payment was collected |
| **Completes via** | Complete the task, populate Collect Excess Payment / Excess Collected Date, or status → **Excess Collected** |
| **On complete** | Excess Collected Date / payment field populated; status → Excess Collected; contributes to unlocking **Schedule Repairs** |

### 3.6 Schedule Repairs

| | |
|---|---|
| **Created when** | **Signed Scope / Contract** is done **and** **Collect Excess** is done if excess was required |
| **Purpose** | Set planned repair window |
| **Typically completes when** | Estimated Start Date and Estimated Completion Date are both entered |
| **On complete** | Status → **Scheduled**; Works Scheduled Date populated; **Commence Repairs** task created |

### 3.7 Commence Repairs

| | |
|---|---|
| **Created when** | Job status → **Scheduled** (after schedule dates set / Schedule Repairs completed) |
| **Purpose** | Record that trades have started on site |
| **Completes via** | Complete the task **or** status → **Repairs In Progress** |
| **On complete** | Works Commencement Date populated; status → Repairs In Progress; **Upload Completion Certificate** task created |

### 3.8 Upload Completion Certificate

| | |
|---|---|
| **Created when** | Repairs commence / status → **Repairs In Progress** |
| **Purpose** | Capture customer sign-off that works are complete |
| **Completes via** | Upload document type **Completion Certificate**, **or** populate **Date Customer Confirmed Completion** (verbal) |
| **On complete** | Completion Certificate Upload Date (or verbal date) recorded; task completed |

### 3.9 Follow up with Customer / Follow up with Supplier

| | |
|---|---|
| **Created when** | Job status set to **Awaiting Customer** or **Awaiting Supplier** (bottom sub-flow) |
| **Purpose** | Chase the waiting party |
| **Typically completes when** | Follow-up completed; status updated to current stage |

### Works — chain summary

```text
Allocated
  → Repair Update (loops every 5 business days until terminal status)
  → Parallel:
      → Send Scope/Contract → Signed Scope/Contract
      → (if excess) Send Excess → Collect Excess
  → Schedule Repairs
  → Commence Repairs
  → Upload Completion Certificate
  → Invoice / job complete
```

---

## 4. Shared follow-up pattern

Across Assessment, Make Safe, and Works vendor flows, a bottom sub-flow starts when job status is set to **Awaiting Customer** or **Awaiting Supplier**:

1. Exclusive gateway on the waiting party  
2. Create **Follow up with Customer** or **Follow up with Supplier**  
3. Vendor completes the follow-up task  
4. Job status is updated back to the current stage  

---

## 5. Related guides

| Guide | Use for |
|-------|---------|
| `Builder Assessment Jobs.md` | Assessment fields and overview |
| `Builder Assessment Workflow.md` | Assessment stages and field automations |
| `Builder Make Safe Jobs.md` | Make Safe fields and overview |
| `Builder Make Safe Job - How to Complete.md` | Make Safe step-by-step + task triggers |
| `Builder Make Safe Workflow.md` | Make Safe stages |
| `Builder Works Jobs.md` | Works fields and overview |
| `Builder Works Job - How to Complete.md` | Works step-by-step + task triggers |
| `Builder Works Workflow.md` | Works stages |

Flow diagrams (same folder):

- `Builder Assessment Flow - Vendor.png`
- `Builder Make Safe Flow - Vendor.jpg`
- `Builder Works Flow - Vendor.jpg`
