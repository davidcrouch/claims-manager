# 58 — Estimate Publish Feedback, Activity Feed & Audit Logging

**Status:** In Progress (Phases 1–5 implemented)  
**Date:** 2026-08-21  
**Depends on:** `10_QUOTES_MODULE.md`, `51_WEBHOOK_PROJECTION_UNIFICATION.md`, `53e_QUOTE_PUBLISH_CONTEXT.md`, `35_DOMAIN_LAYER_ARCHITECTURE.md`  
**Related:** `32_UI_JOB_DETAIL_REVAMP.md`, `27_WEBHOOK_PIPELINE_V2_OVERVIEW.md`

---

## Problem Statement

When a user publishes an estimate to an insurer (Crunchwork/NRMA), the system provides no meaningful feedback on:

1. **Immediate publish result** — only a toast ("Estimate sent to NRMA") with no confirmation of what was sent, counts, or errors returned by the provider.
2. **Async insurer decisions** — insurer may accept/reject individual line items (`lineScopeStatus` per combo/item). This data syncs inbound via webhooks but is never surfaced to the user.
3. **Action history** — there is no unified activity/audit trail recording who published, when the insurer responded, what changed, or status transitions over time.

The Activities tab on estimates is a placeholder ("once the activities API is connected"). The Timeline tab only shows `createdAt`/`updatedAt` timestamps.

---

## Goals

- G1: Show rich immediate feedback after publish (sent/errors, item counts, provider confirmation)
- G2: Surface insurer line-item accept/reject decisions in the Take Off table
- G3: Implement a general-purpose `entity_activities` table for action auditing
- G4: Populate the Activities tab with real data (publish, status changes, insurer responses)
- G5: Emit meaningful notifications when insurer decisions arrive asynchronously
- G6: Provide a unified activity/audit API usable across all entities (quotes, jobs, POs, etc.)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Frontend                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │PublishWizard │  │TakeOffTable  │  │ActivitiesTab     │   │
│  │  + result    │  │ + line scope │  │ + activity feed  │   │
│  │    panel     │  │   badges     │  │   timeline       │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────┐
│  API                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │QuotesService │  │LineItemSync  │  │ActivitiesService │   │
│  │  .publish()  │  │ .sync +      │  │ .log() / .list() │   │
│  │  → result DTO│  │  emit act.   │  │                  │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
│        │                    │                    ▲            │
│        ▼                    ▼                    │            │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │          entity_activities (new table)                   │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Activity Audit Table & Service (Schema + Backend)

### 1.1 Migration: `entity_activities` table

**File:** `apps/api/src/database/migrations-drizzle/0069_entity_activities.sql`

```sql
CREATE TABLE "entity_activities" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"       uuid NOT NULL REFERENCES "organizations"("id")
                    ON DELETE RESTRICT ON UPDATE CASCADE,
  "entity_type"     text NOT NULL,            -- 'quote', 'job', 'work_order', etc.
  "entity_id"       uuid NOT NULL,
  "action"          text NOT NULL,            -- 'published', 'status_changed', 'line_scope_updated', etc.
  "actor_type"      text NOT NULL DEFAULT 'user',  -- 'user' | 'system' | 'provider'
  "actor_id"        text,                     -- userId, 'system', providerCode
  "actor_name"      text,                     -- display name for the feed
  "summary"         text NOT NULL,            -- human-readable: "Published estimate to NRMA"
  "detail"          jsonb NOT NULL DEFAULT '{}', -- structured payload (before/after, counts, etc.)
  "related_entity_type" text,                 -- optional linked entity
  "related_entity_id"   uuid,
  "source"          text DEFAULT 'internal',  -- 'internal' | 'provider' | 'workflow'
  "source_event_id" uuid,                     -- FK to inbound_webhook_events if from provider
  "created_at"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_entity_activities_tenant_entity"
  ON "entity_activities" ("tenant_id", "entity_type", "entity_id", "created_at" DESC);
CREATE INDEX "idx_entity_activities_entity_action"
  ON "entity_activities" ("entity_id", "action");
CREATE INDEX "idx_entity_activities_actor"
  ON "entity_activities" ("tenant_id", "actor_type", "actor_id");
```

### 1.2 Drizzle schema definition

**File:** `apps/api/src/database/schema/index.ts`

Add `entityActivities` table definition following existing patterns.

### 1.3 Repository: `entity-activities.repository.ts`

**File:** `apps/api/src/database/repositories/entity-activities.repository.ts`

Methods:
- `create(data)` — insert a single activity
- `createMany(data[])` — bulk insert (for line scope batch)
- `findByEntity({ tenantId, entityType, entityId, page, limit })` — paginated feed
- `findByRelatedEntity(...)` — fetch activities where `related_entity_id` matches (e.g. job-level view of all quote activities)

### 1.4 Service: `ActivitiesService`

**File:** `apps/api/src/modules/activities/activities.service.ts`

```typescript
@Injectable()
export class ActivitiesService {
  async log(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    action: string;
    actorType: 'user' | 'system' | 'provider';
    actorId?: string;
    actorName?: string;
    summary: string;
    detail?: Record<string, unknown>;
    relatedEntityType?: string;
    relatedEntityId?: string;
    source?: string;
    sourceEventId?: string;
  }): Promise<void>;

  async list(params: {
    tenantId: string;
    entityType: string;
    entityId: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Activity[]; total: number }>;
}
```

### 1.5 Controller endpoint

**File:** `apps/api/src/modules/activities/activities.controller.ts`

```
GET /activities?entityType=quote&entityId=:id&page=1&limit=50
```

Returns paginated activity feed for any entity.

### 1.6 Module registration

**File:** `apps/api/src/modules/activities/activities.module.ts`

Export `ActivitiesService` so other modules can inject it.

---

## Phase 2 — Publish Result Feedback (Backend)

### 2.1 Enrich publish response DTO

**File:** `apps/api/src/modules/quotes/quotes.service.ts` — `publish()` method

Currently returns the updated quote row. Enhance to return a `PublishResult` envelope:

```typescript
interface PublishResult {
  quote: QuoteResponse;
  publishMode: 'internal' | 'external';
  provider?: {
    confirmed: boolean;
    providerReference?: string;  // CW quote ID
    sentGroups: number;
    sentItems: number;
    sentCombos: number;
    warnings?: string[];
  };
}
```

For **external** publish:
- After `crunchworkService.createQuote` / `updateQuote`, capture the response.
- Count groups/combos/items actually sent.
- Return any warnings or validation messages from the provider.

For **internal** publish:
- Return `publishMode: 'internal'`, confirm status change.

### 2.2 Log publish activity

After successful publish, call `ActivitiesService.log`:

```typescript
await this.activitiesService.log({
  tenantId,
  entityType: 'quote',
  entityId: params.id,
  action: 'published',
  actorType: 'user',
  actorId: params.userId,
  summary: isExternal
    ? `Published estimate to ${providerName} (${sentItems} items in ${sentGroups} groups)`
    : 'Published estimate internally',
  detail: {
    publishMode: isExternal ? 'external' : 'internal',
    providerReference: externalRef,
    sentGroups, sentCombos, sentItems,
    previousStatus: existingStatusName,
    newStatus: 'Pending',
  },
});
```

### 2.3 Log publish failure

If the Crunchwork API call throws, log a `publish_failed` activity before re-throwing:

```typescript
await this.activitiesService.log({
  tenantId,
  entityType: 'quote',
  entityId: params.id,
  action: 'publish_failed',
  actorType: 'user',
  actorId: params.userId,
  summary: `Publish to ${providerName} failed: ${error.message}`,
  detail: { error: error.message, stack: error.stack },
});
```

---

## Phase 3 — Insurer Response: Line Scope Status Surfacing

### 3.1 Audit on inbound status changes

**File:** `apps/api/src/modules/domain/use-cases/project-quote.use-case.ts`

After the quote is upserted and line items synced:
1. Compare old vs new `statusLookupId` — if changed, log `status_changed` activity with `actorType: 'provider'`.
2. Pass delta info to line-item sync (see 3.2).

### 3.2 Audit on line scope status changes

**File:** `apps/api/src/modules/domain/services/line-item-sync.service.ts`

When `syncQuoteItems` resolves `lineScopeStatusLookupId` for a combo or item, compare to existing value. For each change:

```typescript
changedLineScopes.push({
  lineType: 'item' | 'combo',
  lineId,
  lineName,
  previousStatus: oldStatusName,
  newStatus: newStatusName,
});
```

After sync completes, emit a single batch activity:

```typescript
await this.activitiesService.log({
  tenantId,
  entityType: 'quote',
  entityId: quoteId,
  action: 'line_scope_updated',
  actorType: 'provider',
  actorName: providerName,
  summary: `Insurer updated ${changedCount} line item(s): ${acceptedCount} accepted, ${rejectedCount} rejected`,
  detail: { changes: changedLineScopes },
  source: 'provider',
  sourceEventId: webhookEventId,
});
```

### 3.3 Seed `line_scope_status` lookup values

**File:** `apps/api/src/database/seeds/lookups.seed.ts`

Add canonical values for the `line_scope_status` domain:
- `Pending` (default — not yet reviewed)
- `Accepted`
- `Rejected`
- `Amended`
- `Referred` (needs further review)

### 3.4 Surface `lineScopeStatus` in Take Off table

**File:** `apps/frontend/src/components/quotes/QuoteLineItemsTab.tsx` (or equivalent Take Off component)

For each combo and item row:
- If `lineScopeStatus` is present and not `Pending`, render a badge:
  - Accepted → green badge
  - Rejected → red badge with strikethrough styling
  - Amended → orange badge
  - Referred → yellow badge
- Add a column header "Status" or render inline after the item description.
- Add a filter: "Show rejected only" / "Show all".

### 3.5 Estimate overview summary card

**File:** `apps/frontend/src/components/quotes/QuoteOverviewTab.tsx`

Add a "Review Status" card when the estimate has been published and any line scope statuses exist:

```
┌─────────────────────────────────────────┐
│ Insurer Review                          │
│  Total items: 42                        │
│  ✓ Accepted: 38    ✗ Rejected: 3       │
│  ◔ Amended: 1      ◷ Pending: 0        │
│                                         │
│  Last updated: 19 Aug 2026 2:34 PM     │
└─────────────────────────────────────────┘
```

---

## Phase 4 — Publish Wizard UX Enhancement (Frontend)

### 4.1 Show publish result panel in wizard

**File:** `apps/frontend/src/components/quotes/EstimatePublishWizard.tsx`

After the publish API call succeeds, instead of just a toast, show a result step/panel:

**Internal publish:**
```
✓ Estimate published
  Status: Pending
  PDF generated: Yes
```

**External publish:**
```
✓ Estimate sent to NRMA
  Provider reference: CW-12345
  Groups sent: 3
  Items sent: 42
  Status: Pending (awaiting insurer review)
```

**External publish with warnings:**
```
⚠ Estimate sent with warnings
  Provider reference: CW-12345
  Items sent: 40 of 42
  Warnings:
    • 2 items had no provider code — excluded from submission
```

### 4.2 Show error detail on failure

If publish fails (API returns 4xx/5xx), display the error in the wizard instead of just a toast:

```
✗ Publish failed
  Error: Job has no external reference — sync the job to Crunchwork first.
  [Retry] [Close]
```

---

## Phase 5 — Activities Tab (Frontend)

### 5.1 Replace placeholder with real feed

**File:** `apps/frontend/src/components/quotes/QuoteDetail.tsx` — `ActivitiesTab`

Replace the placeholder with a real component:

```typescript
function ActivitiesTab({ quoteId }: { quoteId: string }) {
  const { data, isLoading } = useActivities({
    entityType: 'quote',
    entityId: quoteId,
  });

  return <ActivityFeed activities={data} loading={isLoading} />;
}
```

### 5.2 `ActivityFeed` component

**File:** `apps/frontend/src/components/shared/ActivityFeed.tsx`

Shared component rendering a chronological list of activities:
- Each entry: icon (based on `action`), actor name/badge, summary text, relative time
- Expandable detail for entries with `detail` payload
- Grouped by day
- Color-coded by `actorType` (user = blue, provider = purple, system = grey)

Action icon mapping:
| Action | Icon | Color |
|--------|------|-------|
| `published` | Send | blue |
| `publish_failed` | AlertCircle | red |
| `status_changed` | RefreshCw | amber |
| `line_scope_updated` | CheckCircle2 / XCircle | green/red |
| `approved` | ThumbsUp | green |
| `comment` | MessageSquare | grey |

### 5.3 API client hook

**File:** `apps/frontend/src/lib/api-client.ts`

```typescript
getActivities(params: { entityType: string; entityId: string; page?: number; limit?: number })
  → GET /activities?entityType=...&entityId=...
```

**File:** `apps/frontend/src/hooks/useActivities.ts`

SWR/react-query hook wrapping the API call.

---

## Phase 6 — Notifications & Real-time Updates

### 6.1 Emit notification on insurer decision

When `ProjectQuoteUseCase` processes an inbound `UPDATE_QUOTE` that changes status or line scopes:

- If status changes to **Approved**: notify assigned user "Estimate approved by insurer"
- If status changes to **Rejected/Resubmission Required**: notify "Estimate requires resubmission"
- If line scopes change with rejections: notify "Insurer rejected N line items on estimate #X"

Integration point: `OutboundEventsService.emitQuoteStatusChanged` (already exists) — extend to also trigger user notifications.

### 6.2 Real-time refresh

When the Activities tab is open and a webhook updates the estimate, the frontend should reflect it. Options:
- **Polling** (simple): refetch activities every 30s when tab is active
- **SSE/WebSocket** (future): push activity events to connected clients

Initial implementation: polling with `refreshInterval: 30_000` on the SWR hook.

---

## Phase 7 — Extend to Other Entities

### 7.1 Wire activity logging across the system

The `ActivitiesService` is generic. Progressively wire it into:

| Entity | Actions to log |
|--------|---------------|
| Job | created, status_changed, assigned, provider_sync |
| Work Order | created, issued, completed, status_changed |
| Invoice | created, submitted, paid, rejected |
| Purchase Order | created, issued, acknowledged |
| Proposal | received, accepted, rejected |
| Bill | received, approved, paid |

### 7.2 Reuse `ActivityFeed` in all detail views

Replace placeholder Activities tabs in `ProposalDetail`, `BillDetail`, job detail, etc. with the same `ActivityFeed` component parameterised by `entityType` and `entityId`.

---

## Data Model Reference

### `entity_activities` table columns

| Column | Type | Purpose |
|--------|------|---------|
| `id` | uuid PK | |
| `tenant_id` | uuid FK | Multi-tenant isolation |
| `entity_type` | text | Polymorphic: quote, job, work_order, etc. |
| `entity_id` | uuid | The entity this activity belongs to |
| `action` | text | Machine-readable action key |
| `actor_type` | text | user / system / provider |
| `actor_id` | text | User UUID or provider code |
| `actor_name` | text | Human-readable actor name |
| `summary` | text | One-line description for the feed |
| `detail` | jsonb | Structured before/after, counts, error info |
| `related_entity_type` | text | Optional cross-reference |
| `related_entity_id` | uuid | Optional cross-reference |
| `source` | text | internal / provider / workflow |
| `source_event_id` | uuid | Links to `inbound_webhook_events.id` |
| `created_at` | timestamptz | Activity timestamp |

### Predefined actions (extensible)

| Action | Entity | Trigger |
|--------|--------|---------|
| `published` | quote | User publishes estimate |
| `publish_failed` | quote | Publish API call fails |
| `status_changed` | any | Status lookup changes |
| `line_scope_updated` | quote | Insurer updates line accept/reject |
| `approved` | quote | Status → Approved |
| `created` | any | Entity first created |
| `assigned` | job, quote | Assignee changed |
| `comment_added` | any | User adds a note |
| `document_generated` | any | PDF/report generated |
| `provider_sync` | any | Synced from/to provider |

---

## Migration & Rollout Plan

| Step | Phase | Scope | Risk |
|------|-------|-------|------|
| 1 | Schema migration | DB only | Low — additive table |
| 2 | Repository + Service | API module | Low — no existing code modified |
| 3 | Wire into `QuotesService.publish` | API | Low — appends logging after existing logic |
| 4 | Wire into `ProjectQuoteUseCase` | API | Medium — touches projection pipeline |
| 5 | Seed line_scope_status lookups | DB seed | Low |
| 6 | Frontend: Take Off badges | UI | Low — display only |
| 7 | Frontend: Publish result panel | UI | Low — replaces toast |
| 8 | Frontend: Activities tab + feed | UI | Low — replaces placeholder |
| 9 | Frontend: Notifications | UI | Low — additive |
| 10 | Extend to other entities | API + UI | Low — incremental |

---

## Testing Strategy

### Unit tests
- `ActivitiesService.log` — verify row insertion with all fields
- `ActivitiesService.list` — pagination, tenant isolation
- `QuotesService.publish` — verify activity logged on success and failure
- `LineItemSyncService` — verify line scope change detection and batch activity

### Integration tests
- End-to-end publish → verify activity row created
- Inbound webhook (UPDATE_QUOTE with status change) → verify activity row created with `actorType: 'provider'`
- Inbound webhook (UPDATE_QUOTE with lineScopeStatus changes) → verify per-line detail in activity

### Frontend tests
- `ActivityFeed` renders entries with correct icons, colours, grouping
- `EstimatePublishWizard` shows result panel with counts
- Take Off table renders scope badges correctly

---

## Open Questions

1. **Retention policy** — Should `entity_activities` rows be pruned after N months? Or is this a permanent audit log?
2. **Job-level aggregation** — Should the job detail page show a combined feed of all sub-entity activities (quotes, WOs, invoices)?
3. **User-initiated comments** — Should users be able to add free-text notes via the activity feed (action: `comment_added`)?
4. **Webhook response capture** — Does Crunchwork return structured validation warnings on `createQuote`/`updateQuote` that we can surface?
5. **Email notifications** — Should insurer decisions trigger email to the estimate owner, or in-app only?
