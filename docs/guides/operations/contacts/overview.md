---
title: "Contacts"
slug: contacts-overview
description: "How to create and maintain people and organisations in the Contacts directory, and how they appear on job and claim Parties."
section: operations
area: contacts
routes:
  - /contacts
  - /contacts/[id]
audience: member
permissions_discussed:
  - contacts.read
  - contacts.manage
tags:
  - contacts
  - parties
  - jobs
  - claims
  - vendors
related_guides:
  - claims-overview
  - jobs-overview
  - vendors-overview
  - appointments
version: 1
last_updated: 2026-08-31
---

# Contacts

Contacts are the people and organisations you deal with: insureds, brokers, restorers, and vendor staff. The Contacts list is the organisation directory. Job and claim **Parties** tabs attach these same contacts to a role on a specific job.

Keep one contact record per person. Use Parties to say *why* they are on a job.

## Key Concepts

- **Contact** — first name, last name, email, phones, notes, and one or more **contact types**.
- **Contact type** — lookup such as insured, broker, or vendor (at least one type is required when creating).
- **Related jobs** — jobs this contact is already attached to, with role, type, status, and location.
- **Parties** — job- or claim-specific roles. Adding a party links an existing contact (or creates one) to that job.
- **Active / Archived** — list tabs. Archived contacts stay in history but drop off the Active tab.

## Accessing Contacts

1. In the left sidebar, under **Operations**, click **Contacts**.
2. Click a row to open `/contacts/[id]`.
3. Use **Back to contacts** on the detail header.

You also create contacts from other drawers (for example **Receive Proposal** → **Create Contact**, or RFQ **Send Request** recipients).

> **Required permission:** You need `contacts.read` to view the list and detail pages. **Add Contact** and editing fields require `contacts.manage`.

## Job Filter

When a job is selected in the sidebar job picker, the Contacts link becomes `/contacts?jobId=…`. The count badge is for contacts related to that job.

The **Job** column shows the selected job, or the contact’s related jobs (and `+N` when there are more).

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide directory. Unlinked contacts (no job) can also be hidden by a job filter.

## The Contacts List

The header title is **Contacts**. It shows total count and how many rows are showing.

1. Choose **Active**, **Archived**, or **All**.
2. Search by name, email, or phone.
3. Filter by **Job** from the Job column header.
4. Click **Add Contact**.

| Column | What it shows |
|--------|----------------|
| **Job** | Related job(s) |
| **Name** | First and last name |
| **Email** | Email address |
| **Status** | Active or Archived |
| **Phone** | Best available phone |
| **Created** | Created date |

Empty state: **No contacts found.**

## Creating a Contact

1. Click **Add Contact**.
2. Select at least one **contact type**.
3. Enter **First name** (required) and optional last name, email, mobile, home, and work phones.
4. Add **Notes** if the person has access or communication constraints.
5. Click create.

Email is validated when provided. Proposal and RFQ matching use email, so add it for anyone you will send an RFQ to.

## Contact Detail

The detail page autosaves as you edit.

1. Update name, email, phones, notes, and contact types.
2. Review **Related jobs** — job, role, type, status, location, updated.
3. Click a related job to open that job.

Header fields include contact types and how many related jobs exist.

> **Note:** Changing a contact here updates every job that uses that person. Do not “fix” a name for one job by creating a second contact.

## Contacts vs Job Parties

| Need | Where to work |
|------|----------------|
| Correct spelling, email, or phone for a person | **Contacts** detail |
| “This person is the insured on job X” | Job → **Parties** (or **Add contacts** on the job) |
| Vendor organisation you buy from | **Vendors** directory (opened from RFQ/PO/bill), plus a vendor *contact* here for email |

> **Warning:** Do not create a new contact every time someone appears on a job. Search first, then attach them as a party.

## Best Practices

1. **One contact per person.** Merge duplicates by reusing the existing record on Parties.

2. **Always set a type.** Types drive filters and RFQ/proposal contact pickers.

3. **Store a working email** for vendors you send RFQs to — matching is by email.

4. **Use Parties for job-specific roles.** The directory is not the place to record “loss adjuster on this claim only” without a party link.

5. **Archive leftover contacts** instead of deleting history; use the **Archived** tab when you need them again.

6. **Check Related jobs** before changing a name or email so you know which sites you are affecting.

7. **Create from the job** when you are already adding parties — the contact is then linked immediately.
