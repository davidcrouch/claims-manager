# 7c2389b5 — User Nellie cannot create jobs

| Field | Value |
|-------|-------|
| ID | `7c2389b5-1bb5-49f0-b03b-683b187f6c76` |
| Type / priority / status | bug / medium / open |
| Reporter | Nellie Privitera (`accounts@ensureconstructions.com.au`) |
| Created | 2026-09-09T00:59:35Z |
| Page | `/jobs` |

## User report

Nellie doesn’t have permission to create jobs. Please review.

## Root cause (likely config)

`jobs.create` seeded on `admin` + `manager` only (`seed-rbac.ts`). Roles like `estimator`, `senior_estimator`, `member`, `viewer` lack it. UI may still show Create Job → API 403 (`@RequirePermission(P.jobs.create)`).

## Key files

- `apps/auth-server/src/scripts/seed-rbac.ts`
- `apps/api/src/modules/jobs/jobs.controller.ts`
- `apps/frontend/src/components/jobs/JobsPageClient.tsx`
- Admin Users / Roles UI for Nellie’s assigned role

## Proposed solution

**Recommended:** Treat as RBAC policy + UX, not a code bug in create itself.

1. Confirm Nellie’s staging role (likely accounts / member without `jobs.create`).
2. If accounts staff should create jobs: grant `jobs.create` to her role (or user override) via Admin Roles / seed update.
3. Always gate the Create Job CTA on `jobs.create` client-side so denied users never hit a silent 403.

## Acceptance criteria

- [ ] Nellie creates a job **or** button hidden with clear “no permission” message per policy.
- [ ] No silent 403 after clicking Create.

## Repro

Sign in as `accounts@ensureconstructions.com.au` → Jobs → Create Job.
