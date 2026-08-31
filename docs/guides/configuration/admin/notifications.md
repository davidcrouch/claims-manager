---
title: "Notifications"
slug: notifications
description: "What the Notifications admin page shows today: listed email types and placeholder toggles that are not yet configurable."
section: configuration
area: admin
routes:
  - /admin/notifications
audience: manager
permissions_discussed:
  - messaging.read
tags:
  - notifications
  - email
  - placeholder
  - admin
related_guides:
  - communications-overview
  - company-settings
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Notifications

**Notifications** is a standalone Admin page that lists the email notification types EnsureOS intends to support. It is **not** a finished preference centre yet.

The screen shows five email types and visual toggles that are **not connected**. You cannot turn email on or off from this page today. In-app alerts (the header bell) are separate from this list.

## Key Concepts

- **Email notification type** — a named event that may later send mail (new claim, job status, and so on).
- **Placeholder toggle** — the grey switch-shaped control on each row. It does not save and is not wired to an API.
- **In-app notifications** — the header bell and communications list. Those are not configured on this page.

## Accessing Notifications

1. Click the **gear icon** in the top-right header.
2. Under **Admin**, click **Notifications**.

This is **not** a tab on [Company Settings](../organisation/company-settings.md). Company is profile only.

> **Required permission:** The menu is visible to users who can open Admin Settings. There is no separate notifications-manage permission on this screen yet. Reading in-app messages elsewhere uses `messaging.read`.

The page title is **Notifications**.

## What you see today

Under **Email Notifications**, each row is a label plus a grey pill:

| Email type | Intended meaning (when the API exists) |
|------------|----------------------------------------|
| **New claim received** | A new claim has arrived in the organisation |
| **Job status changed** | A job moved to another status |
| **Invoice submitted** | An invoice was submitted |
| **Work order issued** | A work order was issued |
| **Task overdue** | A task passed its due time |

The footer on the card states: **Notification preferences will be configurable once the notifications API is connected.**

Hovering a toggle shows: **Toggle will be functional once the notifications API is connected.**

> **Note:** Clicking a toggle does nothing. Settings are not saved. Do not assume staff will or will not receive these emails based on this page.

> **Warning:** This page does not document a live mail-out. If your organisation receives email today, that is from another process — not from these switches.

## What this page does not do

- It does **not** send email.
- It does **not** store preferences.
- It does **not** control the header **bell** or the Communications inbox.
- It does **not** let you add custom event types.

When the notifications API is connected, expect these five rows to become real on/off (or similar) preferences. Until then, treat the list as a **preview of event names only**.

For day-to-day messages and the bell, use Communications and the dashboard, not this admin page.

## Related places that *do* notify people

| Place | What you get today |
|-------|--------------------|
| Header **bell** | In-app alerts already delivered to the signed-in user |
| **Communications** (`/messages`) | Messages and threads |
| **Dashboard** | Work queues and counts — not email preferences |

> **Tip:** If someone asks “why didn’t I get an email when the job changed?”, do not look here for a switch that was left off. The switches are placeholders. Check whether your organisation sends mail from another process, and use Communications for in-app traffic.

## Best Practices

1. **Do not train staff to “turn off email here”** — the controls are not live.

2. **Use the listed event names** when talking to support about future email, so everyone means the same five types.

3. **Check Communications and the header bell** for actual in-app alerts.

4. **Keep Company contact email accurate** so that when email preferences ship, they have a sensible organisation inbox to use.
