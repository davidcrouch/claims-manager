---
title: "Creating an Estimate"
slug: creating-an-estimate
description: "How to create a draft estimate, build take-off from the catalogue, manage groups, and optionally write rates back to the catalogue."
section: operations
area: estimates
routes:
  - /quotes
  - /quotes/[id]
audience: member
permissions_discussed:
  - procurement.read
  - procurement.manage
  - catalogs.read
  - catalogs.update-from-estimate
tags:
  - estimates
  - take-off
  - catalogue
  - line items
  - groups
related_guides:
  - estimates-overview
  - publishing-an-estimate
  - creating-a-variation
  - catalogues
  - roles-and-permissions
version: 1
last_updated: 2026-08-31
---

# Creating an Estimate

Create a draft estimate from the Estimates list (or a job-scoped list), then build the **Take Off** from catalogue items and groups. This guide walks the create drawer, overview fields, take-off, parties, autosave, and catalogue write-back.

Publishing is a separate step — see [Publishing an Estimate](publishing-an-estimate.md). For scope changes after approval, see [Creating a Variation](creating-a-variation.md).

## Key Concepts

- **Draft** — a new estimate you can still edit. It is not locked until you publish.
- **Group** — a section on Take Off (for example a room or trade). Lines sit inside groups.
- **Catalogue picker** — a drawer of priced items, assemblies, and scopes you drag onto a group.
- **Assembly / scope** — a catalogue bundle that expands into component lines on the estimate.
- **Update Mode** — whether edits to a catalogue-sourced line also update the source catalogue item.
- **Autosave** — overview, parties, assignee, and take-off save after a short pause; **Undo** reverses the last change.

## Accessing Create Estimate

1. Under **Customers**, click **Estimates**.
2. Click **Create Estimate** in the header.
3. The **Create Estimate** drawer opens.

If a job is already selected, that job is pre-filled. Otherwise you must pick a job.

> **Required permission:** You need `procurement.manage` to create and edit estimates. Viewing requires `procurement.read`. Adding catalogue items requires `catalogs.read`.

## Creating the Draft

1. Open **Create Estimate**.
2. If the job picker is shown, choose the **job** (required). The related claim is filled from that job.
3. Enter a **Name** (required).
4. Optionally enter a **Reference**.
5. Select **Type** (required). Types on this form are:

   | Type | Typical use |
   |------|-------------|
   | **Quote** | Standard priced estimate |
   | **Scope Of Work** | Scope without treating it as a commercial quote |
   | **Tender Quote** | Competitive / tender response |
   | **Validation** | Check or validate an existing scope |
   | **Liability Quote** | Liability-related pricing |
   | **Variation** | Change to an already approved estimate — see [Creating a Variation](creating-a-variation.md) |
   | **Variation - PC/PS** | Adjustment to a prime-cost / provisional-sum allowance |

6. Set **Estimate Date** (required; defaults to today).
7. Set **Expires In (days)** (required; defaults to 30).
8. Optionally set **Estimated Start** and **Estimated Completion**.
9. Optionally add a **Note**.
10. Click **Create Estimate**.

EnsureOS opens the new estimate. It is still a **Draft**.

> **Note:** There is no **Create from CSV** action on the Estimates list. CSV import is for **catalogues** under Admin, not for creating an estimate. Build take-off from the catalogue picker or by typing lines.

> **Tip:** If AI assist is enabled on the drawer, you can ask the page agent to suggest a name, type, or dates before you submit.

## Completing Overview Fields

On **Overview**, while the estimate is unlocked:

1. Confirm **Name**, **Reference**, **Estimate date**, and **Expires in**.
2. Adjust **Estimated start** and **Estimated completion** if the programme is known.
3. For a variation type, fill **Reason for variation** on the Schedule card (this field is on Overview, not on the create drawer).
4. Change **Estimate type** in the Approval card if you picked the wrong type at create.
5. Add or refine the **Note**.

Financial totals (**Sub total**, **Total tax**, **Total**) are calculated from Take Off — you do not type the total on Overview.

Wait for the header save indicator to show the fields have saved, or leave the tab; autosave runs after you pause typing.

## Building Take Off

1. Open the **Take Off** tab.
2. Click **Add group** to create a section. Choose a **Group label** from the lookup list and optionally a description.
3. Click **Catalogue** in the header (or **Add item** on the catalogue toolbar if it is visible) to open the catalogue picker.
4. Search or browse items, assemblies, and scopes. Drag an item onto a group, or use **Add item** with the quantity field set first.
5. Adjust quantities, descriptions, and rates on each line as needed.
6. Repeat until the scope is complete.

The sticky take-off toolbar shows line counts, group filters, search, and column toggles (pricing, GST, quantities, markup). Click the toolbar to collapse or expand all groups.

### Catalogue picker

The picker is filtered to catalogues that match the job’s provider type when one is set.

| Kind | What happens on drop |
|------|----------------------|
| **Item** | A single priced line |
| **Assembly** | Expands into its component items |
| **Scope** | Expands into a structured set of lines (a larger bundle than an assembly) |

> **Tip:** Set the quantity box on the catalogue toolbar *before* you add an item if you already know the count. You can still edit quantity on the line afterwards.

### Groups

Use groups to keep trades or rooms readable. You can rename a group, delete an empty or unwanted group, and filter which groups are visible from the toolbar.

> **Warning:** Deleting a group removes its lines from this estimate. That does not delete the catalogue item itself.

### Price drift

On the catalogue toolbar, **Scan price drift** compares estimate lines to current catalogue rates and flags mismatches.

1. Click **Scan price drift**.
2. If lines have drifted, an amber banner shows how many.
3. Review flagged lines and decide whether to keep the estimate rate or align to the catalogue.

## Parties

Open the **Parties** tab and complete:

- **Estimate From (vendor)** — your organisation or the quoting contractor
- **Estimate For (customer)** — insured / customer
- **Estimate To (recipient)** — who should receive the estimate (often the insurer or adjuster)

Each card includes name, contact, phone, email, and address fields. Changes autosave like Overview.

## Catalogue Write-Back

If your organisation allows it, changing a catalogue-sourced line can update the **source catalogue** as well as this estimate.

On Take Off, the toolbar **Update Mode** control has three values:

| Mode | Behaviour |
|------|-----------|
| **None** | Estimate only — catalogue unchanged |
| **Prompt** | Ask before updating the catalogue item |
| **Auto** | Always update the source catalogue item |

> **Required permission:** **Prompt** and **Auto** require `catalogs.update-from-estimate` (labelled **Update Catalogue from Estimate**). The built-in **Senior Estimator** role includes it; **Estimator** does not. Without the permission, Update Mode stays on **None**.

Organisation settings must also allow write-back. If Prompt/Auto stay disabled, ask an administrator to check Roles & Permissions and catalogue settings.

> **Warning:** **Auto** writes every matching edit back to the shared price book. Prefer **None** or **Prompt** unless you intend to maintain catalogue rates from this estimate.

## Autosave and Undo

- Overview, parties, and assignee save automatically after you stop editing.
- Take-off lines save the same way while the estimate is unlocked.
- **Undo** in the header first discards unsaved edits; if nothing is dirty, it restores the previous saved snapshot (up to the undo limit).

You do not need a separate Save button.

> **Note:** Assignment remains editable after publish. Take-off and overview do not.

## Best Practices

1. **Create the draft on the correct job** — there is no parent-estimate picker. A variation for Works must live on the Works job, not on an Assessment job.

2. **Build take-off in groups** that match how the insurer or supervisor will read the scope (rooms, elevations, or trades).

3. **Prefer catalogue items** so rates, codes, and later write-back stay consistent.

4. **Leave Update Mode on None** unless you are deliberately maintaining the catalogue.

5. **Complete parties and dates before you invite a reviewer** — publish will lock the record.

6. **Scan price drift** before publish if the catalogue has been updated since you started.

7. Use the **estimator** page agent or **?** help on this page if you are unsure which type or group label to pick — they open these guides rather than guessing field names.
