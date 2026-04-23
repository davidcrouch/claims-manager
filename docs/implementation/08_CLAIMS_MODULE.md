# 08 — Claims Module

## Objective

Implement the Claims module that proxies write operations to the Crunchwork
(CW) API and serves read operations from the local hybrid
relational+JSONB schema. Claims are the top-level entity in the domain
hierarchy.

Ingress (CW → local DB) is handled separately by the entity-mapper pipeline
(see [`27d_ENTITY_MAPPER_SERVICE.md`](./27d_ENTITY_MAPPER_SERVICE.md) and
[`29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md`](./29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md)).
The field-by-field CW ↔ internal mapping for Claims is the single source of
truth in [`docs/mapping/claims.md`](../mapping/claims.md); this module
consumes the tables it populates.

---

## Phase Dependencies

| Feature | Crunchwork Phase | Notes |
|---------|-----------------|-------|
| `POST /claims` (create) | 1 | Insurance team |
| `POST /claims/{id}` (update) | 1 | Insurance team |
| `GET /claims` (list) | — | **No CW list endpoint.** Served locally; populated by create and by the webhook pipeline. |
| `GET /claims/{id}` (read by ID) | **3** | Used when we have `claim_id` from a job (from `GET /jobs` or webhooks) |
| `GET /claims?claimNumber=` | **3** | Search |
| `GET /claims?externalReference=` | **3** | Search |

**Claims list source:** The local DB serves the claims list. It is populated by:

- Claims created via `POST /claims` (the response is persisted synchronously).
- Claims projected by the webhook pipeline — each `claim.*` event is mapped by
  `CrunchworkClaimMapper` into `claims` + related child tables.
- Claims fetched via `GET /claims/{id}` (Phase 3+) when we have `claim_id`
  from a job.
- Claims found via search (`claimNumber` / `externalReference`) (Phase 3+).

**Before Phase 3:** Only claims created via `POST /claims` and claims arriving
via the webhook pipeline appear in the list. Job webhooks store `claim_id` on
the job but cannot fetch the claim until Phase 3.

**Phase 3+:** Full claim read, search, and webhook-driven parent claim sync.
The BFF can also seed claims by calling `GET /jobs`, extracting unique
`claim_id` values, and fetching each via `GET /claims/{id}`.

---

## Steps

### 8.1 Module Structure

The module intentionally stays thin — it is a REST façade over the shared
claims repository plus the CW HTTP client. Sync/ingress logic lives in the
external entity-mapper pipeline and must not be duplicated here.

```
apps/api/src/modules/claims/
├── claims.module.ts
├── claims.controller.ts
└── claims.service.ts
```

Related code that lives outside this folder:

| Concern | Location |
|---------|----------|
| DB schema (`claims`, `claim_contacts`, `claim_assignees`) | `apps/api/src/database/schema/index.ts` |
| Data access | `apps/api/src/database/repositories/claims.repository.ts` |
| CW ↔ internal mapping (spec) | [`docs/mapping/claims.md`](../mapping/claims.md) |
| CW ↔ internal mapping (impl) | `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` |
| Lookup resolution | `apps/api/src/modules/external/lookup-resolver.service.ts` |
| CW HTTP client | `apps/api/src/crunchwork/crunchwork.service.ts` |
| CW connection selection | `apps/api/src/modules/external/connection-resolver.service.ts` |

### 8.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/claims` | Create claim via Crunchwork, persist the response locally | Admin, Claims Manager |
| `GET` | `/claims` | List claims from local DB with query-string search / filter / pagination | All authenticated |
| `GET` | `/claims/:id` | Get claim detail from local DB | All authenticated |
| `POST` | `/claims/:id` | Update claim via Crunchwork, refresh local row from response | Admin, Claims Manager |

Query parameters on `GET /claims`:

| Param | Meaning | Notes |
|-------|---------|-------|
| `page` | 1-based page number | Default `1` |
| `limit` | Page size | Default `20`, capped at `100` |
| `search` | Substring match against `claim_number`, `external_reference`, `policy_number` (case-insensitive) | |
| `sort` | One of `updated_at_desc` (default), `updated_at_asc`, `created_at_desc`, `created_at_asc`, `claim_number_asc`, `claim_number_desc` | |
| `status` | Comma-separated `status_lookup_id` values | |

A dedicated `GET /claims/search` endpoint is **not** implemented — searching by
`claimNumber` / `externalReference` is expressed through the `search` query
parameter on `GET /claims`. When we enable pass-through search to CW (Phase
3+), a `from=remote` parameter on `GET /claims` is preferred over a new route
so callers do not have to learn a second path.

### 8.3 Service Layer

```typescript
@Injectable()
export class ClaimsService {
  constructor(
    private readonly claimsRepo: ClaimsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  async findAll(params: { page?; limit?; search?; sort?; status? }): Promise<{ data: ClaimRow[]; total: number }>;
  async findOne(params: { id: string }): Promise<ClaimRow | null>;
  async create(params: { body: Record<string, unknown> }): Promise<ClaimRow>;
  async update(params: { id: string; body: Record<string, unknown> }): Promise<ClaimRow | null>;
}
```

Behaviour:

- `findAll` / `findOne` are **read-only** against the local `claims` table,
  scoped by `TenantContext`. They do not hit CW.
- `create` resolves the active CW connection via `ConnectionResolverService`,
  calls `crunchworkService.createClaim`, then persists the bare response
  (`id`, `claimNumber`, full `apiPayload`) so the caller immediately sees the
  new row. The richer projection (lookups, child tables, JSONB buckets)
  arrives shortly after via the webhook pipeline invoking
  `CrunchworkClaimMapper` — which upserts against the same row keyed on
  `(tenant_id, external_reference)`.
- `update` proxies to `crunchworkService.updateClaim` and refreshes the local
  `apiPayload` / `claim_number` fields. Again, the webhook-driven mapper will
  fill in the full projection.
- Neither `create` nor `update` perform lookup resolution inline; that is the
  mapper's job on the back-projection. This keeps the synchronous CW
  round-trip fast and avoids duplicating mapping logic in two places.

### 8.4 Sync / Projection

There is no `ClaimsSyncService` inside this module. CW → local sync is
performed by `CrunchworkClaimMapper`
(`apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts`),
registered with the entity-mapper registry and invoked by
`InProcessProjectionService` whenever a `claim.*` external object changes.

The mapper:

1. Resolves the existing claim (external link → `(tenant_id, external_reference)`
   → `(tenant_id, claim_number)`).
2. Builds the `claims` row — scalars, address JSONB + promoted address
   columns, the four themed JSONB buckets (`policy_details`,
   `financial_details`, `vulnerability_details`, `contention_details`), and
   `custom_data` (including unknown-key capture).
3. Resolves every lookup FK through `LookupResolver` (with domain-specific
   auto-create rules).
4. Stores the verbatim CW response in `api_payload`.
5. Syncs `contacts[]` into the shared `contacts` table plus the
   `claim_contacts` join (additive).
6. Syncs `assignees[]` into `claim_assignees` (pruned to the current payload).

All behaviour above is specified field-by-field in
[`docs/mapping/claims.md`](../mapping/claims.md). If this module changes in a
way that affects ingress — e.g. a new CW field — the mapping doc must be
updated first, then the mapper, then the schema.

### 8.5 Response Shape

The controller currently returns the raw repository row (`typeof claims.$inferSelect`)
with a `jobs` summary stitched in by the UI where relevant.

A richer response DTO (with inlined lookup `{id, name, externalReference}`
triplets and resolved contacts / assignees) is tracked as follow-up; the UI
currently reads the JSONB buckets and child tables directly. The shape below
is the **target** for when that DTO lands, not the current response:

```typescript
export class ClaimResponseDto {
  id: string;
  claimNumber: string | null;
  externalReference: string | null;    // CW's UUID
  externalClaimId: string | null;      // Insurer's own reference
  lodgementDate: string | null;
  dateOfLoss: string | null;
  status: LookupValueDto | null;
  account: LookupValueDto | null;
  catCode: LookupValueDto | null;
  lossType: LookupValueDto | null;
  lossSubType: LookupValueDto | null;
  claimDecision: LookupValueDto | null;
  priority: LookupValueDto | null;
  policyType: LookupValueDto | null;
  lineOfBusiness: LookupValueDto | null;
  address: AddressDto;
  vulnerableCustomer: boolean | null;
  totalLoss: boolean | null;
  contentiousClaim: boolean | null;
  contentiousActivityFlag: boolean | null;
  autoApprovalApplies: boolean | null;
  contentsDamaged: boolean | null;
  incidentDescription: string | null;
  abn: string | null;
  policyName: string | null;
  policyNumber: string | null;
  postalAddress: string | null;
  policyDetails: Record<string, unknown>;
  financialDetails: Record<string, unknown>;
  vulnerabilityDetails: Record<string, unknown>;
  contentionDetails: Record<string, unknown>;
  customData: Record<string, unknown>;
  contacts: ContactDto[];
  assignees: AssigneeDto[];
  jobs: JobSummaryDto[];
  createdAt: string;
  updatedAt: string;
}
```

### 8.6 Tenant Scoping

Every service method resolves the caller's tenant via `TenantContext` and
every repository call is scoped by `tenant_id`. There is no code path on this
module that bypasses tenant scoping.

---

## Acceptance Criteria

- [x] `POST /claims` creates a claim in Crunchwork and persists the response locally (`external_reference`, `claim_number`, `api_payload`).
- [x] `GET /claims` returns paginated, tenant-scoped list with `search`, `status`, and `sort` query parameters.
- [x] `GET /claims/:id` returns the persisted claim row (tenant-scoped).
- [x] `POST /claims/:id` updates the claim in Crunchwork and refreshes `api_payload` / `claim_number` locally.
- [x] Webhook-driven projection populates all lookup FKs, JSONB buckets, promoted columns, `claim_contacts`, and `claim_assignees` per [`docs/mapping/claims.md`](../mapping/claims.md).
- [x] Every field listed in CW Insurance REST API v17 §3.3.1 has an internal destination defined in [`docs/mapping/claims.md`](../mapping/claims.md).
- [ ] Rich `ClaimResponseDto` with inlined lookup objects and expanded contacts / assignees (see §8.5) — tracked as follow-up; UI currently consumes the raw row.
- [ ] Remote-search pass-through to CW (`GET /claims?from=remote&claimNumber=…` / `…&externalReference=…`) — Phase 3+.
