---
title: "Appointments"
slug: appointments
description: "How to book site visits and meetings, manage attendees and addresses, and keep appointments in sync with the job and Schedule."
section: operations
area: tasks-and-scheduling
routes:
  - /appointments
audience: member
permissions_discussed:
  - workflows.read
  - workflows.manage
  - contacts.read
tags:
  - appointments
  - schedule
  - jobs
  - attendance
  - assessments
related_guides:
  - schedule
  - completing-an-assessment
  - jobs-overview
  - tasks
  - contacts-overview
version: 1
last_updated: 2026-08-31
---

# Appointments

Appointments are booked site attendances and meetings. Use this page to list them, add a new booking, or edit attendees and times. The same **Appointment** drawer also opens from a job’s Overview when you click **Add Appointment**.

Booked appointments appear on **Schedule** as blue chips and on the Dashboard **Today** panel when they fall on the current day.

## Key Concepts

- **Appointment** — a titled booking with type, location, start, duration, status, and attendees.
- **Attendee** — a **USER** (organisation user) or **CONTACT** (customer, broker, vendor).
- **Status** — Scheduled, Completed, or Cancelled.
- **Job address** — the drawer often defaults the address from the job so the visit matches the site.
- **Booked date** — Job Overview can show a booked date; **Add Appointment** on the job is offered when that date is not yet set.

## Accessing Appointments

1. In the left sidebar, under **Operations**, click **Appointments**.
2. Click a row to edit the appointment in the drawer (there is no `/appointments/[id]` page).
3. From a job, open **Overview** and click **Add Appointment** (when the job does not already have a booked date).

> **Required permission:** You need `workflows.read` to view appointments. **Add Appointment** requires `workflows.manage`. Picking contacts needs `contacts.read`.

Some links open `/appointments?open=<id>`. EnsureOS opens that appointment’s drawer, then drops `open` from the URL.

## Job Filter

When a job is selected in the sidebar job picker, the Appointments link becomes `/appointments?jobId=…`. The count badge is for that job only.

Filter by job from the **Job** column as well.

> **Tip:** If the list looks empty, check whether a job is selected. Clear job context to see the organisation-wide list again.

## The Appointments List

The header title is **Appointments**. It shows total count and a status breakdown.

1. Sort by **Start**, **Title**, **Status**, or **Location**.
2. Search by title.
3. Use the status menu for **Scheduled**, **Completed**, and **Cancelled**.
4. Filter **Type**, **Job**, **Location**, or **Status** from column headers.
5. Click **Add Appointment**.

| Column | What it shows |
|--------|----------------|
| **Name** | Appointment title |
| **Job** | Linked job |
| **Type** | Appointment type |
| **Location** | Location lookup |
| **Start** | Start date and time |
| **Duration** | Computed from start and end (for example `1h 30m`) |
| **Status** | Scheduled, Completed, or Cancelled |
| **Attendees** | USER / CONTACT chips and names |

Empty state: **No appointments found.** Expand a row’s attendees to see the full list.

## Creating an Appointment

1. Click **Add Appointment** (or **Add Appointment** on Job Overview).
2. Enter a **title** (for example Initial Site Inspection).
3. Select **Type** and **Location**.
4. Choose **Assigned To** (search contacts) and any job **parties** who should attend.
5. Set start and end (or duration) and **timezone**.
6. Confirm the **address** — it often defaults to the job address (for example the site street).
7. Add optional notes.
8. Click **Create Appointment**.

When opened from a job, the drawer pre-fills job parties and the site address. Keep those defaults unless the meeting is elsewhere (for example the insurer’s office).

## Editing and Completing

1. Click the row.
2. Update times, attendees, or status.
3. Set status to **Completed** after the visit, or **Cancelled** if it will not occur.
4. Save and close. The Schedule chip updates on the next load.

> **Note:** Assessment **Attendance** fields are a separate record. After a site visit, update attendance on the assessment as well as completing the appointment so reports stay consistent.

## Relation to the Schedule

Appointments with a start time appear on **Schedule**. Click the blue chip to open this same drawer. Do not create a second appointment from the Appointments page for a visit you can already see on the calendar.

## Best Practices

1. **Book before you attend.** Unbooked visits do not appear on Dashboard **Today** or the Schedule.

2. **Include the customer and the assessor** (or builder) as attendees so everyone is on the record.

3. **Use the job address** unless the meeting is explicitly off-site.

4. **One appointment per visit.** Change the time on the existing booking instead of duplicating.

5. **Complete the appointment** the same day so Open/Scheduled filters stay useful.

6. **Keep assessment Attendance in sync** when the visit is for an assessment job.

7. **Create from the job** when you are already on Job Overview — parties and address are filled for you.
