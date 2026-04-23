# 10 — Quotes Module

## Objective

Expose CRUD endpoints for quotes (Quote → Groups → Combos → Items) and keep the
local `quotes` / `quote_groups` / `quote_combos` / `quote_items` tables in sync
with the upstream Crunchwork Insurance REST API (v17 §3.3.6).

Two paths reach this module:

1. **User-initiated writes** — vendors / insurance staff call our REST API,
   which proxies to Crunchwork and then projects the CW response into the local
   DB.
2. **Webhook ingestion** — CW's quote events are handled by the external
   webhook pipeline (see `docs/implementation/29_TEMPORARY_WEBHOOK_ORCHESTRATOR.md`)
   which hands the payload to `CrunchworkQuoteMapper` for projection.

Both paths persist the full CW response verbatim in `quotes.api_payload` and
promote the fields defined in [`docs/mapping/quotes.md`](../mapping/quotes.md).

---

## Module layout

```
apps/api/src/modules/quotes/
├── quotes.module.ts
├── quotes.controller.ts
└── quotes.service.ts
```

Projection / ingestion logic lives **outside** this module, alongside the other
CW mappers, to keep the webhook pipeline self-contained:

```
apps/api/src/modules/external/mappers/
└── crunchwork-quote.mapper.ts
```

The mapping contract between CW and our tables — every field, every bucket,
every lookup — lives in [`docs/mapping/quotes.md`](../mapping/quotes.md). That
doc is the source of truth; this file describes the module wiring only.

---

## Controller endpoints

All routes live under `/quotes` and go through the standard tenant / auth guards
configured globally.

| Method | Route | Handler | Description |
|--------|-------|---------|-------------|
| `GET` | `/quotes` | `QuotesController.findAll` | Paginated list from local DB. Supports `page`, `limit`, `jobId`, `statusId` query params. |
| `GET` | `/quotes/job/:jobId` | `QuotesController.findByJob` | Returns all quotes linked to a job (local DB only). |
| `GET` | `/quotes/:id` | `QuotesController.findOne` | Returns a single quote from the local DB. |
| `POST` | `/quotes` | `QuotesController.create` | Proxies body to `POST /quotes` on CW, then persists the CW response. |
| `POST` | `/quotes/:id` | `QuotesController.update` | Proxies body to `POST /quotes/:id` on CW (CW's update verb), then stores the returned payload on the existing row. |

The CW contract uses `POST` for both create and update (`POST /quotes` and
`POST /quotes/:id`); we expose the same verbs at the edge so clients don't need
to translate.

---

## Service layer

`QuotesService` is a thin adapter between the controller, the CW client, and the
repository. It does **not** currently do full field promotion on write — that is
deferred to `CrunchworkQuoteMapper` on the inbound sync path.

```typescript
@Injectable()
export class QuotesService {
  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    statusId?: string;
  }): Promise<{ data: QuoteRow[]; total: number }>;

  async findOne(params: { id: string }): Promise<QuoteRow | null>;

  async findByJob(params: { jobId: string }): Promise<QuoteRow[]>;

  async create(params: { body: Record<string, unknown> }): Promise<QuoteRow>;

  async update(params: {
    id: string;
    body: Record<string, unknown>;
  }): Promise<QuoteRow | null>;
}
```

### Create flow

1. Resolve the active CW connection for the tenant via
   `ConnectionResolverService`. Throws `BadRequestException('No active CW
   connection for tenant')` if the tenant has no connection.
2. `CrunchworkService.createQuote({ connectionId, body })` issues the upstream
   `POST /quotes` call.
3. The CW response is persisted as a new `quotes` row with:
   - `external_reference` ← `response.id`
   - `quote_number` ← `response.quoteNumber`
   - `claim_id` / `job_id` ← best-effort copy from `body` / `response` (full
     external-link resolution is performed on the webhook path, not here)
   - `api_payload` ← full CW response

### Update flow

1. Look up the existing row by local id; return `null` if not found.
2. Resolve the tenant's CW connection.
3. `CrunchworkService.updateQuote({ connectionId, quoteId, body })` issues
   `POST /quotes/:id` upstream.
4. The CW response replaces `quotes.api_payload` (other promoted columns are
   refreshed lazily when the corresponding webhook event arrives).

---

## Inbound projection

`CrunchworkQuoteMapper` (registered via `EXTERNAL_ENTITY_MAPPERS` with
`providerEntityType = 'quote'`) handles CW webhook events. Current behaviour:

- Resolves `payload.jobId` / `payload.claimId` via
  `ExternalObjectService.resolveInternalEntityId` against `external_links`.
- If neither parent resolves, returns `{ skipped: 'skipped_no_parent' }` so the
  orchestrator marks the record `completed_unmapped` for later retry.
- Upserts the `quotes` row with the minimum parent-resolution columns and the
  full `api_payload`.
- Records the `external_links` row with `linkRole = 'source'`,
  `isPrimary = true`.

Everything else currently lives inside `api_payload`. The full field contract
— including group / combo / item child rows, all lookup FKs, all address
buckets — is documented in [`docs/mapping/quotes.md`](../mapping/quotes.md) and
is the backlog for expanding this mapper.

---

## Schema touchpoints

Four tables participate in the full quote projection. Only `quotes` is touched
by the current mapper; the child tables are defined on the schema but wait for
the mapper expansion described in `docs/mapping/quotes.md` §12.

- `quotes` — quote header, address buckets, schedule / approval info,
  `api_payload`, soft-delete.
- `quote_groups` — one row per CW `groups[]`; holds dimensions, sort order,
  totals, and per-group `group_payload`.
- `quote_combos` — one row per CW `groups[].combos[]`; FK `quote_group_id`.
  Soft-deletable.
- `quote_items` — one row per `groups[].items[]` **or**
  `groups[].combos[].items[]`, with a CHECK (`chk_quote_item_parent`) enforcing
  exactly one of `quote_group_id` / `quote_combo_id`.

Parent invariant: `chk_quote_parent` on `quotes` enforces that at least one of
`claim_id` / `job_id` is non-null, matching CW's "Either `jobId` or `claimId`
is required" rule.

---

## Lookup domains used

Per the mapping doc, quote projection needs these `lookup_values` domains:

| Domain | Source field | Seeded? |
|--------|--------------|---------|
| `quote_status` | `status.externalReference` | Yes (`sample-data.seed.ts`) |
| `quote_type` | `quoteType.externalReference` | **No** — backlog |
| `group_label` | `groups[].groupLabel.externalReference` | **No** — backlog |
| `line_scope_status` | `combos[].lineScopeStatus.externalReference`, `items[].lineScopeStatus.externalReference` | **No** — backlog |
| `unit_type` | `items[].unitType.externalReference` | **No** — backlog |

Unresolved entries are logged against `external_reference_resolution_log` when
the mapper expansion wires them in.

---

## Acceptance criteria

Current (shipped) behaviour:

- [x] `POST /quotes` creates a quote via CW and persists the response as a new
      local row.
- [x] `POST /quotes/:id` updates a quote via CW and refreshes the local
      `api_payload`.
- [x] `GET /quotes` supports pagination and filtering by `jobId` / `statusId`.
- [x] `GET /quotes/:id` and `GET /quotes/job/:jobId` return local rows.
- [x] CW webhook events land through `CrunchworkQuoteMapper`, resolving the
      claim / job parent via `external_links` or skipping with
      `skipped_no_parent`.
- [x] Full CW payload preserved verbatim on `quotes.api_payload`.

Backlog (tracked in [`docs/mapping/quotes.md`](../mapping/quotes.md) §12):

- [ ] Promote every scalar column listed in the mapping doc §5.
- [ ] Populate `quote_to` / `quote_for` / `quote_from` JSONB + their promoted
      columns (§4).
- [ ] Populate `schedule_info`, `approval_info`, `custom_data` buckets (§6).
- [ ] Resolve `status` and `quoteType` lookups; log misses.
- [ ] Sync `quote_groups`, `quote_combos`, `quote_items` child rows inside the
      same projection transaction (§7–§9).
- [ ] Add `external_reference` columns to the three child tables so child
      upserts are idempotent by CW id.
- [ ] Seed the remaining lookup domains (`quote_type`, `group_label`,
      `line_scope_status`, `unit_type`).
