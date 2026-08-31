---
title: "Schedule"
slug: schedule
description: "How to use the organisation calendar: month, week, and day views, event type filters, and opening appointments or tasks from a chip."
section: operations
area: tasks-and-scheduling
routes:
  - /schedule
audience: member
permissions_discussed:
  - workflows.read
  - workflows.manage
tags:
  - schedule
  - calendar
  - appointments
  - tasks
  - dashboard
related_guides:
  - appointments
  - tasks
  - dashboard
version: 1
last_updated: 2026-08-31
---

# Schedule

The Schedule is your organisation’s calendar of dated work: appointments, tasks, and other records that have a start time. Use it to see what is happening this week, then open the underlying appointment or task.

The Dashboard **Today** panel links here (**Schedule**). Today’s timed items on the Dashboard are the same events you see when you open this page and click **Today**.

## Key Concepts

- **Event** — a coloured chip on a day (appointment, task, message, claim, job, quote, and other types).
- **View** — **Month**, **Week**, or **Day**.
- **My Work** — switch that limits the calendar to work assigned to you.
- **Type filters** — toggles that show or hide event kinds. Defaults: tasks, appointments, claims, jobs, and quotes (estimates).
- **Drawer vs page** — appointments and tasks open in a drawer; most other types navigate to their detail page.

## Accessing the Schedule

1. In the left sidebar, under **Operations**, click **Schedule**.
2. From the Dashboard, click **Schedule** on the **Today** panel.

> **Required permission:** You need `workflows.read` to view the calendar. Creating or editing an appointment or task from a chip requires `workflows.manage`.

## Job Filter

When a job is selected in the sidebar job picker, the Schedule link becomes `/schedule?jobId=…`. The count badge and the events loaded are for that job only.

> **Tip:** If the calendar looks empty, check whether a job is selected, whether **My Work** is on, and which type filters are enabled. Clear job context to see the organisation-wide calendar.

## Choosing a View

1. Use **Month**, **Week**, or **Day** in the toolbar.
2. Click the chevrons to move backward or forward (one month, one week, or one day).
3. Click **Today** to jump to the current date.
4. Toggle **All** / **My Work** to switch between the organisation calendar and your assignments.

The header title is **Schedule**. The count is the number of events visible after type filters. While events load you will see **Loading…** next to the date controls.

The scope switch is labelled **All** and **My Work** (not “Mine”). **All** is the organisation calendar; **My Work** limits events to items assigned to you.

## Month, Week, and Day

**Month** is a seven-column grid (Sun–Sat). Today’s date is a blue circle. Days outside the current month are faded. Each cell shows up to three event chips; **+N more** means switch to Week or Day.

**Week** lists each day in the week of the cursor, with timed bars (title plus start time).

**Day** lists every event on the selected date as full-width bars.

Empty state (after filters): **No events in this period for the selected filters.**

> **Note:** The calendar does not create records when you click an empty cell. Create appointments on **Appointments** and tasks on **Tasks**; they appear here once they have a start or due time.

## Event Types

Two rows of type toggles sit under the date toolbar.

| Colour (typical) | Type | Opens |
|------------------|------|--------|
| Amber | Tasks | Task drawer |
| Blue | Appointments | Appointment drawer |
| Sky | Messages | Communications / message |
| Orange | Claims | Claim detail |
| Teal | Jobs | Job detail |
| Indigo | Quotes | Estimate detail |
| Purple | Work Orders | Work order detail |
| Lime | Invoices | Invoice detail |
| Stone | Journals | Journal detail |
| Fuchsia | Assessments | Assessment detail |
| Cyan | RFQs | RFQ detail |
| Violet | Proposals | Proposal detail |
| Emerald | Purchase Orders | PO detail |
| Rose | Bills | Bill detail |

1. Click a type label to include or exclude it.
2. Leave the defaults on for a morning planning view (tasks, appointments, claims, jobs, estimates).
3. Turn on **RFQs**, **Proposals**, **Purchase Orders**, and **Bills** when you are coordinating vendors.

> **Note:** Month cells show up to three chips, then a remainder. Switch to **Week** or **Day** to see every event on a busy date.

## Opening an Event

1. Click a chip or bar.
2. For **Appointments** and **Tasks**, a form drawer opens so you can edit times, attendees, or status.
3. For other types, EnsureOS navigates to that record’s page.

There is no **Create** button on the Schedule itself. Create appointments on **Appointments** (or Job Overview **Add Appointment**) and tasks on **Tasks**. They appear here once they have a start or due date.

## Planning a Day from the Dashboard

1. On the Dashboard, scan the **Today** rail for timed items.
2. Click **Schedule** on that panel to open this page on the current date.
3. Switch to **Day** if the month grid overflowed (**+N more**).
4. Turn on **My Work** if you only need your bookings, then **All** before you reassign work.
5. Click a blue appointment chip or amber task chip to edit it in a drawer.

Overdue tasks still belong on **Tasks** (and Dashboard **Needs a decision**). The Schedule shows dated items in the selected period; it is not an overdue queue.

## Best Practices

1. **Start from Dashboard Today**, then open **Schedule** if you need the rest of the week.

2. **Use My Work in the morning** so you only see your appointments and tasks, then switch to **All** before assigning work.

3. **Keep type filters honest.** If vendor POs are hidden, you will miss site clashes.

4. **Book appointments on the Appointments page** (or the job) rather than expecting to click an empty calendar cell to create.

5. **Give tasks due dates** so they appear as amber chips. Tasks without dates do not show on the calendar.

6. **Select a job** when you are planning one site only — the sidebar badge is the count for that job.

7. **Open the appointment drawer from the chip** to change attendees; do not create a second appointment for the same visit.
