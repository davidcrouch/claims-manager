---
title: "Managing Claims"
slug: managing-claims
description: "How to review claim tabs, parties, and linked jobs, and how to archive a claim."
section: operations
area: claims
routes:
  - /claims
  - /claims/[id]
audience: member
permissions_discussed:
  - claims.read
  - claims.update
  - claims.delete
  - jobs.create
  - jobs.read
tags:
  - claims
  - parties
  - archive
  - jobs
  - compliance
related_guides:
  - claims-overview
  - creating-a-claim
  - jobs-overview
  - organisation-claims
version: 1
last_updated: 2026-08-31
---

# Managing Claims

Once a claim is in the register, day-to-day management is **review, raise jobs, print, and archive**. Claim detail tabs are a structured view of the insurer record. They are not a free-form edit form: you do not type into policy, loss, or compliance fields on the page.

Use this guide after you can find a claim. For intake and the first job, see [Creating a Claim](creating-a-claim.md).

## Key Concepts

- **Read-only claim body** — Overview, Policy & Financial, Loss Details, Parties, Compliance, and Timeline display synced data.
- **Internal vs linked jobs** — your organisation’s jobs versus vendor jobs on the same claim.
- **Archive** — moves the claim off **Active**; it remains under **Archived** / **All**.
- **Print report** — generates a claim PDF from the header printer control.

## Accessing a Claim to Manage

1. In the left sidebar, open **Customers**.
2. Click **Claims**.
3. Find the claim and click the row.

> **Required permission:** `claims.read` to view. Archiving uses the archive action (roles that include claim delete/update typically see the trash control). **Create Job** needs `jobs.create`.

## Using the Header

The header is the operational toolbar:

1. Confirm claim number, **Status**, account chip, and address.
2. Use **Lodged**, **DOL**, and **Jobs** as a quick health check.
3. Click **Create Job** when you need another job on this loss.
4. Click **Print PDF** to open **Print report**.
5. Click **Archive claim** (trash) only when your process says the claim is finished.

**Back to claims** returns to the list with your previous tab and search.

## Reviewing Each Tab

### Overview

Use this for identity and location. Check claim number, insurer reference, Crunchwork ID, and the map. **People & Assignments** lists consultant and assessor names from the payload — they are not the same as the job **Assigned** control.

### Policy & Financial

Confirm excess, collect-excess, auto-approval, and accommodation limits before you price work or book temporary accommodation. Amounts show as currency where present.

### Loss Details

Use date of loss, loss type, CAT code, decision, priority, and total-loss flags when you choose job type or explain the scope on a job’s **Instructions**.

### Parties

Two tables:

| Section | Columns |
|---------|---------|
| **Contacts** | Name, Type, Email, Phones (M / H / W), Preferred, External ref, Notes |
| **Assignees** | Name, Type, Email, External Ref |

If there are no rows: **No contacts.** / **No assignees.** There is no **Add Contact** on the claim. Add people on the **job** (**Parties** tab → **Add Contact**) or when you run **Create Job**.

### Jobs

This is the management surface that changes most often.

1. Open **Jobs** (the tab shows a count when jobs exist).
2. Review **Internal Jobs** for work you own. Click the job reference or **View** to open the job.
3. Review **Linked Jobs** for vendor work (vendor name, phone, email, status).
4. If the list is empty, click **Create Job**.

Do not expect Quotes, purchase orders, or invoices as claim tabs. After a job exists, select that job and use **Customers → Estimates**, **Vendors → Purchase Orders**, or **Customers → Invoices** (those links append `?jobId=`).

### Compliance

Treat **Vulnerable customer** and **Contentious claim** as handling flags. If contentious activity details are present, they appear in a full-width card. Share this with the assignee before site attendance.

### Timeline

Use **Created**, **Updated**, and **Last Crunchwork update** when you need to know whether the insurer feed has moved since you last looked.

> **Note:** There is no in-page **Save** on claim tabs. Changes from the insurer appear after sync. Job dates and assignee are edited on the job, not here.

## Adding or Opening Linked Jobs

1. From the claim, click **Create Job**.
2. Complete the wizard (claim is pre-selected). See [Creating a Claim](creating-a-claim.md).
3. After create, the job opens. Return with **View Claim** (claim number link) in the job header, or **Customers → Claims**.

To open an existing job without creating:

1. On **Jobs**, click the job reference.
2. Or from the Claims list, use the **Job** cell when a job is already linked.

> **Tip:** One claim can have several jobs (assessment plus make-safe, or internal plus vendor). Check both **Internal Jobs** and **Linked Jobs** before you assume nothing is underway.

## Archiving a Claim

### From claim detail

1. Click the red **Archive claim** control in the header toolbar.
2. Read **Archive claim** — the dialog asks if you want to archive the claim number.
3. Click **Archive** (or **Cancel**).
4. On success you return to `/claims`. The claim is hidden from **Active**.

### From the list

1. Click the row’s archive control (does not open the claim).
2. Confirm **Archive**.
3. The row is removed from the current **Active** page.

### Finding an archived claim

1. On **Claims**, click **Archived** or **All**.
2. Search if needed, then open the row.

The archive button is hidden when the claim is already archived.

> **Warning:** Archive is for finished or withdrawn work in your organisation. It does not remove the insurer’s claim. Do not archive a live job’s parent claim unless your process requires it.

## Printing

1. Open the claim.
2. Click **Print PDF**.
3. In **Print report**, choose the template and generate or save as your organisation configured.

There is no print control on the Claims list itself.

## What “Managing” Does Not Include

| You might expect | What to do instead |
|------------------|--------------------|
| Edit policy number or excess on the claim | Those fields are display-only; corrections go through the insurer feed |
| Add claim contacts on Parties | Add contacts on the job |
| Change claim status in a dropdown | Status is shown from lookups/sync; job status is edited on the job **Overview** |
| Invoice from a claim tab | Open **Customers → Invoices** with the job selected |

## Best Practices

1. **Read Compliance before dispatch** so vulnerability and contention are on the assignee’s radar.
2. **Keep job work on the job** — dates, instructions, and assignee autosave there, not on the claim.
3. **Use Internal vs Linked Jobs** to see who is actually on site (you versus a vendor).
4. **Archive from detail** when you want to confirm the header claim number; use the list trash only for obvious finished rows.
5. **Print a claim PDF** for file notes rather than screenshotting tabs.
6. **Do not manage custody of organisations here** — that is [Organisation Claims](../../configuration/organisation/organisation-claims.md).
7. **After archiving, switch to Archived** if a colleague still needs the record; it is not deleted.
