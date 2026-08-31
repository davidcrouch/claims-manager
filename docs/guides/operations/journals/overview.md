---
title: "Journals"
slug: journals-overview
description: "How to create site-visit journals, add photo and note entries, and keep journals in job context."
section: operations
area: journals
routes:
  - /journals
  - /journals/[id]
audience: member
permissions_discussed:
  - journals.read
  - journals.manage
  - jobs.read
tags:
  - journals
  - field-notes
  - photos
  - job-context
  - customers
related_guides:
  - jobs-overview
  - claims-overview
  - documents-overview
  - uploading-documents
version: 1
last_updated: 2026-08-31
---

# Journals

**Journals** are site-visit records: a named visit, optional address and GPS, and a timeline of **entries** (notes and uploads). They sit under **Customers** and are **job-filterable** — when a job is selected, the sidebar link includes `?jobId=` and the list narrows to that job.

Use journals for inspection notes and photos. Formal assessments and estimates are separate pages.

## Key Concepts

- **Journal** — the visit container (name, purpose, location, status **active** or **archived**).
- **Entry** — a page in the journal: one or more notes and file uploads, optional GPS, captured time.
- **Job link** — most journals are linked to a job so they appear in job context and on the job’s document story.
- **Visit date** — stored on the journal (shown on Overview and the header when set).

## Accessing Journals

1. In the left sidebar, open **Customers**.
2. Click **Journals**.

If a job is selected, you only see journals for that job. Clear job context to see all journals.

> **Required permission:** `journals.read` to open the list and detail. **New Journal** and **Add Entry** need `journals.manage`.

> **Tip:** Select the job in the header **before** you click **Journals** so new journals inherit the job and address.

## The Journals List

Header: **Journals**, with **New Journal** and **Print PDF**.

Toolbar: **Active**, **Archived**, **All**; **Search journals by name, description or location...**; **Filter by status**.

### List columns

| Column | What it shows |
|--------|----------------|
| **Name** | Journal title |
| **Job** | Linked job (opens the job) |
| **Status** | `active` or `archived` |
| **Description** | Purpose / notes (truncated) |
| **Location** | Suburb |
| **Entries** | Entry count |
| **Created** / **Updated** | Dates |

Click a row to open `/journals/[id]` (job context is kept in the URL when present). Archive from the row trash control. Empty state: **No journals found.**

The **Job** column filter uses the same job-scope idea as the sidebar (`jobId` / `jobIds` in the query string).

## Creating a Journal

1. Click **New Journal**.
2. The **Create Journal** drawer opens (*Create a site-visit journal for a job.*).
3. Select **Job** when the field is shown (required if jobs were loaded or a job is already in context).
4. Set **Visit date** (defaults to today).
5. Enter **Name** (required), for example `Initial site inspection`.
6. Optionally fill **Purpose / notes**.
7. Under **Site address**, use **Search address** or **Enter address manually** / **Edit address manually** (unit, street no., street name, suburb, state, postcode, country). Choosing a job copies the job address when available.
8. Optionally click **Use current location** (or **Update location**) to store GPS.
9. Click **Create Journal** (or **Cancel**).

EnsureOS opens the new journal. If a job was selected, the URL includes `?jobId=`.

> **Note:** Name is required. If the drawer says **Job is required**, pick a job before submitting.

## Journal Header and Tabs

**Back to journals** returns to the list (with `?jobId=` when you came from job context). The header shows name, status, address, linked job name, **Entries**, **Visit date**, and **Updated**.

Live tabs:

| Tab | Purpose |
|-----|---------|
| **Overview** | Journal details, location, map |
| **Entries** | Entry list and the selected entry’s notes/uploads (count badge) |

Header actions: **Add Entry**, **Print PDF**, **Archive journal**.

## Overview Tab

**Journal Details** — Name, Job (link), Status, Description, Entries count, Visit date, Created, Updated.

**Location** — Address, suburb, state, postcode, country, coordinates when GPS was captured.

**Location map** — shown from coordinates or address; otherwise **No map location available**.

## Adding Entries

1. Click **Add Entry** in the header (or on an empty **Entries** tab).
2. The **Add Entry** drawer opens (*Build a running list of notes and uploads in any order.*).
3. Optionally click **Add Location** to attach GPS to this entry.
4. Click **Add note** and type in **Write a note…**, and/or **Add upload** to attach files.
5. Reorder blocks with move up/down, or remove a block.
6. Click **Add Entry** (or **Cancel**).

While saving, the drawer shows processing steps (creating entry, uploads, attaching files). The new entry appears on **Entries** and that tab becomes selected.

> **Required permission:** `journals.manage`. Without it, **Add Entry** is hidden.

### Reading entries

On **Entries**, the left list is **Entries (n)** sorted newest first. Each row shows time, a title (first note line or file name), and a summary such as `1 note · 2 uploads`.

Select an entry to see notes and upload thumbnails. Images expand on click; other files open in a new tab. If document processing is running, **Document processing** status appears above the content.

Empty journal: **No entries yet** with **Add Entry**.

## Archiving a Journal

1. From the list or detail, click the archive (trash) control.
2. Confirm **Archive journal**.
3. The journal leaves **Active**. Find it under **Archived** or **All**.

From detail, archive redirects to `/journals`.

## Printing

**Print PDF** on the list prints the journals list. On detail it prints that journal (and can include job id when you opened it in job context). The drawer title is **Print report**.

## Journals vs Documents

| Journals | Documents |
|----------|-----------|
| Visit-shaped notes and mixed uploads | Organisation/job filesystem folders |
| **Add Entry** for a running site log | **Documents** sidebar for filing |

Use both: journal the visit, then file finished PDFs under **Documents** with the job selected.

## Best Practices

1. **Select the job first** so the journal links correctly and the address prefills.
2. **Name journals by visit purpose and date** so the list stays searchable.
3. **Add GPS on site** (**Use current location** or **Add Location** on the entry) for a defensible location.
4. **Put photos in entries**, not only in chat, so they stay on the journal timeline.
5. **One journal per visit** rather than one giant journal for the whole job, unless your team agrees otherwise.
6. **Archive journals** that were created in error; keep active ones until the job is finished.
7. **Use Help (?) on this page** if you are unsure whether to journal or to start an Assessment — assessments are a different workflow.
