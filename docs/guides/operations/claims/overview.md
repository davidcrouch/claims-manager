---
title: "Claims"
slug: claims-overview
description: "How to find insurance claims, open claim details, and start jobs from Customers → Claims."
section: operations
area: claims
routes:
  - /claims
  - /claims/[id]
audience: member
permissions_discussed:
  - claims.read
  - claims.create
  - claims.update
  - claims.delete
  - jobs.create
  - jobs.read
tags:
  - claims
  - customers
  - insurance
  - jobs
  - onboarding
related_guides:
  - creating-a-claim
  - managing-claims
  - jobs-overview
  - organisation-claims
version: 1
last_updated: 2026-08-31
---

# Claims

**Claims** is the insurance claim register under **Customers**. Each claim is a policy and loss record: identifiers, risk address, financial limits, parties, and the jobs raised against it.

This page is **not** **Organisation Claims** under Admin Settings (`/admin/claims`). That admin queue reviews custody of ghost organisation profiles. Use **Customers → Claims** for day-to-day insurance work.

Most claims arrive from the insurer connection. You review them here and raise jobs from the claim header.

## Key Concepts

- **Claim** — an insurance loss record (claim number, policy, date of loss, risk address).
- **Account** — the insurer or scheme the claim belongs to (for example the account chip in the header).
- **Internal job** — a job your organisation owns on this claim (no vendor snapshot).
- **Linked job** — a vendor job on the same claim, shown with vendor name and contact details.
- **Archived** — hidden from the **Active** list; still available under **Archived** or **All**.

## Accessing Claims

1. In the left sidebar, open the **Customers** group.
2. Click **Claims**.

The list header is titled **Claims** and shows how many records match the current filters.

> **Required permission:** You need `claims.read` (Read Claims) to open the list and claim detail. Creating a job from a claim also needs `jobs.create`.

> **Note:** Do not use the **gear icon** → **Organisation** → **Organisation Claims** for insurance work. That page is a custody review queue, not this register.

## Finding a Claim

The list toolbar has **Active**, **Archived**, and **All** tabs, a search field, and an account filter.

1. Leave **Active** selected for current work, or switch to **Archived** / **All** if the claim was archived.
2. Type in **Search claims by claim number, reference, policy, or address...**.
3. Optionally open **Filter by account** and tick the insurer accounts you want.
4. Click a row to open `/claims/[id]`.

### List columns

| Column | What it shows |
|--------|----------------|
| **Claim #** | Claim number, or insurer/external reference if the number is missing |
| **Job** | Linked jobs for the claim (hover or expand the cell when several exist) |
| **Status** | Lifecycle status badge |
| **Policy** | Policy number or policy name |
| **Address** | Risk address |
| **Account** | Insurer/account name |
| **Lodged** | Lodgement date |
| **Updated** | Last update |

Click a column header to sort. **Status** and **Account** also have column filters. Use the column-settings control at the right of the header to show or hide columns (**Claim #** stays locked).

Empty results show **No claims found.**

> **Tip:** If the list looks empty, check that you are on **Active** (archived claims are hidden) and that the account filter has not excluded every account.

## Opening Claim Detail

The header shows the claim number (or reference), status badge, account, and address. Beneath that: **Lodged**, **DOL** (date of loss), and **Jobs** (count).

**Back to claims** returns to the list.

Header actions:

- **Create Job** — opens the **Create Job** drawer with this claim pre-selected and job type defaulted to **Builder Make Safe** when that type exists.
- **Print PDF** — opens the **Print report** drawer for this claim.
- **Archive claim** (trash icon) — confirms, then archives and returns to the list.

## Claim Tabs

The live tabs are **Overview**, **Policy & Financial**, **Loss Details**, **Parties**, **Jobs**, **Compliance**, and **Timeline**. There are no Quotes, purchase-order, or invoice tabs on the claim — those live under **Customers** (and other sidebar groups) and can be scoped with `?jobId=` after you select a job.

### Overview

- **Claim Identifiers** — claim number, insurer reference, Crunchwork ID, account, status, lodged date.
- **Risk Location** — address, suburb, state, postcode, country, postal address.
- **People & Assignments** — claim consultant, property assessor, internal auditor, desktop assessor, technical assessor, broker reference, hazardous waste.
- **Location map** — map when coordinates or a full address exist; otherwise **No map location available**.
- **Incident description** — shown when the claim has narrative text.

### Policy & Financial

Two cards: **Policy** (name, number, type, line of business, inception date, ABN, flood coverage) and **Financial** (building and contents sums insured, excess, collect excess, auto-approval, accommodation benefit limit, max accommodation duration).

### Loss Details

**Loss Classification** (date of loss, loss type and sub-type, CAT code) and **Decision & Priority** (claim decision, priority, total loss, contents damaged), plus the full incident description.

### Parties

Read-only tables of **Contacts** (name, type, email, phones, preferred method, external ref, notes) and **Assignees** (name, type, email, external ref). Email addresses are `mailto:` links.

### Jobs

When the claim has no jobs, you see **No jobs linked to this claim.** and **Create Job**.

When jobs exist, they split into:

- **Internal Jobs** — job type, job reference, assigned to, last updated, status, and **View**.
- **Linked Jobs** — job type, job reference, vendor name, vendor contact number, vendor contact email, status.

Click a job reference to open `/jobs/[id]`.

### Compliance

**Vulnerability** (vulnerable customer, category) and **Contention** (contentious claim, contentious activity flag, optional details).

### Timeline

**Audit trail** with created, updated, and last Crunchwork update timestamps.

## Starting Work from a Claim

1. Open the claim.
2. Click **Create Job** in the header (or on the empty **Jobs** tab).
3. Complete the **Create Job** wizard — see [Creating a Claim](creating-a-claim.md) and [Jobs](../jobs/overview.md).

> **Required permission:** `jobs.create` (Create Jobs) is required for **Create Job**. Without it the action is not available.

## Archiving from the List

1. On a row, click the archive (trash) control without opening the claim.
2. Confirm **Archive** in the dialog.
3. The row leaves the **Active** list. Find it later under **Archived**.

> **Warning:** Archiving hides the claim from everyday views. It does not delete insurer history. Confirm you have the right claim number before you archive.

## Best Practices

1. **Use Customers → Claims**, not Admin **Organisation Claims**, for insurance losses.
2. **Search by claim number or address** before creating a second job — the claim may already exist from the insurer feed.
3. **Read Policy & Financial and Loss Details** before you raise a job so excess, CAT code, and priority are understood.
4. **Create the first job from the claim** so the site address and claim link are pre-filled.
5. **Treat Parties as the source of insured and assignee contacts** when you add job contacts later.
6. **Archive only when the claim is finished** in your organisation’s process; use **Archived** if you need to reopen it.
7. **Print from the claim header** when you need a claim PDF; do not look for print on the list row.
