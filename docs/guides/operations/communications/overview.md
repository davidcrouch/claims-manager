---
title: "Communications"
slug: communications-overview
description: "How to use the in-app Communications inbox: read messages, send job-scoped messages, and how this page differs from Admin Notifications."
section: operations
area: communications
routes:
  - /messages
audience: member
permissions_discussed:
  - messaging.read
  - messaging.send
tags:
  - communications
  - messages
  - notifications
  - jobs
  - dashboard
related_guides:
  - dashboard
  - notifications
  - jobs-overview
  - contacts-overview
version: 1
last_updated: 2026-08-31
---

# Communications

Communications is the in-app inbox for messages tied to jobs and claims. The sidebar label is **Communications**; the page route is `/messages`. Use it to read threads, acknowledge items that require a response, and send a message when a job is selected.

This is not the Admin **Notifications** page. Admin Notifications configures organisation email and system notification settings. This page is the operational inbox.

## Key Concepts

- **Message** — a subject, body, sender, recipient, date, and optional attachments, usually linked to a job.
- **Read / Unread** — unread means acknowledgement is required and not yet given. Other messages show as Read.
- **Acknowledgement required** — amber badge on the detail drawer until the message is acknowledged.
- **Send Message** — compose drawer. The header button appears only when a job is in context.
- **Provider** — a chip on messages that originated from a connected provider.

## Communications vs Admin Notifications

| | Communications | Notifications (Admin) |
|--|----------------|------------------------|
| Sidebar | **Operations** → Communications | Gear → **Admin** → Notifications |
| Route | `/messages` | `/admin/notifications` |
| Purpose | In-app inbox for job/claim messages | Organisation notification configuration |
| Typical user | Everyone working a job | Administrators |

> **Note:** Dashboard **New and unread** and the **Unread** snapshot tile count inbox items from this page, not Admin notification templates.

## Accessing Communications

1. In the left sidebar, under **Operations**, click **Communications**.
2. Click a row to open the message detail drawer.
3. From the Dashboard, click an unread item or the **Unread** tile to jump to this inbox.

> **Required permission:** You need `messaging.read` (Read Messaging) to view the list and drawer. **Send Message** requires `messaging.send`.

## Job Filter

When a job is selected in the sidebar job picker, the Communications link becomes `/messages?jobId=…`. The count badge is for that job only.

**Send Message** is shown only when a job is selected (sidebar picker or `?jobId=`). Without a job, you can still read the organisation-wide inbox.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see all messages again.

## The Messages List

The header title is **Communications**. It shows total count and how many rows are showing.

1. Sort by **Date** or **Subject**.
2. Search by subject or body.
3. Filter **Read** / **Unread** from the status menu, or **From**, **To**, **Status**, and **Job** from column headers.
4. Click a row to open the drawer.

| Column | What it shows |
|--------|----------------|
| **Job** | Job the message is from or to |
| **Subject** | Message subject |
| **From** | Sender name |
| **To** | Recipient name |
| **Date** | Created date and time |
| **Status** | Read or Unread |
| **Attachments** | Whether files are attached |

Empty state: **No messages found.**

## Reading a Message

1. Click the row.
2. Review **From**, **To**, **Date**, and the **Job** link.
3. Read the body. Provider and message-type chips appear in the header when present.
4. If you see **Acknowledgement required**, treat the item as unread until it is acknowledged.
5. Click **Close** when finished.

> **Note:** Acknowledgement state is what the list uses for Unread. Opening the drawer alone may not mark a required acknowledgement as done.

## Sending a Message

1. Select a job in the sidebar (or open Communications from a job).
2. Click **Send Message**.
3. Choose a **Subject** from the list (for example General, Repair Update, Status Update, Vulnerable Customer).
4. Write the body in the editor (bold, italic, lists).
5. Optionally turn on **acknowledgement required** if the recipient must confirm they have read it.
6. Send.

Subjects are fixed operational categories (including Contentious claim, Cancellation Request, and Cash Settlement Request). Pick the closest match so the inbox stays filterable.

> **Warning:** Do not send job instructions only from personal email. Keep insurer and customer threads on the job so the next person on the claim can find them.

## Best Practices

1. **Work unread from the Dashboard**, then open Communications for the full thread.

2. **Select the job before sending** so **Send Message** appears and the message is filed on the right site.

3. **Use acknowledgement required** for decisions (cash settlement, cancellation, complaints), not for routine status notes.

4. **Keep the subject accurate.** “General” hides urgent complaint or vulnerable-customer work.

5. **Do not confuse this inbox with Admin Notifications.** Changing notification settings will not send a job message.

6. **Filter to Unread** at the end of the day so nothing that needs acknowledgement is left overnight.

7. **Link the job in the drawer** when you need to act — the Job row opens the job, not another message.
