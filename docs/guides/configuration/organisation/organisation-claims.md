---
title: "Organisation Claims"
slug: organisation-claims
description: "How to review and approve ownership claims on ghost organisation profiles and their associated purchase orders."
section: configuration
area: organisation
routes:
  - /admin/claims
audience: admin
permissions_discussed:
  - org.settings.manage
tags:
  - organisation
  - ghost
  - custody
  - purchase-orders
  - admin
related_guides:
  - company-settings
  - claims-overview
  - connections
  - purchase-orders
version: 1
last_updated: 2026-08-31
---

# Organisation Claims

**Organisation Claims** is an admin review queue. It is **not** the insurance **Claims** list under Customers (`/claims`).

Use this page when another organisation asks to take **custody** of a **ghost profile** (a placeholder organisation created from inbound purchase orders or similar) and the related purchase orders. Approving transfers operational ownership; rejecting leaves the ghost in place.

The page header describes the purpose: *Review and approve ownership claims from organisations wanting to take custody of their ghost profiles and associated purchase orders.*

## Key Concepts

- **Insurance claim** — a policy/loss record under **Customers → Claims**. Unrelated to this page.
- **Ghost organisation** — a stub organisation (name, ABN, email) that is not yet a full tenant profile.
- **Organisation claim** — a request to take custody of that ghost. Statuses: **pending**, **under_review**, **approved**, **rejected**.
- **Verification method** — how the requester proved they own the trading name (shown as a small badge when present).

## Accessing Organisation Claims

1. Click the **gear icon** in the top-right header.
2. Under **Organisation**, click **Organisation Claims**.

This item is visible in the admin sidebar without a separate permission chip. The approve/reject APIs still require an administrator session. If actions fail, your role likely lacks organisation administration rights (`org.settings.manage` or equivalent).

> **Warning:** Approving grants custody of the ghost profile and associated purchase orders. Do not approve unless ABN, trading name, and verification method match the requester you expect.

## Pending Review

The **Pending Review** section lists claims in **pending** or **under_review**.

Each row shows:

- Trading name, legal name, or organisation name
- ABN and primary email when known
- Date claimed
- Optional verification method badge

### Approving

1. Confirm the ABN and name match the organisation that should own the POs.
2. Click **Approve**.
3. The row moves to **Resolved** with status **approved**.

### Rejecting

1. Optionally type **Rejection notes** in the field under the row.
2. Click **Reject**.
3. The row moves to **Resolved** with status **rejected**.

If the API fails, a red banner shows the error message. Fix the cause and retry.

When there is nothing to review, you see **No pending claims to review**.

## Resolved

The **Resolved** section lists **approved** and **rejected** claims with a status chip and the review date when available.

There is no undo on this page. A rejected requester would need to submit a new claim through the product flow that created the original request.

## Status Reference

| Status | Section | Meaning |
|--------|---------|---------|
| `pending` | Pending Review | Awaiting an admin decision |
| `under_review` | Pending Review | Marked as being reviewed |
| `approved` | Resolved | Custody granted |
| `rejected` | Resolved | Custody denied |

## Best Practices

1. **Check ABN** against the Companies register or your onboarding pack before Approve.
2. **Read verification method** when the badge is present; if it is missing, ask the requester how they proved ownership.
3. **Add rejection notes** so the next admin understands why a claim was declined.
4. **Never confuse this page with Customers → Claims.** Wrong-queue approvals do not exist there, but mixing the two in conversation causes operational errors.
5. **Coordinate with Connections** if the ghost came from an insurer feed — see [Connections](../integrations/connections.md).
