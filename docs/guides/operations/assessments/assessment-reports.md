---
title: "Assessment Reports"
slug: assessment-reports
description: "How to generate or upload an Assessment Report in EnsureOS — print from the assessment or job, and file the PDF on the job project filesystem."
section: operations
area: assessments
routes:
  - /assessments
  - /assessments/[id]
  - /documents
  - /jobs/[id]
audience: member
permissions_discussed:
  - assessments.read
  - documents.read
  - documents.manage
tags:
  - assessment report
  - documents
  - print
  - filesystem
  - attachments
related_guides:
  - completing-an-assessment
  - assessments-overview
  - uploading-documents
  - document-templates
  - jobs-overview
  - completing-a-builder-assessment-job
version: 1
last_updated: 2026-08-31
---

# Assessment Reports

The insurer expects a filed **Assessment Report** — a PDF generated from your assessment, or a finished file you upload. Both paths must land on the **job**. In EnsureOS the job’s project filesystem *is* the job. Do not leave the only copy under Company.

This page covers generate/print and upload. Completing the tabs first is [Completing an Assessment](completing-an-assessment.md).

## Key Concepts

- **Assessment Report** — the document type / print option for field findings. On the job printer it appears when an assessment exists. On the assessment printer it is the default type.
- **Print PDF** — printer icon in the header. Opens a drawer that uses your organisation’s assigned template (configured under **Document Templates**).
- **Job project filesystem** — **Operations → Documents** with the job selected. That tree is this job. **Company** is organisation-wide and is the wrong sole location for a claim report.
- **Job Attachments tab** — lists files already linked to the job (title, document type, filename). Prefer **Documents** to upload if **Upload** on Attachments is unavailable.
- **Job Reports tab** — registered report *records* (**Add Report**), not the assessment form and not a substitute for filing the PDF.

## Accessing Print and Documents

**From the assessment**

1. Open **Customers → Assessments** and the assessment.
2. Click the **printer** icon (**Print PDF**).

**From the job**

1. Open the job.
2. Click the **printer** icon.
3. Choose **Job Details** or **Assessment Report** (the latter appears when the job has an assessment).

**To upload a file**

1. Select the job in the header picker.
2. Under **Operations**, click **Documents**.
3. You are in that job’s project folders — not the Company overview.

> **Required permission:** `assessments.read` to open the assessment; `documents.manage` to upload; `documents.read` to view and download.

## Path 1 — Generate or Print

Use this when your organisation has an **Assessment Report** (document type `assessment`) template assigned.

1. Finish the assessment tabs, especially **Recommendation**.
2. Click **Print PDF** on the assessment (or choose **Assessment Report** on the job printer).
3. In the print drawer, confirm the report type and destination folder if prompted.
4. Generate and download (or save to the filesystem when the drawer offers a folder).

The job printer option is labelled **Assessment Report** and described as site findings, recommendations, and attendance. It uses the latest assessment on that job.

> **Note:** Print does not by itself mark the Builder Assessment job complete. Confirm the file is stored on the job if your insurer consumes the filesystem copy.

> **Tip:** If the drawer says no template is assigned, ask an administrator to assign one under Admin → **Document Templates**. You can still upload a PDF (Path 2).

## Path 2 — Upload a Finished PDF

Use this when you prepared the report outside EnsureOS, or the insurer wants a signed scan.

1. Select the **job** (header job picker).
2. Open **Operations → Documents**.
3. Click **Upload** (or **Upload Files** on an empty folder).
4. Add the PDF in **Upload Documents** and start the upload.
5. Place it in the correct job folder. Use **Move to Category** on the document card if it landed in the wrong place.
6. Confirm **Document type** shows **Assessment Report** on the Documents list or the job **Attachments** tab.

If you are looking at **Documents** with **no** job selected, you see **Company** plus all **Projects**. A report uploaded only under Company is easy to miss on the claim.

### From the job Attachments tab

1. Open the job → **Attachments**.
2. Confirm the file is listed (title, **Document type**, filename, uploaded date).
3. Click **View** to open it.

> **Note:** If **Upload** on Attachments is disabled, that tab is a viewer. Upload through **Documents** with the job selected; the file should then appear here once linked.

## Why Document Type Matters

Classify the file as **Assessment Report** so it is stored and listed correctly, and so anyone reviewing the job (including the insurer, when they consume this filesystem) can see that the assessment submission is the report — not a random PDF.

| What you are filing | Use |
|---------------------|-----|
| Field assessment / builder report | **Assessment Report** |
| Signed completion (Works jobs) | **Completion Certificate** |
| Engineer, hygienist, or similar | An appropriate specialist type, or a clearly named category — see below |
| Scope sent to the customer | Scope / contract category used by your organisation |

> **Warning:** A correctly named file in the wrong type still looks like “just another attachment”. Set the type (or category) before you tell the insurer it is submitted.

## Job Filesystem Versus Company

| Context | What Documents shows | Where to put the report |
|---------|----------------------|-------------------------|
| Job selected (`?jobId=`) | That job’s project folders only | **Here** |
| No job selected | **Company** + **Projects** overview | Only if you then file into the correct project — prefer selecting the job first |

If you used another system that said “never upload at project level”, invert that habit in EnsureOS: **project = job**. Company is for organisation documents, not the assessment submission.

## Naming the File

Use a name that identifies the claim and the visit without opening the file.

Examples:

- `CLM-10421-assessment-2026-08-31.pdf`
- `10421-reinspect-assessment-2026-09-04.pdf`

Avoid `scan.pdf` or `report final FINAL.pdf`.

## Specialist Reports

The assessment **Specialists** tab only records **Specialist required** and **Specialist type**. It does not upload a file.

1. Tick those fields on the assessment.
2. Upload the specialist PDF on the **same job** in Documents.
3. Choose the specialist (or closest) document type / category your organisation configured.
4. Mention the file in **Recommendation → Special notes** if the insurer should read it with the assessment.

## Job Reports Tab Versus the PDF

On the job, **Reports** is a list of report records (**Add Report**, columns for title, status, type, reference). That is useful for tracking generated reports. It does **not** replace:

- Completing the **Assessments** tabs, or
- Filing the **Assessment Report** PDF on the job filesystem.

Use **Add Report** when your process registers a report row; still print or upload the file.

## Best Practices

1. **Complete Recommendation before you print.** Empty claim recommendation produces a weak report.
2. **Select the job before Upload** every time.
3. **Set type to Assessment Report** so the file is classified, not just stored.
4. **Name files with claim number and date.**
5. **Check Attachments after upload** so you know the job — not only Company — has the file.
6. **Keep specialist PDFs on the same job** as the assessment they support.
7. **Do not mark the Builder Assessment job complete** until the report is visible on that job.
