---
title: "Creating an Invoice"
slug: creating-an-invoice
description: "How to create a draft invoice from a work order, choose the recipient, and publish to the insurer or by email."
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
  - invoices.publish
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
version: 2
last_updated: 2026-09-12
---

# Creating an Invoice

Create a **draft** invoice against an active work order, choose who receives it, review totals and line items, then **Publish** when the document should lock (and be delivered). This guide walks the create drawer and the publish wizard.

## Key Concepts

- **Draft invoice** — created from **Create Invoice**; still editable enough to publish. Header **Publish** is available until the invoice has an upstream source reference (or has been emailed/locked).
- **Work order (required)** — every invoice is raised against an active (non-archived) work order. Archived work orders do not appear in the picker.
- **Recipient** — chosen at create time: **Insurer** (Crunchwork push), **Insured** (email PDF/Word to the job's customer/insured contact), or **Other** (email to a contact you pick).
- **Purchase order** — if the work order has a PO, create attaches that PO automatically; you do not pick it on the form.
- **Publish** — locks the invoice and sets status to **Invoiced**. Delivery follows the stored recipient: insurer jobs go to Crunchwork; insured/other generate the invoice template and email it.

## Accessing Create Invoice

You can start from either place:

**From the Invoices list**

1. Under **Customers**, click **Invoices**.
2. Click **Create Invoice**.

**From a work order**

1. Open the work order.
2. Click **Create Invoice**.
3. That work order is pre-selected.

> **Required permission:** `invoices.create` to open and submit the create drawer. `invoices.read` to open the resulting record. Publishing requires `invoices.publish`.

## Creating the Draft

The drawer title is **Create Invoice**. Steps: **Details** → **Recipient** → **Amount & allocation** → (optional **Line amounts**) → **Confirm**.

### Step 1 — Details

1. Select the **Job** (if not already scoped) and **Work Order** (required).
2. Optionally set **Issue Date** (defaults to today), **Due Date**, and **Note**.
3. Click **Next**.

### Step 2 — Recipient

Choose who will receive the invoice when you publish:

| Card | When available | On publish |
|------|----------------|------------|
| **Insurer** | Crunchwork / external jobs only | Push via Crunchwork API |
| **Insured** | Always | Generate invoice Word/PDF and email the pre-selected Customer/Insured contact |
| **Other** | Always | Same as Insured, but you pick the contact |

- **Insured** shows the job's Customer/Insured contact (name and email). You cannot continue without an email on that contact.
- **Other** opens a contact picker; the selected contact must have an email.

### Step 3 — Amount & allocation (and optional line amounts)

Choose how to distribute the invoice across line items (flat amount, flat percent, or per-line), then continue to **Confirm**.

### Confirm and create

Review job, work order, **recipient**, totals, and allocation, then click **Create Invoice**. EnsureOS opens the new draft.

> **Tip:** Prefer creating from the work order after **Complete** (or your organisation's invoice milestone) so you do not bill an Issued or in-progress WO by mistake.

## Reviewing Before Publish

On the invoice detail page:

1. Check **Overview** — invoice number, recipient, insurer ref, totals, tax, excess, issue date.
2. Open **Line Items** and confirm they match the authorised PO or work order.
3. Confirm header links (**View PO** / **View work order** / job) point at the right records.
4. Use **Print** only if you need a local PDF of the *draft*; that does not submit or email.

Approve the draft (**Draft → Reviewed**) before publish.

## Publishing the Invoice

1. Click **Publish** in the header toolbar (title may read **Email invoice** or **Submit to Insurer** depending on recipient).
2. The publish drawer opens based on the stored recipient:

| Recipient | Drawer | Confirm action |
|-----------|--------|----------------|
| Insurer (or legacy Crunchwork job) | **Publish invoice to Insurer** | **Submit to Insurer** |
| Insured / Other | **Email invoice** (confirm → create report → send email) | **Send invoice** |
| Internal / no email recipient (legacy) | **Publish invoice** | **Publish invoice** |

### Insurer publish

Review the warning and summary, then submit. EnsureOS creates the invoice in Crunchwork and locks the local record.

### Email publish (Insured / Other)

1. **Confirm** — review summary and recipient email.
2. **Create report** — generate the invoice Word/PDF from the invoice template (same pipeline as Print).
3. **Send email** — set the subject and send. The document is attached; status becomes **Invoiced** and the invoice locks.

On success, a toast confirms publish or email, the drawer closes, and the page refreshes.

> **Warning:** External publish notifies the insurer. Email publish notifies the chosen contact. Do not submit a draft with the wrong work order, total, or recipient. There is no unpublish on this screen.

## After Publish

If you need another file copy, use **Print** and choose a template and folder (or download). See [Reports](../finance/reports.md).

## Permissions

| Permission | Use |
|------------|-----|
| `invoices.create` | Open and submit **Create Invoice** |
| `invoices.read` | View invoice records |
| `invoices.update` | Edit draft details / return to draft |
| `invoices.approve` | Draft → Reviewed |
| `invoices.publish` | Publish (insurer submit or email send) |

## Best practices

1. Set the correct **recipient** at create time so publish uses the right delivery path.
2. Ensure the insured/other contact has a valid **email** before you reach publish.
3. **Set issue and due dates** before publish so AR ageing starts from the correct day.
4. Prefer **Publish** (or email publish) over manually emailing a printed draft when the recipient must receive the official document.
5. After publish, watch AR rather than leaving submitted invoices only on the operational list.
