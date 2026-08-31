# 63h — Guides: Operations Workspace

**Status:** Planned  
**Date:** 2026-08-31  
**Parent:** `63_HELP_GUIDE_CONTENT_ROLLOUT.md`  
**Priority:** P2  
**Related:** `14_TASKS_MODULE.md`, `15_APPOINTMENTS_MODULE.md`, `13_MESSAGES_MODULE.md`, `33h_OPERATIONS_STANDALONE_PAGES.md`, `ui/11_OPERATIONS.md`, `39_FILESYSTEM_MODULE.md`, `47_COMPANY_PROJECT_FILESYSTEMS.md`

---

## Objective

Document the Operations sidebar: Tasks, Schedule, Communications, Appointments, Contacts, Documents (including upload). These pages are **cross-entity** and usually honour `?jobId=` from the sidebar job picker.

---

## Guides

| File | Slug | Routes | Audience |
|------|------|--------|----------|
| `operations/tasks-and-scheduling/tasks.md` | `tasks` | `/tasks` | member |
| `operations/tasks-and-scheduling/schedule.md` | `schedule` | `/schedule` | member |
| `operations/tasks-and-scheduling/appointments.md` | `appointments` | `/appointments` | member |
| `operations/communications/overview.md` | `communications-overview` | `/messages` | member |
| `operations/contacts/overview.md` | `contacts-overview` | `/contacts`, `/contacts/[id]` | member |
| `operations/documents/overview.md` | `documents-overview` | `/documents` | member |
| `operations/documents/uploading-documents.md` | `uploading-documents` | `/documents`, `/jobs/[id]` | member |

No detail routes for tasks/schedule/messages/appointments/documents in the App Router tree (list + drawers). Job attachments also live on **Job → Attachments** (cross-link 63b).

Permissions: `workflows.read` / `workflows.manage`, `messaging.read` / `messaging.send`, `contacts.read` / `contacts.manage`, `documents.read` / `documents.manage`.

---

## Shared: job context

Every list guide in this subplan must include a short **Job filter** subsection:

- With a job selected in the chrome, the href becomes `/tasks?jobId=…` (etc.).
- Counts on the sidebar (`countKey`) reflect that job.
- Dashboard Today → Schedule; overdue tasks → Tasks.

---

## 1. Tasks

**Sources:** `TasksListClient.tsx`, polymorphic entity attachment (plan 33).

### Outline

1. Intro — work items attached to a job (or other entities if the UI allows).
2. Key Concepts — assignee, due date, status, My tasks vs team (Dashboard).
3. Accessing — Operations → **Tasks**.
4. List — filters, create task, complete/snooze as live.
5. Completing contact/attendance tasks may stamp job dates (only if verified — else Tip to also update Job Overview).
6. Best practices — assign owners; don’t leave insurer SLA tasks unowned.

`related_guides`: `schedule`, `appointments`, `job-lifecycle`, `dashboard`

---

## 2. Schedule

### Outline

1. Intro — calendar of appointments/tasks for the tenant (and job-scoped).
2. Accessing — Operations → **Schedule**. Dashboard **Today** panel links here.
3. Views (day/week/month — **walk live**).
4. Creating from the calendar vs from Appointments.
5. Best practices.

`related_guides`: `appointments`, `tasks`, `dashboard`

---

## 3. Appointments

**Sources:** `AppointmentsListClient.tsx`, `AppointmentFormDrawer` (also opened from job detail).

### Outline

1. Site attendance / meetings.
2. Accessing — Operations → **Appointments**.
3. Create — attendees, address (often job address), start/end.
4. Relation to assessment Attendance tab (keep in sync).
5. Best practices — book before attending; include customer + assessor.

`related_guides`: `schedule`, `completing-an-assessment`, `jobs-overview`

---

## 4. Communications

**Route `/messages`**, sidebar **Communications**.

### Outline

1. Intro — messages/notifications tied to jobs/claims.
2. Accessing — Operations → **Communications**.
3. List + detail drawer; send (`messaging.send`); mark read.
4. Unread tile on Dashboard.
5. vs email notifications admin (63j) — this page is the in-app inbox.
6. Best practices — keep insurer threads on the job, not personal email only.

`related_guides`: `dashboard`, `notifications`, `jobs-overview`

---

## 5. Contacts

### Outline

1. People/orgs (insured, brokers, vendors as contacts).
2. Accessing — Operations → **Contacts**.
3. List + detail; create/edit; how contacts appear on claim/job Parties tabs.
4. Best practices — one contact per person; use Parties on the job for job-specific roles.

`related_guides`: `claims-overview`, `jobs-overview`, `vendors-overview`

---

## 6. Documents — Overview

### Outline

1. Intro — company + project filesystems (doc 47).
2. Key Concepts — **Company** tree vs **Projects** (jobs); with a job selected you see **that job’s project filesystem only**.
3. Accessing — Operations → **Documents**. Contrast Admin **Filesystem Categories** (taxonomy) and **Filesystem Templates** (blueprints).
4. Tree navigation, categories, preview/download. `documents.read`.
5. Print/generate vs stored files (link `reports`).
6. Best practices — use the job project FS for claim workpapers.

`related_guides`: `uploading-documents`, `filesystem-categories`, `filesystem-templates`, `assessment-reports`

---

## 7. Uploading Documents

Rewrite CW attachments lore.

### Outline

1. Upload control on Documents page vs Job **Attachments** tab — both valid; job tab is fastest on a job.
2. Choosing category / document type (Assessment Report, Completion Certificate, etc.).
3. Insurer visibility if a visibility control exists (**verify**).
4. Drag-and-drop, size limits if shown.
5. Warning — with no job selected, uploads may land in **Company** filesystem; for job artefacts select the job first.
6. Best practices — type + name before upload (CW article’s good advice, kept).

`related_guides`: `documents-overview`, `assessment-reports`, `completing-a-builder-works-job`

---

## Index updates

TOC already lists these seven files.

---

## Ingest & smoke

| Route | Expect |
|-------|--------|
| `/tasks` | `tasks` |
| `/schedule` | `schedule` |
| `/messages` | `communications-overview` |
| `/appointments` | `appointments` |
| `/contacts` | `contacts-overview` |
| `/documents` | `documents-overview` |

Also **?** on `/documents?jobId={uuid}` — parent path `/documents` should still match.

---

## Acceptance

- [ ] Job filter explained on every list guide.
- [ ] Documents vs admin filesystem pages distinguished.
- [ ] Upload guide warns about Company vs project FS.
- [ ] Ingest + **?** on tasks, messages, documents.
