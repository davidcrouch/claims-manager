---
title: "Creating an Invoice"
slug: creating-an-invoice
description: "How to create a draft invoice from a work order and publish it internally or to the insurer."
section: operations
area: invoices
routes:
  - /invoices
  - /invoices/[id]
audience: member
permissions_discussed:
  - invoices.create
  - invoices.read
  - invoices.update
  - invoices.approve
tags:
  - invoices
  - publish
  - work orders
  - purchase orders
related_guides:
  - invoices-overview
  - work-orders-overview
  - accounts-receivable
  - purchase-orders
  - publishing-an-estimate
version: 1
last_updated: 2026-08-31
---

# Creating an Invoice

Create a **draft** invoice against an active work order, review totals and line items, then **Publish** when the document should lock (and, on insurer jobs, be sent to the insurer). This guide walks the create drawer and the live publish wizard.

## Key Concepts

- **Draft invoice** — created from **Create Invoice**; still editable enough to publish. Header **Publish** is available until the invoice has an upstream source reference.
- **Work order (required)** — every invoice is raised against an active (non-archived) work order. Archived work orders do not appear in the picker.
- **Purchase order** — if the work order has a PO, create attaches that PO automatically; you do not pick it on the form.
- **Publish** — locks the invoice and sets status to **Submitted**. Internal jobs stay in EnsureOS; Crunchwork jobs send the invoice to the insurer.

## Accessing Create Invoice

You can start from either place:

**From the Invoices list**

1. Under **Customers**, click **Invoices**.
2. Click **Create Invoice**.

**From a work order**

1. Open the work order.
2. Click **Create Invoice**.
3. That work order is pre-selected.

> **Required permission:** `invoices.create` to open and submit the create drawer. `invoices.read` to open the resulting record. Publishing requires `invoices.update`.

## Creating the Draft

The drawer title is **Create Invoice**. Description: create a draft against an active work order; publish later from the invoice page.

1. Select **Work Order** (required). Options show the job name and work-order reference when job names are available. Only non-archived work orders appear. On a job-scoped Invoices list, the picker is limited to that job’s work orders.
2. Optionally enter **Invoice Number** (for example INV-001). If you leave it blank, EnsureOS can assign numbering later.
3. Optionally enter **Total Amount**. If omitted, the total typically follows the work order / PO.
4. Optionally set **Issue Date** (defaults to today) and **Due Date**.
5. Optionally add a **Note**.
6. Click **Create Invoice**.

EnsureOS opens the new invoice. Status is typically a draft until you publish.

> **Note:** There is no line-item editor on create. Lines come from the linked PO or work order and appear on the invoice **Line Items** tab after create.

> **Tip:** Prefer creating from the work order after **Complete** (or your organisation’s invoice milestone) so you do not bill an Issued or in-progress WO by mistake.

## Reviewing Before Publish

On the invoice detail page:

1. Check **Overview** — invoice number, insurer ref, totals, tax, excess, issue date.
2. Open **Line Items** and confirm they match the authorised PO or work order.
3. Confirm header links (**View PO** / **View work order** / job) point at the right records.
4. Use **Print** only if you need a local PDF of the *draft*; that does not submit.

If the total is wrong, fix the work order / PO or create a new invoice — do not expect to re-price lines on the invoice after publish.

## Publishing the Invoice

1. Click **Publish** in the header toolbar.
2. The publish drawer opens. Title and confirm button depend on the job:

| Job | Drawer title | Confirm button |
|-----|--------------|----------------|
| Not Crunchwork | **Publish invoice** | **Publish invoice** |
| Crunchwork (insurer) | **Publish invoice to Insurer** | **Submit to Insurer** |

### Step 1 — Read the warning

**Internal**

- The invoice will be locked after publish.
- Status changes to **Submitted**.
- Invoice details cannot be edited afterwards.

**External (insurer)**

- Submitting creates the invoice for the insurer against the linked work order.
- Status changes to **Submitted** and the invoice locks.
- This cannot be undone from this screen.

### Step 2 — Review the summary

The **Invoice summary** card shows:

- Invoice number
- Status
- Total
- Issue date
- Work order
- Purchase order (PO number, or insurer PO from the work order)

Claim and job context appear below the summary.

### Step 3 — Confirm

1. Click **Cancel** to close without publishing, or
2. Click **Publish invoice** / **Submit to Insurer**.

The button shows **Publishing…** or **Sending to Insurer…** while the request runs. You cannot close the drawer during this step.

On success, a toast reads **Invoice published** or **Invoice sent to Insurer**, the drawer closes, and the page refreshes. **Publish** disappears once an upstream source reference exists.

> **Warning:** External publish notifies the insurer. Do not submit a draft with the wrong work order or total. There is no unpublish on this screen.

## After Publish

- Status is **Submitted** (or the equivalent lookup your organisation uses).
- The invoice is locked.
- It appears on [Accounts Receivable](../finance/accounts-receivable.md) ageing once it is outstanding.
- Dashboard **AR overdue** will include it if it ages past your overdue rules.

If you need a file copy, use **Print** and choose a template and folder (or download). See [Reports](../finance/reports.md).

## Permissions Recap

| Permission | What it unlocks |
|------------|-----------------|
| `invoices.read` | List and detail |
| `invoices.create` | **Create Invoice** drawer |
| `invoices.update` | Publish and other updates |
| `invoices.approve` | Approve/reject where that workflow is enabled for your organisation |

Members often have read-only invoice access. Estimators typically cannot create invoices; Manager and Organisation Admin can.

## Best Practices

1. **Use the work order (and its PO) as the source of truth** for amount and lines — especially assessment or works fee POs.

2. **One invoice per authorised milestone** unless your contract allows progress claims; do not double-bill the same WO.

3. **Set issue and due dates** before publish so AR ageing starts from the correct day.

4. **Publish from the invoice page**, not by emailing a printed draft, when the insurer must receive the document.

5. **If a variation changed the PO**, create the invoice after that PO update so the total matches.

6. **Check Line Items before submit** — payload-only invoices without a WO/PO link are harder to defend.

7. **After publish, watch AR** rather than leaving submitted invoices only on the operational list.
