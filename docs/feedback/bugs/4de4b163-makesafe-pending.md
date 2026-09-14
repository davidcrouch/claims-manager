# 4de4b163 — Cannot create Make-Safe for PENDING job (HIGH)

| Field | Value |
|-------|-------|
| ID | `4de4b163-3f60-463a-b4f6-9ad311313464` |
| Type / priority / status | bug / **high** / open |
| Reporter | Ensure Account (`ensure@ensureconstructions.com.au`) |
| Created | 2026-09-08T02:02:15Z |
| Page | Jobs Detail (context job `9005d180-…`; mentioned JOB-200457) |

## User report

Cannot create a makesafe for job JOB-200457 because it is stuck in PENDING status.

## Root cause

**No status gate on PENDING** for Make-Safe. `canCreateMakeSafe` requires:

- `claimId` present
- CW-usable **Builder Make Safe** job-type lookup (not `seed-` / `direct-` / `internal-` only refs)
- Not already a Make-Safe job

Local creates default to status Pending; button hidden if claim missing or job type unusable. Users may conflate job status Pending with outbound `syncStatus: pending`.

## Key files

- `apps/frontend/src/components/jobs/JobDetail.tsx` — `canCreateMakeSafe`
- `apps/frontend/src/app/(app)/jobs/[id]/page.tsx` — makeSafeJobType resolution
- `apps/frontend/src/components/jobs/JobCreateMakeSafeDrawer.tsx`
- `apps/api/src/modules/jobs/jobs.service.ts`

## Proposed solution

**Recommended:** Clarify blockers; do not treat Pending as a hard stop.

1. When Create Make-Safe is unavailable, show an explicit disabled reason (no claim / no CW-usable Builder Make Safe job type / already Make-Safe) instead of a missing button.
2. Ensure staging has a crunchwork-linked **Builder Make Safe** job type with a usable external reference.
3. Allow Make-Safe creation when `claimId` exists even if parent job status is Pending; surface CW sync errors after create rather than hiding the action.

## Acceptance criteria

- [ ] Eligible PENDING job shows Create Make-Safe; clear blockers when not.
- [ ] Creates sibling Builder Make Safe under same claim/parent.
- [ ] Success toast + navigate; CW sync errors visible.

## Repro

Job `9005d180-…` / JOB-200457 → check Create Make-Safe visibility → claimId, jobType refs, syncStatus → attempt create.
