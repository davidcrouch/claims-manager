---
title: "Completing a Builder Assessment Job"
slug: completing-a-builder-assessment-job
description: "Numbered checklist to complete a Builder Assessment job — contact, book, assess, journal, report, estimate, and invoice."
section: operations
area: jobs
routes:
  - /jobs
  - /jobs/[id]
  - /assessments
  - /assessments/[id]
  - /documents
audience: member
permissions_discussed:
  - jobs.read
  - jobs.update
  - jobs.assign
  - assessments.manage
  - journals.manage
  - documents.manage
  - procurement.manage
  - invoices.create
  - workflows.manage
tags:
  - builder assessment
  - checklist
  - assessments
  - documents
  - jobs
related_guides:
  - builder-assessment-workflow
  - completing-an-assessment
  - assessment-reports
  - uploading-documents
  - creating-an-estimate
  - journals-overview
version: 1
last_updated: 2026-08-31
---

# Completing a Builder Assessment Job

Use this checklist when you are the estimator allocated a **Builder Assessment** job. Work the items in order. For why each stage exists, see [Builder Assessment Workflow](builder-assessment-workflow.md).

Field-by-field help for the nine assessment tabs is in [Completing an Assessment](../assessments/completing-an-assessment.md) — this page does not repeat every control.

## Key Concepts

- **Checklist, not a form** — you complete tasks, an appointment, an assessment, a journal, documents, and (if required) an estimate. The job **Overview** tab is the scoreboard.
- **Job selected** — keep this job chosen in the header picker so **Assessments**, **Journals**, **Documents**, **Tasks**, and **Estimates** stay scoped.
- **Submission** — the insurer sees your work when the report (and estimate, if required) is generated or uploaded on the **job** filesystem.

## Accessing the Job

1. Under **Customers**, click **Jobs**.
2. Open the allocated job.
3. Confirm the type badge is **Builder Assessment**.

> **Required permission:** `jobs.read` to open the job. Completing the checklist needs `jobs.update` plus the domain permissions called out on each step.

## Checklist

### 1. Confirm the allocation

1. Read **Overview → Instructions**.
2. Check **Core Details**: job number, status, parent claim, request date, **Make-safe required**.
3. Check the parent claim card: address, date of loss, loss type, priority, policy name, account (insurer).
4. Open **Parties** and note the customer phone and any site contact.

> **Tip:** If **Make-safe required** is already yes, plan to raise or open a Make Safe job after the visit — see [Builder Make Safe Workflow](builder-make-safe-workflow.md).

### 2. Assign yourself if needed

1. On the job tab strip, open the assignee control.
2. Select yourself (or the attending estimator).

> **Required permission:** `jobs.assign` if your role cannot change assignment with `jobs.update` alone.

### 3. Contact the customer and confirm dates

1. Call the customer using the **Parties** number.
2. Open **Operations → Tasks** with this job selected.
3. Complete **Call to Schedule** when you have spoken to them.
4. On **Overview → Job Dates & Approval**, confirm **Contact date** and **Attendance due date**.

> **Note:** Those dates may fill automatically when the task completes. Correct them only if they are wrong.

### 4. Book the site appointment

1. On **Overview**, next to **Booked date**, click **Add Appointment** (shown when booked date is empty).
2. Accept or edit the prefilled name, **Inspection** type, onsite location, timezone, and address.
3. Set start and end time, then save.
4. Confirm **Booked date** and **Attendance date** on Overview.

Alternatively: **Operations → Appointments** → create an appointment linked to this job.

### 5. Create or open the Assessment

1. Under **Customers**, click **Assessments** (job filter applies when the job is selected).
2. If the list is empty, click **Create Assessment**.
3. In the drawer, keep the **Job** selected, enter **Assessment Name** (for example “Initial site assessment”), and click **Submit**. Optional create fields (building type, make safe required, comments) can wait — you will fill the tabs on site.
4. Open the new assessment.

> **Required permission:** `assessments.manage`.

### 6. Complete the assessment tabs

Work left to right on the assessment:

1. **Attendance** — risk address attended, site attendance date, persons attending, occupancy.
2. **Building** — type, construction, roof, condition.
3. **Habitability** — habitable or uninhabitable reason.
4. **Hazards** — flag each hazard and describe it.
5. **Damage & Cause** — what you saw and what caused it.
6. **Make Safe** — whether temporary works are required.
7. **Temp Accommodation** — only if occupants cannot stay.
8. **Specialists** — referrals if needed.
9. **Recommendation** — **Claim recommendation**, conclusion, and cost/time estimates.

Watch the header save status: **Unsaved changes** → **Saving…** → **Saved**.

Do not reprint every field here — use [Completing an Assessment](../assessments/completing-an-assessment.md).

### 7. Capture a photo journal

1. Under **Customers**, click **Journals**.
2. Create a journal for this job if none exists.
3. Add pages for each room or defect with photos and short notes.

> **Required permission:** `journals.manage`.

> **Tip:** Photograph the street, the damaged area in context, close-ups, and any make-safe you already did. The Works crew will thank you.

### 8. Submit the Assessment Report

1. On the assessment (or job) header, click the **printer** icon.
2. Choose **Assessment Report** if offered, then generate the PDF.
3. If you have a finished file from outside EnsureOS: open **Operations → Documents** with this job still selected, click **Upload**, and add the PDF.
4. Name the file so the claim and visit date are obvious (for example `CLM-10421-assessment-2026-08-31.pdf`).
5. Classify it as **Assessment Report** (document type or the matching filesystem category).

See [Assessment Reports](../assessments/assessment-reports.md) and [Uploading Documents](../documents/uploading-documents.md).

> **Warning:** The job **Attachments** tab lists files already linked to the job. If **Upload** on that tab is unavailable, use **Documents** with the job selected — that *is* the job project filesystem.

### 9. Create and publish an estimate if the job requires a quote

1. Return to the job and click **Create Estimate**.
2. Set **Type** to **Quote** (or the type your insurer expects).
3. Build the scope from catalogues.
4. Publish the estimate — a draft is not submitted.

Skip this step only when the insurer asked for a report with no pricing.

### 10. Invoice the assessment fee when eligible

1. Check **Vendors → Purchase Orders** for the report-fee PO.
2. Open **Customers → Invoices** and create an invoice for this job.
3. Keep the amount at or below the remaining PO value.

> **Required permission:** `invoices.create`.

### 11. Close out only when the insurer can see the report

1. Confirm the report is on the job Documents / Attachments list.
2. Confirm **Recommendation** is filled on the assessment.
3. Complete remaining tasks such as **Submit Report** or **Submission Required**.
4. Set **Completed date** on Overview if you record completion there, and leave status to follow your organisation’s lifecycle.

> **Warning:** Do not treat the job as finished while the report lives only in your email or on a laptop. If the insurer cannot see **Assessment Report** on the job, the submission is not done.

## If Make Safe Is Identified on Site

1. On the assessment **Make Safe** tab, tick **Make safe required (site finding)** and choose a **Make safe type**.
2. Return to the job header and click **Create Make-Safe** (or **Go to Make-Safe** if one already exists).
3. Follow [Completing a Builder Make Safe Job](completing-a-builder-make-safe-job.md).

## Best Practices

1. **Tick this list in order.** Booking before contact, or invoicing before the report exists, creates avoidable insurer queries.
2. **One assessment per visit** unless you were sent back. A second visit is a second assessment or a clear revision, not a silent overwrite.
3. **Autosave is not publish.** Filling tabs saves the record; the insurer still needs the printed or uploaded **Assessment Report**.
4. **Keep the job selected** when you upload. Company-only uploads are easy to miss on review.
5. **Match the estimate to the assessment.** If Recommendation says repair, the estimate should price that repair — not a different story.
6. **Write names and phones on Attendance** so the next person on the claim can call the right people.
7. **If you are blocked** (no access, unsafe site, customer not home), record it on the assessment and in a journal page the same day.
