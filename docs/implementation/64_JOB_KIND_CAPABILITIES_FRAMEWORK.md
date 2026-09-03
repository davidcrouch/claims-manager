# 64 — Multi-Provider, Multi-Job-Kind Capabilities Framework

**Project:** Claims Manager  
**Date:** 2026-09-03  
**Status:** Phase 1 implemented (frontend registry + primary consumers); extension path defined  
**Depends on:** Hardcoded Providers (plan 30), Provider Adapter Architecture (plan 38), Jobs Module (plan 09), Quotes Module (plan 10)  
**Related:** Job type catalog migrations `0101_job_type_null_provider_crunchwork`, `0102_job_type_catalog_align`

---

## Objective

Replace ad-hoc `job.provider === 'crunchwork'` (and job-type name heuristics) with a **declarative capabilities registry** keyed by:

1. **Integration provider** — `direct` (Internal) vs `crunchwork` (and future providers)
2. **Job kind** — business classification within a provider (e.g. CW `make-safe` | `assessment` | `works`)

So that:

- Detail pages (job, estimate, invoice, work order, assessment) show/hide and edit fields from **config**, not scattered conditionals
- Create flows (job wizard, create estimate) inherit the same rules
- Adding a new provider or job kind is primarily a **registry entry** (+ outbound adapter / seeds), not a hunt through UI components

---

## Problem

### Two axes were conflated

| Axis | Storage / API | Meaning |
|------|---------------|---------|
| **Provider** | `jobs.connection_id` → `integration_connections.provider_code`, exposed as `job.provider` (`crunchwork` \| `internal`) | Which system owns/syncs the job |
| **Job kind / type** | `jobs.job_type_lookup_id` → `lookup_values` (`domain = job_type`, `provider_code` scopes catalog) | Business classification (Builder Make Safe, General, …) |

Before this plan, UI behavior branched on raw strings in many places:

- `job.provider === 'crunchwork'` in JobDetail, JobOverviewTab, QuoteDetail, InvoiceDetail, JobFormDrawer, etc.
- `getJobTypeKind()` name heuristics for Type Details panels (orthogonal, name-based)
- Hardcoded `WORKFLOW_CAP_MAP` in `JobsService` keyed by exact job type display names
- Local publish-mode enums (`internal` \| `external`) re-derived per entity

### Same provider, different kinds

Crunchwork alone has multiple job kinds with different create rules and (over time) different field sets:

| Kind | External refs | User may create? | Typical origin |
|------|---------------|------------------|----------------|
| Builder Make Safe | `MS` | Yes | EnsureOS create → publish to CW |
| Builder Assessment | `BA` | No | CW sync / webhook |
| Builder Works | `BW` | No | CW sync / webhook |

Internal (`direct`) job types are a separate catalog: General, Repair, Remodel, New Construction.

A framework must filter **by provider and by job kind**, not provider alone.

---

## Design principles

1. **Defaults = Internal.** Baseline field rules hide CW-specific concerns. Provider/kind entries only override what differs.
2. **Field-rule maps per entity**, not one-off booleans. Each entity has a typed union of field keys → `{ visible, editable, required?, label? }`.
3. **Compose provider + kind.** Resolve exact `(providerCode, jobTypeKind)` first; fall back to provider default; then Internal baseline.
4. **Frontend-first resolution (Phase 1).** API already sends `provider` + `jobType.{name, externalReference}`. Registry is a pure TS module; React hook memoizes. Backend keeps a thin parallel for workflow caps until a shared package exists.
5. **CW may push new job types.** Lookup auto-create / sync may add extra `crunchwork` job_type rows. Registry matching uses patterns; unknown CW types fall back to a CW provider default entry — they are not blocked at the DB layer.
6. **Create UI ≠ sync catalog.** Users create Internal types and CW Make Safe only; BA/BW remain syncable.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  job.provider + job.jobType.{name, externalReference}            │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  resolveJobKindCaps()  — apps/frontend/src/lib/job-kind-registry │
│    1. map provider: internal → direct                            │
│    2. map job type name/ref → jobTypeKind (make-safe, …)         │
│    3. exact REGISTRY match → provider default → INTERNAL_BASE    │
└────────────────────────────┬─────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        useJobCaps(job)   create flows   QuoteFormDrawer
        (detail pages)    (parts API)    (jobProvider prop)
              │
    ┌─────────┴─────────┐
    ▼                   ▼
 JobOverviewTab    QuoteOverviewTab
 caps.job.*        caps.estimate.*
```

Backend (workflow only today):

```
job type lookup name
        │
        ▼
resolveWorkflowCapability()  — apps/api/src/common/job-kind-caps.ts
        │
        ▼
OutboundEventsService / JobsService.startWorkflowForJob
```

---

## Data model (catalog alignment)

### Lookup catalogs (`lookup_values`, domain `job_type`)

| `provider_code` | Active names | Notes |
|-----------------|--------------|-------|
| `direct` | General, Repair, Remodel, New Construction | Internal create dropdown |
| `crunchwork` | Builder Assessment, Builder Make Safe, Builder Works | BA/MS/BW; CW may add more via sync |

Migrations:

- **`0101_job_type_null_provider_crunchwork`** — null provider on job_type → `crunchwork` (stop leaking into Internal lists)
- **`0102_job_type_catalog_align`** — deactivate obsolete Internal types; ensure four Internal + three CW core types; leave room for future CW auto-created types

Seeds: [`lookups.seed.ts`](../../apps/api/src/database/seeds/entries/lookups.seed.ts) mirrors the same catalogs.

### Job API shape (unchanged)

[`JobsService.shapeJobResponse`](../../apps/api/src/modules/jobs/jobs.service.ts) continues to expose:

- `provider` — connection provider or `'internal'`
- `jobType` — `{ id, name?, externalReference? }` (no nested lookup `providerCode` yet)

Capabilities are **not** serialized on the job payload in Phase 1 (Option A). Optional later enrichment is Phase 4.

---

## Core types and registry

### Primary file

[`apps/frontend/src/lib/job-kind-registry.ts`](../../apps/frontend/src/lib/job-kind-registry.ts)

### `FieldRule`

```ts
interface FieldRule {
  visible: boolean;
  editable: boolean;
  required?: boolean;
  label?: string; // provider-specific label override
}
```

Helpers: `SHOW`, `HIDE`, `EDIT`, `withOverrides(defaults, overrides)`.

### Per-entity field unions (extensible)

| Entity key on caps | Field union examples |
|--------------------|----------------------|
| `job` | `statusEditable`, `vendorExtRefEditable`, `instructionsEditable`, `excess`, `collectExcess`, `makeSafeRequired`, `parentClaim`, `providerBadge`, `createMakeSafe`, … |
| `estimate` | `publishButton`, `approveButton`, `catalogPicker`, `reference`, `insurerRef` |
| `invoice` | `publishButton` |
| `workOrder` / `assessment` | `providerBadge` (placeholder for growth) |

Also on `JobKindCapabilities` (not field rules):

- `publishTarget`, `catalogScope`, `publishMode`
- `workflowCapability`
- `estimateQuoteTypes` — Internal: `Quote` \| `Variation`; CW: full CW list
- `create: { userCanCreate, requiresClaim, autoMakeSafe }`

### Registry entries (Phase 1)

| providerCode | jobTypeKind | Notes |
|--------------|-------------|-------|
| `direct` | `general` | Internal baseline; covers all four Internal job types |
| `crunchwork` | `make-safe` | User-creatable; claim required; auto make-safe |
| `crunchwork` | `assessment` | CW-created; `create.userCanCreate = false` |
| `crunchwork` | `works` | CW-created; `create.userCanCreate = false` |

Kind matching patterns (name / external ref haystack):

- `/\bmake\s*safe\b/i` → `make-safe`
- `/\bassessment\b/i` → `assessment`
- `/\bworks\b/i` → `works`
- else → `general`

Provider mapping: missing / `'internal'` → `'direct'`.

### Public API

- `resolveJobKindCaps(job)` — detail pages
- `resolveJobKindCapsFromParts({ providerCode, jobTypeName?, jobTypeExtRef? })` — create flows
- `listJobKindEntries()` — introspection
- `INTERNAL_ESTIMATE_QUOTE_TYPES` / `CW_ESTIMATE_QUOTE_TYPES`

### React hook

[`apps/frontend/src/hooks/useJobCaps.ts`](../../apps/frontend/src/hooks/useJobCaps.ts)

```ts
useJobCaps(job) // memo on provider + jobType.name + jobType.externalReference
```

### Backend mirror

[`apps/api/src/common/job-kind-caps.ts`](../../apps/api/src/common/job-kind-caps.ts) — `resolveWorkflowCapability(jobTypeName)` replaces `JobsService.WORKFLOW_CAP_MAP`.

---

## Implementation steps (sequential)

### Step 1 — Job type catalog data (prerequisite)

**Status:** Done

1. Migration 0101: null `job_type.provider_code` → `crunchwork`
2. Migration 0102: align active Internal (4) and CW (BA/MS/BW) catalogs; deactivate obsolete seed types
3. Update `lookups.seed.ts` LOOKUP_SPECS accordingly
4. Journal `_journal.json` entries for 0101 / 0102
5. Verify per-tenant: 4 active direct + 3 active crunchwork core types

### Step 2 — Registry + hook

**Status:** Done

1. Create `job-kind-registry.ts` with FieldRule model, defaults, overrides, REGISTRY
2. Create `useJobCaps`
3. Export estimate quote-type lists; re-export from `quote-edit.types.ts` for compatibility

### Step 3 — Job detail consumers

**Status:** Done

1. `JobDetail.tsx` — replace `isCrunchwork` with `caps.job.*` (type-details edit, save/undo paths, edit actions)
2. `JobOverviewTab.tsx` — accept `caps`; gate editable status / vendor ext ref / instructions; provider badge; CW updated; **excess / collect excess / make-safe required / parent claim** visibility

### Step 4 — Estimate / invoice consumers

**Status:** Done (primary paths)

1. `QuoteDetail.tsx` — `useJobCaps`; publish mode + approve from caps; pass caps to overview
2. `QuoteOverviewTab.tsx` — `reference`, `insurerRef`, estimate quote types from caps
3. `EstimatePublishWizard.tsx` — gate Reference summary row
4. `InvoiceDetail` / `InvoicePageHeader` — publish mode from caps
5. `quotes/[id]/page.tsx` — server-side `resolveJobKindCaps` for `catalogScope` → `jobProvider`

### Step 5 — Create flows

**Status:** Done (primary paths)

1. `JobFormDrawer.tsx` — `resolveJobKindCapsFromParts` for `requiresClaim`, `autoMakeSafe`, publish target, wizard steps / validation
2. `QuoteFormDrawer.tsx` — `jobProvider` prop; show Reference only when `caps.estimate.reference.visible`; Internal quote types Quote \| Variation only
3. `CaptureEstimateDrawer.tsx` — same Reference gating via `jobProvider`
4. Wire `jobProvider={job.provider}` from JobDetail / QuotesPageClient / ProposalsListClient

### Step 6 — Backend workflow map

**Status:** Done

1. Add `common/job-kind-caps.ts`
2. Replace `WORKFLOW_CAP_MAP` lookup in `JobsService.startWorkflowForJob` with `resolveWorkflowCapability`

### Step 7 — Catalogue empty-estimate UX (adjacent)

**Status:** Done

When opening catalogue from estimate line items with **zero line items**, default tab = **Groups** (`CatalogPickerDrawer.defaultTab`).

### Step 8 — Remaining ad-hoc cleanup

**Status:** Mostly done on detail/create paths; residual OK where intentional

- No remaining `job.provider === 'crunchwork'` in frontend components/app for capability branching
- Create-form still passes provider into `resolveJobKindCapsFromParts` (required input, not a behavior branch)
- List filters / lookup fetches by `providerCode` remain correct (data scoping, not UI capabilities)

### Step 9 — Extend entity field maps (ongoing)

As product identifies more kind-specific fields:

1. Add key to the entity field union
2. Default in `DEFAULT_*` (usually `HIDE` for CW-only on Internal baseline)
3. Override in CW (or kind-specific) entries
4. Gate JSX with `caps.<entity>.<field>.visible` / `.editable`

Do **not** reintroduce provider string compares in components.

### Step 10 — New provider playbook (future)

To add e.g. `restoremax`:

1. Register in [`provider-registry.ts`](../../apps/api/src/modules/providers/provider-registry.ts)
2. Implement `OutboundAdapter` and register in outbound module (plan 38)
3. Seed / migrate `lookup_values` job types with `provider_code = 'restoremax'`
4. Add one or more `REGISTRY` entries in `job-kind-registry.ts` (provider + kinds)
5. Add kind patterns to `JOB_TYPE_KIND_MAP` and backend `WORKFLOW_CAP_ENTRIES` if needed
6. Add Create Job card / wizard option if users may create that kind
7. **No** changes to JobOverviewTab / QuoteDetail conditionals if they already read `caps`

### Step 11 — Optional shared package / API enrichment (future)

**Status:** Not started

If frontend and API diverge:

- Move registry to a shared package both apps import, **or**
- Enrich `GET /jobs/:id` with `capabilities` snapshot (Option B) for tenants that customize rules later

Prefer shared package before serializing UI field maps on the API.

---

## Field visibility matrix (Phase 1 — current)

### Job overview / detail

| Field | Internal | CW (all kinds) |
|-------|----------|----------------|
| Excess / Collect excess / Make-safe required | Hidden | Visible |
| Parent claim (row + section) | Hidden | Visible |
| Status / vendor ext ref / instructions editable | No | Yes |
| Provider badge / CW updated | Hidden / N | Visible |
| Create Make-Safe action | Hidden | Visible on make-safe-capable entries (`createMakeSafe`) |

### Estimate

| Field / behavior | Internal | CW |
|------------------|----------|----|
| Reference | Hidden | Visible + editable |
| Insurer Ref | Hidden | Visible |
| Local “Received Approval” | Allowed (`approveButton`) | Hidden |
| Publish mode | `internal` | `external` |
| Create/edit quote types | Quote, Variation | Full CW list |

### Create Job

| Rule | Internal | CW Make Safe |
|------|----------|--------------|
| Claim step | No | Yes (`requiresClaim`) |
| `makeSafeRequired` on submit | No | Yes (`autoMakeSafe`) |
| Job type UI | Internal dropdown (4 types) | Forced Builder Make Safe |
| User can create BA / BW | N/A | No (`userCanCreate: false`) |

---

## Consumption patterns (copy/paste)

### Detail page

```tsx
const caps = useJobCaps(job);

{caps.job.parentClaim.visible && (
  <DefRow label="Parent claim" value={...} />
)}

{caps.job.statusEditable.editable && editing ? (
  <EditLookupSelect ... />
) : (
  <StatusBadge ... />
)}
```

### Create estimate (server/parent knows job provider)

```tsx
<QuoteFormDrawer jobId={job.id} jobProvider={job.provider} />
```

Inside drawer:

```tsx
const caps = resolveJobKindCaps({ provider: jobProvider });
const quoteTypes = caps.estimateQuoteTypes;
const showReference = caps.estimate.reference.visible;
```

### Adding a field

1. Extend `JobField` / `EstimateField` / …
2. Set default in `DEFAULT_JOB` / `DEFAULT_ESTIMATE`
3. Override in `CW_BASE_*` or a kind-specific entry
4. Gate UI with `caps.*`

---

## Key files

| Path | Role |
|------|------|
| `apps/frontend/src/lib/job-kind-registry.ts` | Registry, types, resolve |
| `apps/frontend/src/hooks/useJobCaps.ts` | React memo wrapper |
| `apps/api/src/common/job-kind-caps.ts` | Backend workflow capability resolve |
| `apps/frontend/src/components/jobs/JobDetail.tsx` | Job caps consumer |
| `apps/frontend/src/components/jobs/tabs/JobOverviewTab.tsx` | Job field gating |
| `apps/frontend/src/components/quotes/QuoteDetail.tsx` | Estimate publish/approve |
| `apps/frontend/src/components/quotes/QuoteOverviewTab.tsx` | Estimate field gating |
| `apps/frontend/src/components/forms/JobFormDrawer.tsx` | Create job rules |
| `apps/frontend/src/components/forms/QuoteFormDrawer.tsx` | Create estimate rules |
| `apps/api/src/modules/jobs/jobs.service.ts` | Workflow capability consumer |
| `apps/api/src/database/migrations-drizzle/0101_*.sql` | Provider backfill |
| `apps/api/src/database/migrations-drizzle/0102_*.sql` | Catalog align |
| `apps/api/src/database/seeds/entries/lookups.seed.ts` | Seed catalogs |
| `apps/api/src/modules/providers/provider-registry.ts` | Integration provider codes (plan 30) |

---

## Testing checklist

- [ ] Internal job detail: no Excess / Collect excess / Make-safe required / Parent claim
- [ ] CW Make Safe job detail: those fields visible; status/vendor/instructions editable
- [ ] Create Job Internal: four job types; no claim step
- [ ] Create Job Builder Make-Safe: claim required; type forced; publishes with make-safe
- [ ] Create Estimate on Internal job: types Quote \| Variation only; no Reference
- [ ] Create Estimate on CW job: full CW types; Reference shown
- [ ] Estimate detail Internal: no Insurer Ref / Reference
- [ ] Estimate detail CW: Insurer Ref + Reference; no local Approve when pending
- [ ] Empty estimate → Catalogue opens on Groups tab
- [ ] CW sync can still create BA/BW jobs and additional job_type lookups without UI create options

---

## Out of scope (this plan)

- Replacing outbound adapter registration (still plan 38)
- Tenant-configurable capability matrices in DB
- Unifying `JobTypeKind` Type Details panels (`temporary-accommodation`, etc.) into the same registry (can be a follow-up entry under `job.typeDetailsTab` / panel enum)
- Moving registry into a monorepo shared package (Step 11)

---

## Success criteria

1. **Zero** capability decisions in UI via `job.provider === 'crunchwork'` on detail/create paths
2. Same provider can expose **different** fields/rules per job kind via separate registry rows
3. New provider/kind = registry (+ adapter/seeds), not edits across all detail components
4. Internal and CW job type catalogs stay correctly scoped in `lookup_values`
5. Documented playbook for extension exists (this plan, Step 10)
