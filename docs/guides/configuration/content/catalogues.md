---
title: "Catalogues"
slug: catalogues
description: "How to create catalogues, manage line items and BOMs, import CSV, and use catalogue snapshots on estimates."
section: configuration
area: content
routes:
  - /admin/catalog
  - /admin/catalog/new
  - /admin/catalog/[catalogId]
  - /admin/catalog/items/[id]
audience: manager
permissions_discussed:
  - catalogs.read
  - catalogs.manage
  - catalogs.update-from-estimate
tags:
  - catalogues
  - line items
  - BOM
  - assemblies
  - scopes
  - import
  - estimates
related_guides:
  - creating-an-estimate
  - roles-and-permissions
  - capability-packs
  - agents
version: 1
last_updated: 2026-08-31
---

# Catalogues

A **catalogue** is your organisation’s priced library of work: materials, labour, assemblies, and packaged scopes. Estimators drag items from a catalogue onto an estimate. EnsureOS **snapshots** those prices and descriptions onto the estimate (and later onto purchase orders and work orders), so later catalogue edits do not silently rewrite issued documents.

This guide covers the catalogue list, creating and editing catalogues, line items, bills of materials (BOM), CSV import, unresolved inbound references, and how catalogue changes relate to estimates.

## Key Concepts

- **Catalogue** — a named collection of items (for example “Building Repairs 2026”). You can keep separate catalogues for internal rates and for insurer-supplied (Crunchwork) imports.
- **Category** — a hierarchical tree used to organise items. Categories may contain primitives, assemblies, and scopes. They are not the same as filesystem folders.
- **Primitive** — a single priced item with a unit (for example “m² of plasterboard”). Primitives have a unit type and a unit cost.
- **Assembly** — a composed item whose bill of materials may contain **primitives only**. Cost can be computed from the BOM, fixed, or cost-plus.
- **Scope** — a packaged set of work. A scope’s BOM may contain **assemblies or primitives**. Scopes never nest inside other scopes.
- **Unit type** — the measure used on a primitive (each, m, m², hour). Required on primitives; not used on assemblies or scopes.
- **Snapshot** — when you add a catalogue item to an estimate, EnsureOS copies the current name, description, unit, and rates onto that estimate line. Changing the catalogue later does not rewrite existing estimates unless someone with write-back permission pushes changes back.
- **External reference** — the insurer or provider catalogue ID (typically a Crunchwork catalogue ID). Used to match inbound sync and outbound publish.
- **Default catalogue** — the catalogue pre-selected when someone opens the catalogue picker.

## Accessing Catalogues

1. Click the **gear icon** in the top-right header to open Admin Settings.
2. Under **Content**, click **Catalogues**.

The list page shows each catalogue as a card: name, description, type badge (**Internal** or **Crunchwork**), optional **Default** badge, item count, and last updated date.

> **Required permission:** You need `catalogs.read` (Read Catalogues) to view catalogues and the picker. To create or edit catalogues, items, categories, and BOMs you also need `catalogs.manage` (Manage Catalogues).

> **Note:** Opening `/admin/catalog/new` with a `catalogId` query parameter jumps to that catalogue and opens **New Item**. Without a catalogue id it returns you to the list.

## Creating a Catalogue

1. On the **Catalogues** list, click **New Catalogue** (or **Create first catalogue** if the list is empty).
2. In the **New Catalogue** drawer, fill in:
   - **Name** — required (for example “Building Repairs 2026”).
   - **Description** — optional.
   - **Provider** — **Internal** or **Crunchwork**. This sets the expected CSV column format for imports and default item tagging.
   - **Set as default** — when on, this catalogue is pre-selected in the catalogue picker.
3. Click **Create catalogue**. EnsureOS opens the new catalogue’s item page.

To change name, description, provider, or default later:

1. On the list card, click the **Settings** (gear) icon — not the card title.
2. Edit the fields in **Edit Catalogue**.
3. Click **Save changes**.

> **Tip:** Use **Internal** for your own rates and **Crunchwork** when you will import or sync insurer catalogue codes. Mixing formats in one catalogue makes CSV import harder to review.

## Opening a Catalogue

1. On the list, click the catalogue name (not the Settings icon).
2. The catalogue detail page shows a search box, the line-items grid, and header actions.

Header actions on catalogue detail:

| Control | What it does |
|---------|----------------|
| **Catalogue** | Opens the catalogue picker so you can drag items from *another* catalogue into this one. |
| **Categories** | Opens the category tree drawer. |
| **New Item** | Opens the new-item drawer. |
| **Undo** | Reverts unsaved (or last saved) inline line-item edits. |
| **Import CSV** (upload icon) | Starts the import wizard for this catalogue. |
| **Delete** (red trash) | Deletes the catalogue after confirmation. |

The header also shows save status: dirty, **Saving…**, **Saved**, or an error. Inline grid edits autosave after a short pause.

## Searching and editing line items

1. Use **Search catalogue items by name or code…** to filter the grid. Search applies after a short delay.
2. Edit cells in the line-items grid (name, description, costs, markup, tax, unit). Changes mark the page dirty and autosave.
3. Use **Undo** if you need to roll back the current unsaved batch, or the last saved batch after it has written.

> **Note:** Quantity on an *estimate* is instance-specific. Catalogue items store rates and descriptions, not a job quantity.

## Adding an item

1. On the catalogue detail page, click **New Item**.
2. Fill in the item form:

| Field | Notes |
|-------|--------|
| **Code** | Required. Machine-stable identifier. Cannot be changed after create. |
| **Kind** | **Primitive**, **Assembly**, or **Scope**. Cannot be changed after create. |
| **Name** | Required display name. |
| **Description** | Optional longer text copied onto estimates. |
| **Type** | Item type from the organisation type list (required). |
| **Category** | Optional node from the category tree. |
| **Unit** | Required for **primitives**. Hidden for assemblies and scopes. |
| **Unit cost / Buy cost** | Primitive sell and buy rates. |
| **Pricing mode** | Assemblies and scopes: **Computed from BOM**, **Fixed price**, or **Cost plus markup**. |
| **Fixed unit cost** | Shown when pricing mode is **Fixed price**. |
| **Provider tags** | **Internal** and/or **Crunchwork**. Controls which external systems receive this item when an estimate is published. |
| **External reference** | Crunchwork (or other provider) catalogue ID for inbound match and outbound sync. |

3. Click **Create item**. A toast confirms **Catalogue item created** and the grid reloads.

> **Warning:** Kind and code are locked after creation. If you pick the wrong kind, create a new item and retire the old one rather than trying to convert it.

## Item kinds and BOM rules

Use the kind that matches how estimators will drag the work onto a quote.

| Kind | What it represents | BOM may include | Unit required |
|------|--------------------|-----------------|---------------|
| **Primitive** | A single priced line | None (primitives have no BOM) | Yes |
| **Assembly** | A kit of primitives (for example a door set) | Primitives only | No |
| **Scope** | A package of assemblies and/or primitives | Assemblies or primitives | No |

Rules the editor enforces:

- An **assembly** can only include **primitive** components.
- A **scope** can include **assemblies** and **primitives**.
- **Scopes never nest** — you cannot add a scope as a component of another scope or assembly.
- Only assemblies and scopes have a bill of materials.

The BOM editor shows a hint under **Bill of materials**:

- Assemblies: “Assemblies can only include primitive items.”
- Scopes: “Scopes can include assemblies and primitive items.”

## Editing a bill of materials

1. Open the item (see [Item detail](#item-detail)) for an assembly or scope.
2. In **Bill of materials**, use **Add component…** to pick an allowed item.
3. Set **Qty** and **Waste** (waste factor, default `1`).
4. Adjust quantity or waste on existing lines.
5. Click **Save**. The editor reports **BOM saved** or the validation error in plain language.

> **Tip:** Build primitives first, then assemblies, then scopes. Import and BOM add both expect parents to exist before children.

## Item detail

Each item has a dedicated page at `/admin/catalog/items/[id]`.

1. Open an item from the catalogue grid (or after create).
2. The **Details** card shows code, kind, description, unit cost (computed or fixed for assemblies), and external reference.
3. Assemblies and scopes also show the BOM editor on the same page.
4. Click **Edit** to change fields (except code and kind).
5. **Cancel edit** returns to the read-only view. **Back to catalogue** returns to the list of catalogues (not the parent catalogue grid).

> **Note:** After you save an edit from the item form, EnsureOS may navigate to the item detail or back to the catalogue list depending on how the form was opened.

## Managing categories

1. On catalogue detail, click **Categories**.
2. The **Catalogue categories** drawer lists the tree (name and code, indented by depth).
3. To add a category, enter **Code**, **Name**, and optional parent, then submit the add form.
4. To rename, click the pencil, edit code and name, then **Save**.
5. To deactivate, click the trash icon and confirm **Deactivate category**. Items keep their category link; the category is no longer offered as active.

> **Note:** Categories may contain primitives, assemblies, and scopes. They are a browsing tree, not a BOM.

> **Tip:** Create the category tree **before** a bulk CSV import so rows can resolve category codes cleanly. The import wizard can also create missing categories if the CSV names them.

## Importing CSV

1. On catalogue detail, click the **Import CSV** (upload) button.
2. Because you started from a catalogue, the wizard skips catalogue selection and opens **Select file**.
3. Download the template from **Download template** if you need the column layout for this catalogue’s provider type (**Internal** or **Crunchwork**).
4. Drop a CSV onto the dashed area or click to browse.
5. Click **Next: Review rows**. EnsureOS parses the file and shows counts: total, ok, warnings, errors, and how many rows will create vs update.
6. Filter the preview table by status to inspect issues. Categories and unit types that will be created are listed above the table.
7. Click **Next: Confirm**, review the summary, then **Start import**.
8. Wait for the progress bar, then read the **Results** report (created, updated, skipped, errors). Click **Close**.

If you start import without a catalogue context, the first step is **Select catalogue**: pick an existing catalogue or **Create new catalogue**, then continue.

| Preview status | Meaning |
|----------------|---------|
| **ok / New** | Row will create a new item. |
| **ok / Update** | Row matches an existing code and will update it. |
| **Warning** | Importable, but review the message (for example a defaulted field). |
| **Error** | Row is skipped until you fix the CSV. |
| **Skipped** | Empty or invalid code; not imported. |

> **Warning:** Rows with errors are skipped. Parent (assembly/scope) rows should appear in the file before children so component links resolve. The importer sorts parents ahead of children when it can.

> **Note:** Import runs in batches. Large files show “N of M rows processed” while importing.

## Unresolved external references

When inbound Crunchwork (or other provider) sync mentions a catalogue ID that does not match any local **external reference**, the catalogue detail page shows an amber panel: **Unresolved external catalogue IDs**.

Each row lists the external ID and the source entity that referenced it.

1. Open **Create or edit catalogue item**.
2. Set **External reference** on the matching local item to that ID, or create a new item with that reference.
3. After the next refresh, resolved IDs leave the panel.

> **Tip:** After a Crunchwork import, walk the unresolved panel before estimators use the catalogue. Unmatched IDs mean inbound lines cannot attach to your priced items.

## Using catalogues on an estimate

Estimators do not need the admin catalogue page for day-to-day quoting.

1. Open an estimate (Quotes).
2. In the **Catalogue** toolbar, open the catalogue drawer.
3. Filter with the **Assemblies**, **Primitive**, and **Scopes** checkboxes.
4. If more than one catalogue exists, pick a source from the dropdown (or **All catalogues**). The default catalogue is pre-selected when one is marked **Default**.
5. Search by name, code, or description.
6. Drag an item onto a line-item group. EnsureOS snapshots the current catalogue values onto that estimate.

On estimates the drawer also has a **Group labels** tab for dragging standard group headings onto the quote. Pin the drawer if you need the page to stay usable while you drag.

The admin **Catalogue** button on a catalogue page uses the same picker in **catalog** context: the current catalogue is hidden from the source list so you drag from *another* catalogue. On a Crunchwork catalogue, the picker also lists **Internal** catalogues so you can pull assemblies that live there.

> **Tip:** Crunchwork-sourced jobs still need internal catalogues for assemblies. Keep both types if you import insurer codes and maintain local kits.

### Writing estimate changes back to the catalogue

If your organisation allows catalogue write-back, saving an estimate can offer to update the **source** catalogue items.

| Mode | What happens on estimate save |
|------|-------------------------------|
| **none** | Estimate only. Catalogue is unchanged. |
| **prompt** | Dialog: **Update catalogue item(s)?** Lists linked items. Confirm or cancel. |
| **auto** | Linked catalogue items update without a prompt. |

1. Edit snapshot fields on the estimate (name, description, unit, cost, markup, tax). Quantity is **not** written back.
2. Save the estimate.
3. If the dialog appears, review the item labels and confirm only when the new rates should become the library default.

The dialog copy states that quantity on this estimate is not copied. Name, description, unit, cost, markup, and tax update where they changed.

> **Required permission:** Write-back requires `catalogs.update-from-estimate` (Update Catalogue from Estimate). Organisation Admin and Senior Estimator include this permission by default. See [Roles & Permissions](../organisation/roles-and-permissions.md).

> **Warning:** Write-back changes the shared library. Future estimates will pick up the new rates. Issued documents already snapshot remain as they were unless someone edits those documents.

## Catalogue assistant vs Help (?)

On catalogue pages, the chat drawer prefers the **Catalogue Assistant** (`catalog-assistant`). That specialist can open item drawers, fill fields, and walk BOM edits.

The header **?** control always uses the **Help Assistant**. It opens this guide in the canvas and summarises the steps for the page you are on.

> **Tip:** Use **?** when you want the written procedure. Use Catalogue Assistant when you want the agent to create or edit items with you.

Installing the catalogue capability pack creates the specialist agent. See [Capability Packs](../ai/capability-packs.md) and [Agents](../ai/agents.md).

## Deleting a catalogue

1. On catalogue detail, click the red **Delete** (trash) button.
2. Confirm **Delete catalogue**. The catalogue is removed from the active list.

> **Warning:** Do not delete a catalogue that estimators still use on live quotes. Snapshots on existing estimates remain, but the picker and write-back lose their source. Prefer retiring unused items over deleting a whole catalogue.

## Permission reference

| Permission | What it unlocks |
|------------|-----------------|
| `catalogs.read` | Catalogues list and detail; catalogue picker on estimates |
| `catalogs.manage` | New Catalogue, edit, items, categories, BOM, import, delete |
| `catalogs.update-from-estimate` | Push estimate line changes back to linked catalogue items |

## Best Practices

1. **Create categories before a bulk import.** Codes and names in the CSV then resolve to the tree you already agreed with estimators.

2. **Use scopes for packages, assemblies for kits, primitives for units.** Do not model a whole room as a primitive — you lose BOM cost roll-up and reuse.

3. **Do not delete items that sit on live estimates.** Deactivate or stop using them in the picker. Snapshots stay, but write-back and mismatch scans need the source item.

4. **Keep external references accurate on Crunchwork catalogues.** That is how inbound sync and the unresolved panel match provider IDs to your items.

5. **Treat write-back as a library change.** Only Senior Estimators (or a custom role with `catalogs.update-from-estimate`) should push estimate edits into the shared catalogue.

6. **Mark one default catalogue** for the team that quotes most often so the picker opens in the right place.

7. **Test a small CSV** (a few primitives, one assembly, one scope) before importing hundreds of rows. Fix column format against the template for that provider type.
