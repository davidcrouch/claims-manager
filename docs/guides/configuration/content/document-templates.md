---
title: "Document Templates"
slug: document-templates
description: "How to assign Word templates, choose a templates folder, and configure data sources and field mapping for generated reports."
section: configuration
area: content
routes:
  - /admin/document-templates
  - /admin/document-templates/[documentType]
audience: admin
permissions_discussed:
  - documents.manage
  - filesystems.manage
  - reports.read
tags:
  - document templates
  - reports
  - print
  - word
  - merge fields
related_guides:
  - reports
  - assessment-reports
  - agents
  - filesystem-categories
  - documents-overview
version: 1
last_updated: 2026-08-31
---

# Document Templates

**Document Templates** is where you tell EnsureOS which Word (`.docx`) file to use when someone prints or generates a report — a claim summary, job details, estimate (quote), assessment, invoice, work order, and the matching list reports.

Each **document type** (scenario) can have its own file. If a type has no file, EnsureOS falls back to the **Default** template. Field mapping and related-record selection live on the type’s detail page so generated documents pull the right claim, job, and party data.

## Key Concepts

- **Document type** — a generation scenario such as `quote`, `assessment`, or `invoices_list`. The list page groups these into General, Customers, Vendors, Operations, and Finance.
- **Template file** — a Word `.docx` stored in your company filesystem. You assign it to a document type; you do not upload it on this page.
- **Default / fallback** — the **Default** row. Used whenever a scenario has no dedicated file.
- **Templates folder** — the company-filesystem folder EnsureOS searches for `.docx` files when you assign a template.
- **Data sources** — which related records (job, claim, parties, line items) are available when generating that type.
- **Field mapping (transform)** — how those records become merge tags in the Word file. You work with field names and a preview, not raw mapping code.
- **List vs detail** — list reports cover a table of records; detail reports cover one record.

## Accessing Document Templates

1. Click the **gear icon** in the top-right header.
2. Under **Content**, click **Document Templates**.

The header shows how many types exist, how many have a file **Assigned**, and how many are **Not set**.

> **Required permission:** This page sits in Admin Settings. Assigning files uses the company filesystem, so you also need access to **Documents** (`documents.manage`) and typically `filesystems.read` to browse folders.

> **Note:** There is no extra feature flag on this menu item. If you cannot see **Content**, you do not have Admin Settings access.

## Choosing the templates folder

1. At the top of the list, find **Document Templates Folder Location**.
2. Click **Browse…** and pick a folder from the company filesystem.
3. Confirm. A toast reports **Templates folder updated**.
4. The folder name becomes a link to **Documents** filtered to that category.
5. **Clear** removes the folder selection.

> **Tip:** Upload Word files in **Documents** (operations) first, into this folder, then return here to assign them. This page does not upload files.

If the company filesystem has no folders yet, the control shows **Company filesystem has no folders yet**. Set up folders under [Filesystem Categories](filesystem-categories.md) before assigning templates.

If the selected folder has no `.docx` files, an amber banner tells you to upload a Word template there and come back.

## Assigning a template on the list

Types are grouped:

| Group | Examples |
|-------|----------|
| **General** | Default fallback |
| **Customers** | Claim, job, journal, assessment, quote, scope of work, work order, invoice (and their list reports) |
| **Vendors** | RFQ, proposal, purchase order, bill, vendor |
| **Operations** | Task, appointment, schedule, message, contact, document |
| **Finance** | Report and reports list |

Each group has two tables: **List reports** and **Detail reports**.

1. In the row for the scenario, open **Select .docx…**.
2. Choose a Word file from the templates folder (plus any file already assigned to that type).
3. Wait for **Template assigned**. The **Default** row shows a **Fallback** badge — that file is used when a type has no assignment.
4. To remove a dedicated file and fall back to Default, use **Clear** on that row.

The header **Assigned** / **Not set** counts update after each assign or clear.

Click a type’s name (or the edit control) to open `/admin/document-templates/[documentType]`.

> **Warning:** Do not edit the only production `.docx` in place. Copy the file in Documents, change the copy, then assign the copy after you have tested a print.

## Configuring a document type

1. Open a type from the list. The header shows the label, the machine **Type** code, and whether a template is **Assigned** or **Not set**.
2. Use **Back to document templates** to return to the list.
3. For types other than Default, the header includes **Report Builder** — opens chat with the report-builder specialist for this type.
4. Work through the three tabs.

### Data Sources

Choose which related entities the generator may load (for example the job on a quote, or parties on a claim). Save before you rely on new fields in the template.

The **Default** type cannot configure data sources. Set sources on each real document type instead.

### Transform (field mapping)

This tab is the field-mapping workspace: available fields, a mapping editor, and a preview against sample data. Version history lets you compare earlier mappings.

Think in terms of **merge tags** — the placeholders in the Word file that fill with claim number, insured name, line totals, and so on. You do not need to write mapping expressions by hand; use the field list, preview, and (where offered) assist.

The **Default** type does not support a custom transform.

### Template

Assign or change the `.docx` for this type, and inspect how merge tags line up with the mapped fields. Test with a real job or claim before you roll the file out to the team.

> **Tip:** The **Report Builder** agent on this page can help choose sources and tags. The header **?** control still opens *this* guide via the Help Assistant.

## How staff generate documents

End users do not open Document Templates to print.

- From **Reports**, generate or download the organisation report for a record. See [Reports](../../operations/finance/reports.md).
- From an **assessment**, generate the assessment report. See [Assessment Reports](../../operations/assessments/assessment-reports.md).
- Print and export actions on claims, jobs, estimates, invoices, and work orders use the template assigned to that document type (or Default).

If a print is blank or missing fields, check: file assigned, templates folder still valid, data sources include the related record, and the Word merge tags match the mapped field names.

## Best Practices

1. **Upload and test on a sample job** before replacing the file the whole office uses.

2. **Keep a Default template** that is safe and generic so new or rarely used types still produce a document.

3. **Store production templates in one company folder** and point **Document Templates Folder Location** at it so the assign dropdown stays short.

4. **Copy before you edit.** Never overwrite the only live `.docx` without a fallback copy.

5. **Align merge tags with the mapping tab** after any Word change; a renamed tag will print empty until the mapping matches.
