# 9209ea7b — Job list Back returns to page 1

| Field | Value |
|-------|-------|
| ID | `9209ea7b-4884-4638-87fd-9508ad1efd33` |
| Type / priority / status | bug / medium / open |
| Reporter | Robert Evenden |
| Created | 2026-09-08T22:05:17Z |
| Page | `/jobs` |

## User report

From paginated job list (e.g. page 7), open a job, then Back → lands on page 1 instead of page 7.

## Root cause

`JobHeader` `BackButton href="/jobs"` → `router.push('/jobs')` drops `?page=`. List sync often uses `router.replace`, so pagination isn’t always in browser history either.

## Key files

- `apps/frontend/src/components/shared/BackButton.tsx`
- `apps/frontend/src/components/jobs/JobHeader.tsx`
- `apps/frontend/src/components/jobs/JobsListClient.tsx`
- `apps/frontend/src/hooks/use-list-page-data.ts` (or equivalent list pagination hook)

## Proposed solution

**Recommended:** Stop hard-linking Back to `/jobs` without query.

Use `router.back()` when history is same-origin list navigation; otherwise fall back to the last list URL stored in `sessionStorage` / `?from=` / referrer query (including `page` and filters). Apply the same pattern to Claims and other detail → list backs.

## Acceptance criteria

- [ ] From page N detail, Back returns to page N with filters intact.

## Repro

`/jobs?page=7` → open job → header Back → page 1.
