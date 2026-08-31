---
title: "Reports"
slug: reports
description: "How to find report records, print PDFs from a job or estimate, and use the Reports list — without editing document templates."
section: operations
area: finance
routes:
  - /reports
  - /reports/[id]
audience: member
permissions_discussed:
  - reports.read
tags:
  - reports
  - print
  - documents
  - templates
  - assessments
related_guides:
  - assessment-reports
  - document-templates
  - jobs-overview
  - invoices-overview
  - estimates-overview
version: 1
last_updated: 2026-08-31
---

# Reports

**Reports** in EnsureOS are generated documents — assessment reports, job summaries, estimate PDFs, invoices — produced from a **record** and a **Word template**. Most people never start on this page. They click **Print** on a job, assessment, estimate, work order, or invoice. The **Reports** list under Finance is a register of report *records* already created from jobs.

This guide covers both paths: printing from a record, and using `/reports`. Template administration (which .docx is assigned to each document type) lives under Admin → **Document Templates**.

## Key Concepts

- **Print (on a record)** — the printer button on a detail or list header. Opens **Print report**, builds a PDF (or Word file) from the assigned template, and downloads it or saves it to a folder.
- **Report record** — a row on **Finance → Reports**, usually created from a **job** (not from this list’s disabled **Create Report** button).
- **Document template** — a .docx your administrators assign per document type (estimate, invoice, assessment, and so on).
- **Report type** — in the print drawer, a choice such as **Estimate** vs **Scope of Work**; on the Reports list, the type lookup on the stored record.
- **Save to folder** — optional destination in the company or job filesystem; if you skip it, the file downloads in the browser.

## Accessing Reports

**Finance list**

1. In the left sidebar, under **Finance**, click **Reports**.
2. The list opens at `/reports`.
3. Click a row or **View** to open `/reports/[id]`.

**Print from a record (usual path)**

1. Open a job, assessment, estimate, work order, invoice, or a list that has a printer button.
2. Click the **Print** control (printer icon, labelled **Print PDF**).
3. Complete the **Print report** drawer.

> **Required permission:** `reports.read` to open the Reports pages and generate documents you are allowed to see. Assigning templates requires admin access to Document Templates.

## Printing from a Record

This is the path most users need. The drawer title is **Print report**. Description: review the report type, template, and where the PDF will be saved.

1. Click **Print** on the record (or list).
2. If **Report type** choices appear, pick one. On an estimate, typical options are:
   - **Estimate** — line items, totals, and summary
   - **Scope of Work** — scope names and descriptions (no pricing)
   On a job, typical options include **Job Details** and, when an assessment exists, **Assessment Report**.
3. Confirm **Document template**. The assigned .docx for that type is selected by default. You can pick another template from the templates folder for this run only.
4. Optionally click **Save to folder** and choose a company or job folder, or leave **Download to this computer**.
5. Click **Download PDF** (or **Save PDF** if a folder is selected).
6. Wait for **Generating…**. A toast confirms download or save.

### If no template is assigned

The drawer shows an amber warning: **No Word template is assigned for this report type.** It tells you to assign a .docx under **Admin → Document Templates**, or choose another file from the templates folder. A **Go to Document Templates** link is provided for administrators.

> **Note:** Printing does **not** publish an estimate or invoice. It only produces a file. Use **Publish** on those records when the insurer must receive the document.

> **Warning:** Do not email a downloaded **draft** as if it were the issued document. Status on the record is the source of truth.

### Lists vs records

Many lists (Estimates, Work Orders, Invoices) also have **Print** for a **list** document type. That prints the current list, not a single record. On a detail page, Print is scoped to that entity.

## The Reports List

The header title is **Reports**, with a status breakdown.

| Control | Behaviour |
|---------|-----------|
| **Active** / **Archived** / **All** | Archive tabs |
| Search | Title or reference |
| **Filter by report type** | Type lookup |
| **Create Report** | **Disabled** on this page — tooltip: select a job first; create reports from a job’s detail page |

| Column | Contents |
|--------|----------|
| **Report #** | Reference, title, or id |
| **Status** | Status badge (filterable) |
| **Type** | Report type (filterable) |
| **Job Ref** | Linked job |
| **Created** / **Updated** | Dates |
| **Actions** | **View** and archive |

Click a row to open detail. There is no job-scoped `?jobId=` filter on this list in the same way as Estimates — job appears as a column.

> **Tip:** If you need a new assessment or job report, open the **job** (or assessment) and use **Print** or the job’s report actions. This Finance page is for finding what already exists.

## Opening a Report Record

The detail header shows title, status, type, **View Job** when linked, plus created and updated dates.

Header actions: **Print** (generate again from this report record) and **Archive**.

### Tabs

| Tab | What you see |
|-----|----------------|
| **Overview** | Type, status, job link, reference, created, created by; then a **Body** if HTML content exists, otherwise a **Report Data** panel |
| **Attachments** | Placeholder — attachments will appear here once that API is connected |
| **Timeline** | Created and updated audit |

Overview is a stored report, not the print wizard. Use **Print** on the header when you need a fresh PDF.

> **Note:** Some older report payloads display as structured data on Overview. You do not need to interpret that data to print a document — use Print and the assigned template.

## Document Templates (Administrators)

Who may assign the default .docx for **Estimate**, **Invoice**, **Assessment**, and other types is covered in [Document Templates](../../configuration/content/document-templates.md).

Operators only need to know:

- Print uses the **assigned** template unless you pick an alternate for this run.
- If Print fails with a missing-template message, ask an administrator to assign a file under **Admin → Document Templates**.
- Templates are Word (.docx) files stored in the organisation filesystem templates folder.

This guide does not cover template formulas or mapping internals.

## Page Agent and Help

On the Reports page, the **report-builder** page agent can help you choose a document type or explain why Print is empty. Press **?** to open this guide in the help canvas.

On a job or estimate, **?** opens that page’s guide; Print still works from the header.

## Best Practices

1. **Print from the record you are working on** (job, assessment, estimate, invoice). Do not hunt the Finance list first.

2. **Choose the right report type** — a Scope of Work PDF is not a priced estimate; an assessment report is not a job-details sheet.

3. **Save issued PDFs to the job folder** when you need them on the claim file; download only for a quick local check.

4. **Do not email drafts.** Publish the estimate or invoice first if the recipient must see the official version.

5. **Ask admin to fix missing templates** rather than uploading ad-hoc Word files to the job as a substitute for Print.

6. **Use assessment and estimate guides** for *what* to complete before you print; this page is only *how* to generate the file.

7. **Archive obsolete report rows** on the Finance list so Active stays readable — generating a new PDF does not delete the old record.
