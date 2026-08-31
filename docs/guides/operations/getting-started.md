---
title: "Getting Started"
slug: getting-started
description: "How to sign in, find your way around EnsureOS, use job context, and open help on any page."
section: operations
area: onboarding
routes:
  - /dashboard
audience: all
permissions_discussed:
tags:
  - onboarding
  - navigation
  - help
  - sidebar
  - dashboard
related_guides:
  - dashboard
  - claims-overview
  - jobs-overview
  - managing-users
  - roles-and-permissions
version: 1
last_updated: 2026-08-31
---

# Getting Started

EnsureOS is the operations workspace for insurance repair work: claims, jobs, assessments, estimates, invoices, and the vendors who deliver them. After you sign in you land on the **Dashboard**, which is a morning worklist rather than a statistics board.

This guide explains how the application is organised, how job context filters related lists, and how to get help without leaving the page you are on.

## Key Concepts

- **Organisation** — your company tenant. Users, catalogues, and settings belong to the organisation you signed into.
- **Sidebar groups** — **Customers**, **Vendors**, **Operations**, and **Finance** hold day-to-day work. Admin pages live under the gear icon.
- **Job context** — when a job is selected, many Operations and Customers lists append `?jobId=` so you only see records for that job.
- **Help (? )** — opens the Help Assistant and the guide for the current page in the canvas beside chat.
- **AI chat** — a separate drawer for working *on* the page (for example filling an assessment tab). Help and chat can both be open; Help always uses the Help Assistant.

## Signing In

1. Open the EnsureOS application URL for your environment.
2. Sign in with the account you were invited to (email invitation from **Users**).
3. You arrive on **Dashboard**.

> **Note:** If you cannot sign in, ask an organisation administrator to confirm your invitation was sent and that your user is **Active**, not **Disabled**. See [Managing Users](../configuration/organisation/managing-users.md).

## Finding Your Way

The left sidebar is grouped to match how work flows:

| Group | Typical use |
|-------|-------------|
| **Dashboard** | Start of day: decisions, today’s calendar, unread items |
| **Customers** | Claims, jobs, journals, assessments, estimates, work orders, invoices |
| **Vendors** | RFQs, proposals, purchase orders, bills |
| **Operations** | Tasks, schedule, communications, appointments, contacts, documents |
| **Finance** | Accounts receivable, accounts payable, reports |

1. Click a sidebar item to open its list.
2. Click a row to open the **detail** page (tabs, header actions, related records).
3. Use the **back** control on a detail page to return to the list.

### Admin settings

1. Click the **gear icon** in the top-right header.
2. The admin sidebar appears with **Organisation**, **Content**, **AI**, **Integrations**, and **Admin**.
3. Pages you cannot access (missing permission or feature flag) are hidden.

> **Required permission:** Admin items such as **Users** (`org.users.read`) and **Roles & Permissions** (`org.roles.read`) only appear if your role includes those permissions.

## Job-Scoped Lists

Several sidebar items are **job-filterable**. When a job is selected in the header job picker, EnsureOS appends `?jobId=` to those links and shows a count badge when that job has related records.

Typical job-filtered pages include **Journals**, **Assessments**, **Estimates**, **Work Orders**, **Invoices**, **RFQs**, **Proposals**, **Purchase Orders**, **Bills**, **Tasks**, **Schedule**, **Communications**, **Appointments**, **Contacts**, and **Documents**.

> **Tip:** If a list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## Asking for Help

1. Stay on the page you need help with (for example **Roles & Permissions** or an assessment).
2. Click **?** at the far right of the header (after notifications).
3. Chat opens with the **Help Assistant**. It looks up the guide for the current pathname and opens it in the canvas.
4. Read the guide in the canvas (headings, tables, callouts). The canvas is **read-only** for help documents.
5. For a question that is not about the current page, type it in chat. The assistant searches all guides.

> **Note:** Help uses the page **pathname** (for example `/admin/roles`), not the page title. If no guide exists yet, the assistant says so and can search related topics.

## Where to Go Next

| If you need to… | Open |
|-----------------|------|
| See what needs a decision today | [Dashboard](dashboard.md) |
| Find or create a claim | [Claims overview](claims/overview.md) |
| Work a repair or assessment job | [Jobs overview](jobs/overview.md) |
| Complete a site assessment | [Completing an Assessment](assessments/completing-an-assessment.md) |
| Price work | [Creating an Estimate](estimates/creating-an-estimate.md) |
| Invite a teammate | [Managing Users](../configuration/organisation/managing-users.md) |
| Change what a role can do | [Roles & Permissions](../configuration/organisation/roles-and-permissions.md) |

## Best Practices

1. **Start on the Dashboard** each day so overdue tasks and unpublished estimates are not missed.
2. **Select a job** before uploading documents or adding journals so files land on the job’s project filesystem, not only the company tree.
3. **Use Help (? ) on the page** rather than asking a generic question first — route lookup is faster and more accurate.
4. **Ask an admin for the smallest role** that still lets you do your job (see Roles & Permissions).
5. **Do not share logins.** Invite each person as their own user so audit and assignments stay accurate.
