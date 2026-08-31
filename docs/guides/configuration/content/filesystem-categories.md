---
title: "Filesystem Categories"
slug: filesystem-categories
description: "How to set up the company and project folder taxonomy used when staff upload and classify documents."
section: configuration
area: content
routes:
  - /admin/documents
audience: manager
permissions_discussed:
  - filesystems.read
  - filesystems.manage
  - documents.manage
tags:
  - filesystem
  - categories
  - folders
  - documents
  - taxonomy
related_guides:
  - filesystem-templates
  - documents-overview
  - uploading-documents
  - company-settings
version: 1
last_updated: 2026-08-31
---

# Filesystem Categories

**Filesystem Categories** is the **taxonomy** for document folders — the names and tree staff see when they upload or classify a file. It is not the file browser.

Use this page to choose which **company** and **project** templates supply those folders, preview the tree, and edit category names. Day-to-day upload, download, and search happen on Operations **Documents**.

## Key Concepts

- **Category** — a folder name in the tree (for example “Photos” or “Insurer correspondence”). Categories can nest.
- **Company filesystem** — organisation-wide folders (policies, templates, shared libraries). One per organisation.
- **Project filesystem** — the folder tree copied onto each **job** when the job is created.
- **Template** — a reusable blueprint of categories. You pick defaults here; you author blueprints on [Filesystem Templates](filesystem-templates.md).
- **Platform template** — a built-in blueprint. It is read-only until you clone it into an organisation copy.

## Accessing Filesystem Categories

1. Click the **gear icon** in the top-right header.
2. Under **Content**, click **Filesystem Categories**.

The page title is **Filesystem Categories**. The URL is `/admin/documents`.

> **Required permission:** You need `filesystems.read` (Read Filesystems) to view this page. Editing categories and defaults requires `filesystems.manage`.

> **Warning:** This is **not** Operations **Documents** (`/documents`). That page is the file browser. Do not bookmark `/admin/documents` expecting to upload files.

## Compared with Documents and Templates

| Page | Menu | URL | Purpose |
|------|------|-----|---------|
| **Filesystem Categories** | Admin → Content | `/admin/documents` | Taxonomy and defaults for company / project folders |
| **Filesystem Templates** | Admin → Content | `/admin/filesystem-templates` | Create and archive folder blueprints |
| **Documents** | Operations sidebar | `/documents` | Browse, upload, and download files |

## First-time setup

If the organisation has no company filesystem yet, you see **Set Up Document Filesystem**.

1. Under **Company folders**, choose a company template. This is applied now to the organisation filesystem.
2. Under **Default project folders**, choose the project template used when new jobs are created. Each job gets its own copy of that tree.
3. Click **Set up filesystem**.

> **Note:** You need at least one company template and one project template. Create them under **Filesystem Templates** if the dropdowns are empty.

## Company tab

After setup, the page has two tabs: **Company** and **Project**.

On **Company**:

1. Review **Company filesystem categories** — organisation-wide folders and the selected template name.
2. Change **Company folders** if you want a different template.
3. Click **Save** to apply that template’s categories to the **live** company filesystem. A toast confirms **Company folders updated from template**.
4. Click **Edit Categories** to rename, add, or nest folders in the editor drawer.
5. Use the preview tree on the left to confirm names before you save.

The right column holds processing **pipelines** and **artifact export** defaults for the company filesystem. Leave those until your folder names are stable.

> **Warning:** **Save** on a new company template **replaces** live company categories with the template’s tree. Existing files stay, but folder names and structure change. Prefer **Edit Categories** for small renames.

## Project tab

1. Open the **Project** tab.
2. Choose **Project folders** — the default template copied onto **new** jobs.
3. Click **Save** to store that default (toast: **Default project template updated**). Existing jobs keep the folders they already have.
4. Click **Edit Categories** to change the template tree.
5. If the selected template is a **platform** (built-in) template, EnsureOS first clones it to an editable organisation copy, then opens the editor.

> **Tip:** Changing the project default does not rewrite folders on jobs already created. Test a dummy job after you change the default.

## Editing category names

1. Click **Edit Categories**.
2. Add, rename, reorder, or nest folders in the tree editor.
3. Save the editor. Names you set here appear on upload and classify dialogs in Operations Documents.

Keep names stable. Staff search and upload habits follow the labels they already know.

## Best Practices

1. **Treat this page as taxonomy, not storage.** Upload files on Operations **Documents**.

2. **Keep category names short and stable.** They appear on every upload. Renaming “Photos” to “Site images” confuses existing jobs.

3. **Set company and project defaults once**, then edit the tree rather than swapping templates weekly.

4. **Clone platform templates** before you customise project folders so upgrades to the built-in blueprint do not overwrite your names.

5. **Create a dummy job** after changing the project default and confirm the folder list on that job’s Documents tab.
