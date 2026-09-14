# 63dde5eb — New insured contact with postal address not on job

| Field | Value |
|-------|-------|
| ID | `63dde5eb-34fb-4804-97cf-7c9f8bbccabb` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-14T00:49:39Z |
| Page | Contacts List `/contacts` · job `7be5773d-5048-4bc7-bc04-15b6e77edfe4` |

## User report

Created contact (insured, name, postal address) from job-scoped contacts. Expected contact on job list; none appeared.

## Root cause

Create from Contacts List **never links** the contact to the filtered job:

- `ContactsListClient` opens `ContactFormDrawer` with no `jobId`.
- `createContactAction` / `ContactsService.create` have no job link.
- List is filtered by `job_contacts` — unlinked contact invisible.
- Secondary: `firstName` required; address search without picking a suggestion can leave address empty.

## Key files

- `apps/frontend/src/components/contacts/ContactsListClient.tsx`
- `apps/frontend/src/components/contacts/ContactFormDrawer.tsx`
- `apps/frontend/src/app/(app)/mutations.ts` — `createContactAction`
- `apps/api/src/modules/contacts/contacts.service.ts` — `create`
- `apps/frontend/src/app/(app)/jobs/mutations.ts` — `addJobContactsAction`
- `apps/api/src/modules/jobs/jobs.service.ts` — `addContacts`

## Proposed solution

**Recommended:** Always link contacts created from a job-scoped list back to that job.

1. Pass `jobId` into `ContactFormDrawer` when the list is job-filtered.
2. After create, call `addJobContactsAction` (or create+link in one API).
3. Surface validation errors clearly; toast “added to job”.
4. Optionally relax name rules for insured display-name-only creates if product wants address-first flows.

## Acceptance criteria

- [ ] Create from job-scoped Contacts list appears on that job’s parties/contacts.
- [ ] Clear error if validation fails.
- [ ] Address from search or manual fields saved on contact.

## Repro

`/contacts?jobId=7be5773d-…` → Create → Insured + name + postal → Create → missing from job-filtered list (may exist globally unlinked).
