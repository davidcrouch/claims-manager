# 07 — Lookup Values Module

## Objective

Manage the `lookup_values` table which stores all domain-driven reference data (statuses, types, accounts, etc.) used by the API. This replaces many small reference tables with a single, flexible lookup table keyed by `(tenant_id, domain, external_reference)`.

---

## Steps

### 7.1 Module Structure

```
src/modules/lookups/
├── lookups.module.ts
├── lookups.controller.ts
├── lookups.service.ts
├── dto/
│   ├── create-lookup.dto.ts
│   ├── update-lookup.dto.ts
│   └── lookup-query.dto.ts
└── interfaces/
    └── lookup-domain.enum.ts
```

### 7.2 Lookup Domains Enum

```typescript
export enum LookupDomain {
  ACCOUNT = 'account',
  CLAIM_STATUS = 'claim_status',
  JOB_STATUS = 'job_status',
  INVOICE_STATUS = 'invoice_status',
  QUOTE_STATUS = 'quote_status',
  PURCHASE_ORDER_STATUS = 'purchase_order_status',
  JOB_TYPE = 'job_type',
  LOSS_TYPE = 'loss_type',
  LOSS_SUBTYPE = 'loss_subtype',
  CAT_CODE = 'cat_code',
  CLAIM_DECISION = 'claim_decision',
  PRIORITY = 'priority',
  POLICY_TYPE = 'policy_type',
  LINE_OF_BUSINESS = 'line_of_business',
  CONTACT_TYPE = 'contact_type',
  CONTACT_METHOD = 'contact_method',
  ASSIGNEE_TYPE = 'assignee_type',
  TASK_TYPE = 'task_type',
  QUOTE_TYPE = 'quote_type',
  GROUP_LABEL = 'group_label',
  LINE_SCOPE_STATUS = 'line_scope_status',
  UNIT_TYPE = 'unit_type',
  PURCHASE_ORDER_TYPE = 'purchase_order_type',
  MESSAGE_TYPE = 'message_type',
  APPOINTMENT_TYPE = 'appointment_type',
  SPECIALIST_VISIT_TYPE = 'specialist_visit_type',
  REPORT_TYPE = 'report_type',
  DOCUMENT_TYPE = 'document_type',
  AUDIT_TYPE = 'audit_type',
  SPECIALIST_CATEGORY = 'specialist_category',
  SPECIALIST_REPORT = 'specialist_report',
  ORIGINAL_JOB_TYPE = 'original_job_type',
}
```

### 7.3 Service Methods

```typescript
@Injectable()
export class LookupsService extends TenantScopedService<LookupValue> {
  async findByDomain(params: { domain: LookupDomain }): Promise<LookupValue[]>;
  
  async resolveByExternalReference(params: {
    domain: LookupDomain;
    externalReference: string;
  }): Promise<LookupValue | null>;
  
  async resolveOrCreate(params: {
    domain: LookupDomain;
    externalReference: string;
    name?: string;
    metadata?: Record<string, any>;
  }): Promise<LookupValue>;
  
  async create(params: { dto: CreateLookupDto }): Promise<LookupValue>;
  
  async update(params: { id: string; dto: UpdateLookupDto }): Promise<LookupValue>;
}
```

### 7.4 External Reference Resolution

The Crunchwork API has specific "unknown value" behaviors per domain:

| Behavior | Domains | Action |
|----------|---------|--------|
| **Fail API Call** | `account`, `job_type`, `job_status` | Throw `BadRequestException` if not found |
| **Add Mapping Value and Record** | `cat_code`, `contact` externalRef | Create lookup entry automatically |
| **Choose a Default** | `loss_type` | Fallback to a default lookup |
| **Continue API Call** | `loss_subtype`, `claim_decision`, `priority`, `policy_type`, `line_of_business`, `contact_method`, `contact_type`, `assignee_type` | Pass through, ignore unknown |

Implement a `resolveExternalReference` method that applies the correct behavior per domain, logging to `external_reference_resolution_log`.

### 7.5 Controller Endpoints

```
GET    /api/v1/lookups?domain=<domain>        # list by domain
GET    /api/v1/lookups/:id                    # get by id
POST   /api/v1/lookups                        # create
POST   /api/v1/lookups/:id                    # update
```

### 7.6 Caching

Cache lookup values per tenant+domain with a TTL (e.g., 5 minutes) to reduce DB queries, since lookups are read-heavy and change rarely.

**Critical:** Cache keys MUST include `tenantId` to prevent cross-tenant data leakage:
```
cacheKey = `lookups:${tenantId}:${domain}`
```

### 7.7 Lookup Bootstrap Strategy

The `lookup_values` table must be pre-populated with known reference data before claims/jobs can be created, because Crunchwork requires valid `externalReference` values on create calls and will reject unknown values for critical domains (e.g., `account`, `job_type`).

**Bootstrap approach:**

1. **Seed migration:** Create a migration that inserts known lookup values for each tenant. Source the values from:
   - The API spec examples (e.g., status names, job type names listed in contract tables)
   - Crunchwork onboarding documentation or reference data exports
   - Manual collection from the Crunchwork UI or support team

2. **Auto-learn from API responses:** When syncing data from Crunchwork (via reads or webhooks), the sync services extract lookup objects (e.g., `status: { id, name, externalReference }`) and `resolveOrCreate` them. Over time, the lookup table fills organically.

3. **Admin endpoint:** Provide a `POST /api/v1/lookups/seed` endpoint (Admin role only) that accepts a bulk list of lookup values per domain for manual import.

**Required domains for create flows:**

| Domain | Required for | Unknown Value Behavior |
|--------|-------------|----------------------|
| `account` | Claim create | **Fail API Call** |
| `job_type` | Job create | **Fail API Call** |
| `job_status` | Job create/update | **Fail API Call** |
| `contact_type` | Contact on claim/job | **Continue API Call** |
| `cat_code` | Claim create | **Add Mapping Value** |
| `loss_type` | Claim create | **Choose Default** |

These domains should be seeded before the system is used to avoid failed API calls.

---

## Acceptance Criteria

- [ ] All 30+ lookup domains defined and queryable
- [ ] `resolveOrCreate` auto-creates unknown values for domains that support it
- [ ] Resolution log captures all external reference resolution attempts
- [ ] Lookup endpoints return correct tenant-scoped data
- [ ] Cache reduces DB load for frequently accessed lookups
- [ ] Cache keys include `tenantId` — no cross-tenant leakage
- [ ] Seed migration or admin endpoint populates required domains
- [ ] Sync services auto-learn lookup values from API responses
