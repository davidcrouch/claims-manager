---
title: "Uploading Documents"
slug: uploading-documents
description: "How to upload files on the Documents page and what the job Attachments tab can show today, including Company vs project filesystem warnings."
section: operations
area: documents
routes:
  - /documents
  - /jobs/[id]
audience: member
permissions_discussed:
  - documents.read
  - documents.manage
tags:
  - documents
  - upload
  - attachments
  - jobs
  - filesystems
related_guides:
  - documents-overview
  - assessment-reports
  - completing-a-builder-works-job
  - jobs-overview
version: 1
last_updated: 2026-08-31
---

# Uploading Documents

You add files to EnsureOS from **Operations** → **Documents** (Company or a job’s project filesystem). Job **Attachments** lists files already linked to that job; upload on that tab is not available yet.

Choose the job (or Company folder) **before** you drop files. Uploads follow the filesystem that is in scope.

## Key Concepts

- **Documents page upload** — header **Upload** and drag-and-drop onto the file pane. Files land in the selected category and filesystem.
- **Job Attachments tab** — Job detail → **Attachments**. Lists title, document type, filename, size, and who uploaded. **View** opens the file. **Upload** is disabled until attachments upload is connected.
- **Category** — the folder selected in the Documents tree. If you select nothing, files may sit uncategorised on the current filesystem.
- **Limits** — 50 MB per file; 50 files per batch. Common office types, images, PDF, and short media are accepted.

## Accessing Upload

### From Documents

1. In the left sidebar, under **Operations**, click **Documents**.
2. Select a job in the job picker if the files belong to a claim/job.
3. Click a folder in the tree (or leave Uncategorised only if you will file them next).
4. Click **Upload**, or drag files onto the pane.

### From a job

1. Open the job (`/jobs/[id]`).
2. Open **Attachments** to *see* files already linked to the job and **View** them.
3. To *add* new files, stay on the job (so `?jobId=` is set) and open **Documents**, or use Documents with that job selected.

> **Required permission:** You need `documents.manage` to upload, archive, or delete. `documents.read` is enough to view and download.

## Job Filter

When a job is selected, **Documents** is `/documents?jobId=…` and uploads go to **that job’s project filesystem**. The sidebar Documents badge is the count for that job.

On job detail, Attachments is always for that job. It does not write to Company.

> **Warning:** With **no job selected**, Documents is in Company + Projects overview. **Upload** uses the folder you clicked. If that folder is under **Company**, the file is **not** on the job. Select the job first for claim workpapers.

> **Tip:** If Documents looks empty after upload, you may be viewing a different job or still on Company. Check the job picker.

## Uploading on the Documents Page

1. Select the job (or a **Projects** folder for that job). If the job has no filesystem, click **Set up document folders** first. **Upload** is disabled in job mode until the filesystem exists.
2. Click the destination folder so new files inherit that category.
3. Click **Upload** or drop files on the pane.
4. In the upload drawer, add or remove staged files.
5. Click start upload. Watch progress (queued, uploading, completing, completed).
6. Close the drawer. The grid refreshes.

You can drop additional files while the drawer is open; they are staged into the same batch.

> **Note:** Selecting a **journal** in the Documents sidebar blocks drop-upload and shows **Add uploads from the journal page**. Journal photos belong on the journal.

## File Types and Size

| Allowed (typical) | Examples |
|-------------------|----------|
| Images | JPEG, PNG, GIF, WebP, SVG |
| Documents | PDF, Word, Excel, PowerPoint, text, CSV |
| Media | MP4, QuickTime, MP3, WAV |

Each file must be 50 MB or smaller. A batch cannot exceed 50 files. Unsupported types are skipped with an error in the drawer.

## Job Attachments Tab

On Job → **Attachments**:

| You can | You cannot (today) |
|---------|---------------------|
| See files linked to the job | Click **Upload** (button is disabled) |
| **View** a file in a new tab | Drag-and-drop onto the dashed area (shown as future) |

The empty state explains that file upload will be available once the attachments API supports it. Until then, use **Documents** with the job selected — that is the working upload path.

## Naming and Categories

1. Use a name that includes document type and site (for example `Assessment-Report-Smith-12-High-St.pdf`) before or immediately after upload.
2. Put assessment reports, completion certificates, and photos in the matching project folder — not Company.
3. Drag misfiled files onto the correct category.

There is no separate “insurer visibility” toggle on the upload drawer today. Treat project folders as operational workpapers; follow your organisation’s rule for what is issued to the insurer (usually via generated reports).

## Best Practices

1. **Select the job before Upload.** Company is for org-wide files only.

2. **Set up project folders** on the first visit to a new job so the template categories exist.

3. **Name the file before you drop it.** “Scan001.pdf” is hard to find later.

4. **One category per artefact type** (reports, certificates, photos). Do not mix completion certificates with supplier invoices.

5. **Stay under 50 MB.** Split large video or scan batches.

6. **Use Job Attachments to review**, Documents to add. Do not wait for the disabled Upload button on Attachments.

7. **Archive mistakes** on Documents rather than leaving a wrong-job file in Company.
