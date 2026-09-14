# eafa9ea3 — Unable to create new report (CRITICAL)

| Field | Value |
|-------|-------|
| ID | `eafa9ea3-f63b-4f01-9912-8ccf33c641ca` |
| Type / priority / status | bug / **critical** / open |
| Reporter | Mark Nas (`mark.nas@ensureconstructions.com.au`) |
| Created | 2026-09-09T00:23:38Z |
| Page | Jobs Detail `/jobs/9005d180-ac29-4fc6-9823-d09bf5516a63` |
| Pair with | `218b9416` (photo upload, same session ~5 min earlier) |

## User report

Unexpected error when trying to create a new report.

## Staging evidence (logs)

Around/after the report:

```text
2026-09-09 … ReportsService.create → ConnectionResolverService.getCredentials — connection not found: 3032bad6-…
2026-09-10 … same connection-not-found stack via CrunchworkService.request → ReportsService.create
2026-09-14T03:42:14Z  WARN ReportsService.create — Crunchwork Report API is not yet operational user=4e2b5262-… (Mark)
2026-09-14T04:50:11Z  WARN ReportsService.create — Crunchwork Report API is not yet operational user=eda70b61-… (Robert)
```

Interpretation:

- **Before stub:** create attempted CW call and failed (connection resolution / CW API).
- **After stub (current code):** always `NotImplementedException` (501) with clear message; UI shows unavailable dialog — capability still missing.

## Root cause

`ReportsService.create` hard-stubs CW Report API as not operational:

```ts
// apps/api/src/modules/reports/reports.service.ts
throw new NotImplementedException(
  'The Crunchwork Report API is not yet operational. Report creation is unavailable.',
);
```

Frontend `ReportFormDrawer` / `CrunchworkReportUnavailableDialog` explain this; “Add Report” CTAs still exist.

Secondary historical failure: `ConnectionResolverService.getCredentials` could not resolve CW connection for tenant (seen 2026-09-09/10).

## Key files

- `apps/api/src/modules/reports/reports.service.ts` — `create()`
- `apps/api/src/crunchwork/crunchwork.service.ts` — `createReport`
- `apps/frontend/src/components/forms/ReportFormDrawer.tsx`
- `apps/frontend/src/components/reports/CrunchworkReportUnavailableDialog.tsx`
- `apps/frontend/src/components/jobs/tabs/JobReportsTab.tsx`
- Design: `docs/implementation/16_REPORTS_MODULE.md`, `docs/design/03_REPORT_TYPE_SCHEMAS.md`

## Proposed solution

**Recommended (near-term):** Keep the CW stub, but make CTAs honest — replace “Add/Create Report” with “Report create unavailable” / open the existing dialog only; never surface a generic unexpected error. Close or park this feedback as a known CW limitation until the Insurance REST Reports API is operational for the tenant.

**Follow-on (when CW Reports API is ready):** Implement real create — DTO with `reportType.externalReference`, job/claim, customData; fix `ConnectionResolverService` credentials for the tenant; restore form type picker; require write permission; persist local report projection after CW create.

**Do not** silently re-enable CW create while credentials/API are broken.

## Acceptance criteria

- [ ] Product path chosen and documented in feedback note.
- [ ] If implemented: create from job Reports tab succeeds and local row appears.
- [ ] If deferred: no “unexpected error”; CTAs match reality.
- [ ] Failures never show generic unexpected error without message.

## Repro

1. Open job `9005d180-…` → Reports → Add Report.
2. Current: unavailable dialog / 501.
3. Logs: `ReportsService.create — Crunchwork Report API is not yet operational`.
