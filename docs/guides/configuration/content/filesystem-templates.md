---
title: "Filesystem Templates"
slug: filesystem-templates
description: "How to create company and project filesystem templates so new jobs get the right folder layout."
section: configuration
area: content
routes:
  - /admin/filesystem-templates
audience: manager
permissions_discussed:
  - filesystems.read
  - filesystems.manage
tags:
  - filesystem
  - templates
  - folders
  - jobs
  - company
related_guides:
  - filesystem-categories
  - documents-overview
  - company-settings
  - jobs-overview
version: 1
last_updated: 2026-08-31
---

# Filesystem Templates

**Filesystem Templates** are blueprints for document folder trees. A **company** template defines the organisation library. A **project** template defines the folders each **job** receives when it is created.

This page is where you create, edit, and archive those blueprints. You choose which template is the organisation default on [Filesystem Categories](filesystem-categories.md).

## Key Concepts

- **Company template** — folder tree for the organisation filesystem (shared documents, template Word files, policy packs).
- **Project (job) template** — folder tree copied onto a job when the job is created. Each job gets its own filesystem from this blueprint.
- **Org default** — the template marked as the organisation default. New setup and new jobs prefer this template.
- **Platform template** — a built-in blueprint (`Platform` badge). You can view it but cannot archive or overwrite it. Customise by creating an organisation copy.
- **Archive** — removes the template from the active list. Filesystems already copied from it are not deleted.

## Accessing Filesystem Templates

1. Click the **gear icon** in the top-right header.
2. Under **Content**, click **Filesystem Templates**.

The header explains: company templates set up the organisation document library; project templates define the folder structure for each job.

> **Required permission:** You need `filesystems.read` to view templates. Creating, editing, and archiving requires `filesystems.manage`.

The page lists two cards:

| Section | Used for |
|---------|----------|
| **Company** | Admin → Filesystem Categories (organisation filesystem) |
| **Project** | Job document filesystems (Jobs → Documents) |

Each row shows name, **Company** or **Project** badge, optional **Org default**, and optional **Platform**.

## Creating a template

1. Click **New Template**.
2. In the drawer, enter:
   - **Name** — required.
   - **Description** — optional.
   - **Kind** — **Company** or **Project**.
3. Build the category tree (add folders, nest children, set display names).
4. Save the template.

The new blueprint appears under **Company** or **Project**. It does not become the live default until you select it on **Filesystem Categories** and click **Save** (or complete first-time setup).

## Editing a template

1. Click the pencil on a row (**Edit template**, or **View template** on a platform row).
2. Change name, description, kind, or the folder tree.
3. Save.

> **Warning:** Platform templates are read-only. The drawer will refuse save with a message to duplicate by creating a new organisation template. From Filesystem Categories → Project → **Edit Categories**, EnsureOS can clone a platform project template for you.

## How new jobs get a project filesystem

1. On **Filesystem Categories**, set **Default project folders** and **Save**.
2. When someone creates a job, EnsureOS copies that project template into a **new** filesystem for that job.
3. Staff upload to the job’s folders from the job or from Operations **Documents** (often filtered by job).

Changing the default later does **not** rebuild folders on existing jobs. Only new jobs pick up the new tree.

Company templates are applied to the single organisation filesystem (at setup, or when you **Save** a company template on Filesystem Categories).

## Archiving a template

1. On an organisation-owned row (not Platform), click the trash icon.
2. Confirm. The copy explains that existing filesystems copied from this template are not affected.
3. A toast confirms **Template archived**.

> **Warning:** Platform templates cannot be archived. The UI shows an error if you try.

> **Warning:** Do not archive the template still selected as the organisation default until you have pointed defaults at another template and tested a dummy job.

## Best Practices

1. **Keep one org-default project template** that matches how assessors actually file photos and reports. Extra templates are fine for special job types, but only one default applies automatically.

2. **Do not delete or archive the live default** until a replacement is selected on Filesystem Categories.

3. **Clone platform templates** into an organisation copy before renaming folders so you can evolve names without fighting read-only blueprints.

4. **Test on a dummy job** after any project-template change: create a job and confirm the Documents folder list.

5. **Name templates by purpose**, for example “Builder assessment — standard” versus “Make safe — minimal”, so managers can pick the right default later.
