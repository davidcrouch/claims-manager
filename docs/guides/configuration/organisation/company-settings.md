---
title: "Company Settings"
slug: company-settings
description: "How to update your organisation profile: legal name, ABN, contact details, and address."
section: configuration
area: organisation
routes:
  - /admin/settings
audience: manager
permissions_discussed:
  - org.settings.manage
tags:
  - company
  - organisation
  - abn
  - settings
related_guides:
  - managing-users
  - organisation-claims
  - features
  - notifications
  - filesystem-templates
version: 1
last_updated: 2026-08-31
---

# Company Settings

The **Company** page holds the organisation profile EnsureOS uses on documents, identity, and vendor-facing records: legal name, ABN, contact email, phone, and address.

**Features** and **Notifications** are separate admin pages. They are no longer tabs on Company. Old bookmarks such as `/admin/settings?tab=features` redirect to **Features**.

## Key Concepts

- **Company name** — required. This is the organisation’s display and legal name in EnsureOS.
- **ABN / Business number** — Australian Business Number or equivalent registration number used on invoices and claims paperwork.
- **Contact email / phone** — primary organisation contacts, not an individual user’s login email.
- **Address** — typed with address autocomplete so the stored value is a real street address.

## Accessing Company

1. Click the **gear icon** in the top-right header.
2. Under **Organisation**, click **Company**.

> **Required permission:** Viewing the page follows your admin access. Saving requires `org.settings.manage` (Manage Org Settings). Without it, Save stays unavailable or the API rejects the update.

## Editing Company Details

The **Company details** card contains:

| Field | Notes |
|-------|--------|
| **Company name** | Required. Save is blocked (toast) if this is empty. |
| **ABN / Business number** | Optional but strongly recommended for invoicing. |
| **Contact email** | Organisation inbox, for example `admin@yourcompany.com`. |
| **Phone** | Include country code (placeholder `+61 …`). |
| **Address** | Start typing a street address; pick a suggestion from autocomplete. |

1. Change the fields you need.
2. **Cancel** restores the last saved values (enabled only while the form is dirty).
3. **Save** writes the profile. A success toast confirms **Company details saved**.

The header **Save** button is disabled until something has changed, and while a save is in progress it shows **Saving…**.

> **Note:** Keep ABN and address accurate. Generated invoices, scopes, and assessment reports often pull these fields as the contractor identity.

## Related Admin Pages

| Need | Page |
|------|------|
| Feature flags | [Features](../admin/features.md) |
| Email notification list | [Notifications](../admin/notifications.md) |
| Invite people | [Managing Users](managing-users.md) |
| Default job filesystem layout | [Filesystem Templates](../content/filesystem-templates.md) |
| Who may claim ghost vendor profiles | [Organisation Claims](organisation-claims.md) |

## Best Practices

1. **Set Company name and ABN before** sending the first invoice or estimate to an insurer.
2. **Use a shared inbox** for contact email so it survives staff changes.
3. **Prefer autocomplete** for address instead of free-typing a formatted block that reports cannot parse.
4. **Review the profile after a trading-name change** so print templates do not still show the old entity.
5. **Do not store secrets** on this page — connections and API credentials live under [Connections](../integrations/connections.md).
