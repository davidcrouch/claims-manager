---
title: "Documents"
slug: documents-overview
description: "How to browse Company and project (job) filesystems, open folders, preview and download files, and how this page differs from Admin filesystem settings."
section: operations
area: documents
routes:
  - /documents
audience: member
permissions_discussed:
  - documents.read
  - documents.manage
tags:
  - documents
  - filesystems
  - jobs
  - attachments
  - upload
related_guides:
  - uploading-documents
  - filesystem-categories
  - filesystem-templates
  - assessment-reports
version: 1
last_updated: 2026-08-31
---

# Documents

Documents is the operational file browser. Without a job selected you see the **Company** filesystem plus **Projects** (each job’s folders). With a job selected you see **that job’s project filesystem only**.

Use this page to find, preview, download, move, and archive files. To add files, see [Uploading Documents](uploading-documents.md).

## Key Concepts

- **Company filesystem** — organisation-wide library (policies, templates in use, shared references).
- **Project filesystem** — folders created for a single job. Sidebar **Documents** with a job selected opens this tree.
- **Category** — a folder in the tree (from a filesystem template). Files sit in a category or in **Uncategorised**.
- **Journal uploads** — selecting a journal in the sidebar lists files attached to that journal (upload those from the journal, not here).
- **Generated reports** — printed or generated documents (for example assessment reports) are stored files once generated; creating them is a Reports / assessment action.

## Documents vs Admin Filesystem Pages

| Page | Who uses it | Purpose |
|------|-------------|---------|
| **Documents** (this page) | Everyone | Browse and upload files in Company and project trees |
| **Filesystem Categories** | Admin (gear) | Edit the organisation taxonomy and pipelines |
| **Filesystem Templates** | Admin (gear) | Blueprints copied onto Company or new jobs |

> **Note:** Admin **Filesystem Categories** is a configuration screen. Do not use it as the day-to-day file library. This guide’s help route is `/documents` only.

## Accessing Documents

1. In the left sidebar, under **Operations**, click **Documents**.
2. With no job selected, expand **Company** or **Projects** in the left tree.
3. With a job selected, you land in that job’s project folders.

> **Required permission:** You need `documents.read` to browse and download. **Upload**, move, archive, and delete require `documents.manage`.

If a job has no project filesystem yet, the page shows **This job does not have a document filesystem yet.** Click **Set up document folders** to create the tree from the project template.

## Job Filter

When a job is selected in the sidebar job picker, the Documents link becomes `/documents?jobId=…`. The count badge is for that job’s files. You see **only** that job’s project filesystem — not Company folders and not other jobs.

> **Tip:** If the library looks empty, check whether a job is selected. Clear job context to return to Company + all Projects. An empty project tree can also mean folders have not been set up yet.

## Browsing Folders

The header title is **Documents**. It shows total count and how many files are in the current folder.

1. Use the left tree: **Company** (building icon) and **Projects** (briefcase).
2. Click a folder to list its files. Counts on folders reflect files in that category.
3. Open **Uncategorised** for files not yet in a folder.
4. Search folders in the tree, or search file names in the toolbar.
5. Switch **grid** or **list** layout.
6. Use **Filter** for Images, Videos, Audio, PDFs, Documents, or Spreadsheets.

Pagination appears when a folder has more than 24 files.

Click a file card for preview actions. The overflow menu on each card includes:

| Action | What it does |
|--------|----------------|
| **Download** | Opens a signed download URL |
| **Move** | Prompts you to drag the file onto a folder in the tree |
| **Pipeline history** | Opens run history for classifiers or other pipelines on that file |
| **Archive** | Removes the file from the active grid |
| **Delete** | Permanently deletes after you confirm |

Grid cards show a thumbnail when one exists (images and some PDFs). List layout is better for long filenames and sizes.

> **Warning:** **Delete** permanently removes the file after you confirm. Prefer **Archive** unless you are sure the file must go.

## Preview, Download, and Move

1. Open the folder that should contain the file.
2. Click the file to preview, or choose **Download** to open a signed download.
3. To recategorise, drag the file onto a folder in the tree (or use **Move**, which reminds you to drag).

Generated assessment or completion documents appear here once they exist as stored files. Creating those documents is done from Reports or the assessment — see assessment reports.

## Company vs a Single Project

| How you arrived | Tree you see | Upload destination |
|-----------------|--------------|--------------------|
| **Documents** with no job | **Company** plus every **Projects** job | The folder you click (Company or a project) |
| **Documents** with a job selected | That job’s folders only | That job’s project filesystem |
| Job has no filesystem yet | Setup message, no tree | **Set up document folders**, then upload |

When browsing Company + Projects, clicking a project folder scopes the file pane (and the next upload) to that job’s filesystem without changing the header job picker. The header job still follows the sidebar picker.

Search in the tree finds folders across Company and projects. Search in the toolbar finds file names in the current folder (or uncategorised set).

## Best Practices

1. **Store claim workpapers on the job project filesystem**, not in Company. Select the job first.

2. **Use the folder names from the template.** Do not dump everything in Uncategorised.

3. **Search from Company view** when you do not know which job holds a file; search includes project folders.

4. **Do not edit Admin categories** from this page. Ask an administrator to change the taxonomy.

5. **Archive superseded versions** instead of leaving five “final” PDFs in the same folder.

6. **Set up project folders** as soon as a job starts so uploads have a place to land.

7. **Leave journal photos on the journal.** Selecting a journal here is for review, not for new uploads.
