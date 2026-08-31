---
title: "Creating a Claim"
slug: creating-a-claim
description: "How insurance claims enter EnsureOS and how to start the first job from a claim."
section: operations
area: claims
routes:
  - /claims
  - /claims/[id]
audience: member
permissions_discussed:
  - claims.read
  - claims.create
  - jobs.create
  - jobs.read
tags:
  - claims
  - create
  - jobs
  - crunchwork
  - onboarding
related_guides:
  - claims-overview
  - managing-claims
  - jobs-overview
  - organisation-claims
version: 1
last_updated: 2026-08-31
---

# Creating a Claim

Insurance claims in EnsureOS usually **arrive from the insurer connection** (for example Crunchwork / NRMA). The **Claims** list does not have a **New Claim** button or a claim create form. Your day-to-day “create” work is finding the new claim and raising the first job against it.

This guide explains how new claims appear, how to confirm you have the right record, and how to open the **Create Job** drawer from the claim. It is not about **Organisation Claims** (custody of ghost profiles under the gear icon).

## Key Concepts

- **Inbound claim** — a policy/loss record synced from the insurer. Identifiers such as claim number, Crunchwork ID, and insurer reference are set by that feed.
- **First job** — the operational record you create on the claim (assessment, make-safe, works, and so on).
- **Provider** — on **Create Job**, **Internal** keeps the job in EnsureOS; **Crunchwork** publishes it to NRMA and **requires a claim**.
- **Pre-filled claim** — when you click **Create Job** from claim detail, the **Claim** field is already set and the site address is copied from the risk address.

## Accessing Claims

1. In the left sidebar, open **Customers**.
2. Click **Claims**.

> **Required permission:** You need `claims.read` to see the register. Starting a job needs `jobs.create`. The `claims.create` permission exists for integrations; there is no in-app **New Claim** control today.

> **Warning:** **Gear icon → Organisation → Organisation Claims** is a different product. Approving a custody request there does not create an insurance claim under **Customers → Claims**.

## Finding a Newly Arrived Claim

1. On **Claims**, stay on the **Active** tab.
2. Search by claim number, insurer reference, policy, or address.
3. Optionally filter **Account** to the insurer you expect.
4. Sort **Updated** or **Lodged** if you are looking for the latest intake.
5. Open the row and check **Overview**: claim number, insurer reference, Crunchwork ID, account, and risk address.

> **Tip:** If search returns nothing, wait for sync and try the insurer reference as well as the claim number. Confirm you are not on **Archived**.

## Confirming the Claim Before You Raise a Job

1. Open **Policy & Financial** and note excess, sums insured, and accommodation limits.
2. Open **Loss Details** for date of loss, loss type, CAT code, and priority.
3. Open **Parties** for insured contacts and assignees you may copy onto the job.
4. Open **Jobs**. If jobs already exist, open them instead of creating a duplicate.

> **Note:** Claim fields on these tabs are displayed from the insurer payload. You do not fill a “new claim” form in EnsureOS.

## Creating the First Job from the Claim

This is the supported way to start work on a new claim.

1. On claim detail, click **Create Job** in the header (or **Create Job** on an empty **Jobs** tab).
2. The **Create Job** drawer opens on step **1. Job Details**.
3. Confirm **Claim** is the current claim. The site address fields should already match the risk address.
4. Fill **Job Details** using the table below.
5. Click **Next**.
6. On **2. Contacts**, search existing contacts or click **New contact**. Contacts are optional.
7. Click **Next**.
8. On **3. Review & publish**, read the **Job summary** and **Claim** cards.

### Job Details fields

| Field | Required | Notes |
|-------|----------|--------|
| **Claim** | Yes for Crunchwork | Pre-selected from claim detail. **None** is only valid for Internal jobs. |
| **Name** | Yes | e.g. `Kitchen make-safe` |
| **Job Type** | Yes | From a claim, often defaults to **Builder Make Safe** |
| **Document folders** | No | Project folder template; default template is preferred when listed |
| **Assigned** | No | Defaults to you |
| **Provider** | Yes | **Internal** or **Crunchwork**. From a claim this defaults to **Crunchwork** |
| **Instructions** | No | Copied onto the job Overview |
| **Excess** | No | Currency amount |
| **Make safe required** | No | Ticked automatically for Builder Make Safe |
| **Site address** | Recommended | **Search address**, or unit / street no. / street name / suburb / state / postcode / country |

### Publishing the job

- If **Provider** is **Crunchwork**, the banner says **This will be pushed to NRMA**. Click **Submit to NRMA**.
- If **Provider** is **Internal**, the banner says **This job will be created internally**. Click **Create Job**.

After success, EnsureOS opens the new job. Confirm the header **Claim:** link returns to the parent claim, then open the claim **Jobs** tab — the new row should appear under **Internal Jobs** (or **Linked Jobs** if a vendor snapshot is present).

Use **Back** on any wizard step to change details; **Cancel** closes the drawer without creating. **Create Job** from the claim does not create a second insurance claim; it only creates the job.

> **Required permission:** `jobs.create` (Create Jobs). Crunchwork publish also needs a working insurer connection.

> **Warning:** A Crunchwork job **requires a claim**. If you opened **Create Job** from **Customers → Jobs** instead, you must pick the claim on **Job Details** or the wizard returns you to that step with *A claim is required when publishing the job to NRMA.*

## Creating a Job from the Jobs List (Claim Already Exists)

Use this when you are already on **Jobs** and the claim is in the register.

1. Click **Customers → Jobs**.
2. Click **Create Job**.
3. On **Job Details**, set **Claim** to the claim (not **None**) if you will publish to NRMA.
4. Selecting a claim copies its address into **Site address**.
5. Complete **Contacts** and **Review & publish** as above.

Linking the claim here is the same operational outcome as **Create Job** on claim detail.

## What You Cannot Do on This Screen

| Action | Current behaviour |
|--------|-------------------|
| **New Claim** on the Claims list | Not present — claims are ingested |
| Fill a claim create form | Not present |
| Type a brand-new claim number locally | Not supported in the UI |
| Approve organisation custody | Use [Organisation Claims](../../configuration/organisation/organisation-claims.md) |

If a loss is missing from **Claims**, ask an administrator to check the insurer **Connections** feed rather than expecting a create button.

## After the First Job Exists

1. On the claim, open **Jobs** and confirm the new row under **Internal Jobs** or **Linked Jobs**.
2. Open the job to set booked/attendance dates, assignee, and (if shown) **Type Details** — see [Jobs](../jobs/overview.md).
3. Use sidebar items such as **Journals**, **Assessments**, and **Estimates** with a job selected (`?jobId=`) for field work and pricing.

## Best Practices

1. **Search before you assume the claim is missing** — inbound sync often creates it before you are asked to attend.
2. **Start from claim detail Create Job** so claim and address cannot drift from the loss record.
3. **Read Loss Details and excess** before you choose job type (make-safe vs assessment vs works).
4. **Do not create a second Crunchwork job** for the same instruction without checking **Jobs** on the claim.
5. **Keep Provider as Crunchwork** when the insurer must see the job; use **Internal** only for work that must stay in EnsureOS.
6. **Add insured contacts on the job** from **Parties** so site attendance and journals have the right people.
7. **Never confuse this flow with Organisation Claims** — that admin page does not lodge an insurance claim.
