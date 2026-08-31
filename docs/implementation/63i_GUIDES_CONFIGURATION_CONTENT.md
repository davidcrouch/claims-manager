# 63i — Guides: Configuration Content

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Priority:** P1 for Catalogues; P2 for templates/filesystems  
**Related:** `36_CATALOGUE_MODULE.md`, `57_CATALOGUE_CHAT_UX.md`, `56_REPORT_BUILDER_UX.md`, `39_FILESYSTEM_MODULE.md`, `47_COMPANY_PROJECT_FILESYSTEMS.md`, `ui/13_ADMIN.md`

---

## Objective

Document Admin → Content: catalogues (list, create, detail, line items, BOM, import), document templates, filesystem categories, filesystem templates.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `configuration/content/catalogues.md` | `catalogues` | `/admin/catalog`, `/admin/catalog/new`, `/admin/catalog/[catalogId]`, `/admin/catalog/items/[id]` | manager |
| `configuration/content/document-templates.md` | `document-templates` | `/admin/document-templates`, `/admin/document-templates/[documentType]` | admin |
| `configuration/content/filesystem-categories.md` | `filesystem-categories` | `/admin/documents` | manager |
| `configuration/content/filesystem-templates.md` | `filesystem-templates` | `/admin/filesystem-templates` | manager |

This is the **deep** catalogues guide (quality bar ≈ Roles & Permissions). Chat on catalogue pages prefers `catalog-assistant`; **?** still opens this guide via Help Assistant.

---

## 1. Catalogues

**Sources:** `CatalogListPageClient.tsx`, `CatalogPageClient.tsx`, `CatalogItemDetailClient.tsx`, `CatalogFormDrawer.tsx`, `CatalogImportDialog.tsx`, `CatalogCategoriesDrawer.tsx`, `CatalogBomEditor.tsx`, `CatalogUnresolvedPanel.tsx`, `CatalogPickerDrawer.tsx` (used from estimates — mention both admin and picker).

### Outline

1. Intro — priced items/assemblies that snapshot onto estimates, POs, WOs.
2. Key Concepts (from doc 57, user language):
   - Catalogue
   - Category (tree)
   - Primitive / Assembly / Scope
   - BOM rules: assembly → primitives only; scope → assemblies or primitives; no nested scopes
   - Unit types
   - Snapshot (changing the catalogue does not rewrite issued documents)
3. Accessing — gear → Content → **Catalogues**. `catalogs.read` / `catalogs.manage`.
4. List — New Catalogue (`/admin/catalog/new`), open a catalogue.
5. Catalogue detail — search, line items grid, inline edits, autosave/undo, **Add item**, **Import**, **Categories**, delete catalogue.
6. Item kinds and required fields (unit on primitives).
7. BOM editor for assemblies/scopes; validation errors in plain language.
8. Item detail route `/admin/catalog/items/[id]`.
9. Import CSV (`templateCsv` download).
10. Unresolved external references panel.
11. Using catalogues on an estimate (picker + optional write-back `catalogs.update-from-estimate` — link Roles + creating-an-estimate).
12. Chat: catalogue assistant can open item drawers; **?** for this guide.
13. Best practices — don’t delete items that are on live estimates; use scopes for packages; categories before bulk import.

`permissions_discussed`: `catalogs.read`, `catalogs.manage`, `catalogs.update-from-estimate`  
`related_guides`: `creating-an-estimate`, `roles-and-permissions`, `capability-packs`

Include a small BOM rules table (same as doc 57, no code).

---

## 2. Document Templates

**Sources:** document-templates pages, `56_REPORT_BUILDER_UX.md` (Data Sources tab, report-builder agent).

### Outline

1. Intro — DOCX templates + transforms that Print/Reports use.
2. Key Concepts — document type, template file, transform (JSONata) in user terms (“field mapping”), data sources / related entities.
3. Accessing — gear → Content → **Document Templates**. Likely `ai.admin` or a documents admin permission — **confirm nav gating**.
4. List of types → detail `/admin/document-templates/[documentType]`.
5. Tabs as live (template upload, transform, data sources).
6. How end users print (link `reports`, `assessment-reports`).
7. Tip — Report Builder agent on this page (doc 56); **?** for this guide.
8. Best practices — test print on a sample job before rolling out; don’t edit the only production template in place without a copy.

`related_guides`: `reports`, `assessment-reports`, `agents`

---

## 3. Filesystem Categories

**Route `/admin/documents`** — easy to confuse with Operations **Documents**.

### Outline

1. Intro — **taxonomy** of folders/types for filesystems, not the file browser.
2. Accessing — gear → Content → **Filesystem Categories**. `filesystems.read` / `filesystems.manage`.
3. What you can edit (tree, names) — walk live.
4. vs Operations Documents vs Filesystem Templates.
5. Best practices — keep category names stable (they appear on upload).

`related_guides`: `filesystem-templates`, `documents-overview`, `uploading-documents`

---

## 4. Filesystem Templates

### Outline

1. Intro — blueprints for **company** vs **project (job)** filesystems (doc 47).
2. Accessing — gear → Content → **Filesystem Templates**.
3. Template kind, default project template for new jobs, company template at org provisioning.
4. Instantiation: new job gets a project FS from the template.
5. Best practices — don’t delete the org default template; test on a dummy job.

`related_guides`: `filesystem-categories`, `documents-overview`, `company-settings`, `jobs-overview`

---

## Index updates

TOC already lists these four files.

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/admin/catalog` | `catalogues` |
| `/admin/catalog/{uuid}` | `catalogues` |
| `/admin/catalog/items/{uuid}` | `catalogues` |
| `/admin/document-templates` | `document-templates` |
| `/admin/documents` | `filesystem-categories` (**not** `documents-overview`) |
| `/admin/filesystem-templates` | `filesystem-templates` |

Critical: **Filesystem Categories** (`/admin/documents`) and Operations Documents (`/documents`) must not steal each other’s `by-route` match. Do **not** put `/documents` on the categories guide or `/admin/documents` on the operations documents guide.

---

## Acceptance

- [ ] Catalogues guide covers list, detail, item, import, BOM, unresolved, picker.
- [ ] Route collision between `/documents` and `/admin/documents` is avoided.
- [ ] Ingest + **?** on `/admin/catalog` and `/admin/documents`.
