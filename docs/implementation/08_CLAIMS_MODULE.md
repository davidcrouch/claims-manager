# 08 — Claims Module

## Objective

Implement the Claims module that proxies operations to the Crunchwork API and persists claim data locally in the hybrid relational+JSONB schema. Claims are the top-level entity in the domain hierarchy.

---

## Phase Dependencies

| Feature | Crunchwork Phase | Notes |
|---------|-----------------|-------|
| `POST /claims` (create) | 1 | Insurance team |
| `POST /claims/{id}` (update) | 1 | Insurance team |
| `GET /claims` (list) | — | **No list endpoint.** Claims are discovered via `claim_id` from jobs |
| `GET /claims/{id}` (read by ID) | **3** | Used when we have `claim_id` from a job (from `GET /jobs` or webhooks) |
| `GET /claims?claimNumber=` | **3** | Search |
| `GET /claims?externalReference=` | **3** | Search |

**Claims list source:** The local DB serves the claims list. It is populated by:
- Claims created via `POST /claims` (synced on creation)
- Claims fetched via `GET /claims/{id}` when we have `claim_id` — from jobs returned by `GET /jobs` or from job webhooks (Phase 3+)
- Claims found via search (`claimNumber` / `externalReference`)

**Before Phase 3:** Only claims created via `POST /claims` appear in the list. Job webhooks store `claim_id` on the job but cannot fetch the claim until Phase 3.

**Phase 3+:** Full claim read, search, and webhook-driven parent claim sync. The BFF can also seed claims by calling `GET /jobs`, extracting unique `claim_id` values, and fetching each via `GET /claims/{id}`.

---

## Steps

### 8.1 Module Structure

```
src/modules/claims/
├── claims.module.ts
├── claims.controller.ts
├── claims.service.ts
├── claims-sync.service.ts        # syncs API data → local DB
├── dto/
│   ├── create-claim.dto.ts
│   ├── update-claim.dto.ts
│   ├── claim-query.dto.ts
│   └── claim-response.dto.ts
├── mappers/
│   └── claim.mapper.ts           # API ↔ DB ↔ Response transformations
└── interfaces/
    └── claim.interface.ts
```

### 8.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/claims` | Create claim via Crunchwork API | Admin, Claims Manager |
| `GET` | `/claims` | List claims (from local DB, with search/filter) | All authenticated |
| `GET` | `/claims/:id` | Get claim detail (local DB + API refresh) | All authenticated |
| `POST` | `/claims/:id` | Update claim via Crunchwork API | Admin, Claims Manager |
| `GET` | `/claims/search` | Search by claimNumber or externalReference | All authenticated |

### 8.3 Service Layer

```typescript
@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(Claim) private readonly claimRepo: Repository<Claim>,
    private readonly crunchworkService: CrunchworkService,
    private readonly claimsSyncService: ClaimsSyncService,
    private readonly tenantContext: TenantContext,
    private readonly lookupsService: LookupsService,
  ) {}

  async create(params: { dto: CreateClaimDto }): Promise<ClaimResponseDto> {
    // 1. Resolve lookup external references (account, status, etc.)
    // 2. Call crunchworkService.createClaim()
    // 3. Sync response to local DB
    // 4. Return mapped response
  }

  async findAll(params: { query: ClaimQueryDto }): Promise<PaginatedResponse<ClaimResponseDto>> {
    // Query local DB with tenant scoping, search, filters, pagination
    // Local DB is populated by: POST /claims, GET /claims/{id} (when claim_id from jobs), search, webhooks
  }

  async findOne(params: { id: string }): Promise<ClaimResponseDto> {
    // 1. Check local DB
    // 2. Optionally refresh from API
    // 3. Return mapped response
  }

  async update(params: { id: string; dto: UpdateClaimDto }): Promise<ClaimResponseDto> {
    // 1. Resolve lookups
    // 2. Call crunchworkService.updateClaim()
    // 3. Sync response to local DB
    // 4. Return mapped response
  }

  async search(params: { query: ClaimSearchDto }): Promise<ClaimResponseDto[]> {
    // 1. Query Crunchwork by claimNumber or externalReference
    // 2. Sync results to local DB
    // 3. Return mapped results
  }
}
```

### 8.4 Sync Service

Transforms Crunchwork API response into the local DB schema:

```typescript
@Injectable()
export class ClaimsSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiClaim: CrunchworkClaimDto;
  }): Promise<Claim> {
    // 1. Upsert claim record
    // 2. Resolve and link lookup values (account, status, catCode, etc.)
    // 3. Populate JSONB columns (address, policy_details, etc.)
    // 4. Extract promoted columns (address_postcode, policy_number, etc.)
    // 5. Sync contacts → contacts table + claim_contacts join
    // 6. Sync assignees → claim_assignees table
    // 7. Store full api_payload
  }
}
```

### 8.5 Claim Mapper

Transforms between three representations:

1. **Crunchwork API format** (camelCase, nested objects with id/name/externalReference)
2. **Local DB entity** (snake_case, JSONB + promoted columns)
3. **Frontend response DTO** (clean, typed response for the UI)

Key transformations:

```typescript
export class ClaimMapper {
  static apiToEntity(params: {
    apiClaim: CrunchworkClaimDto;
    lookupMap: Map<string, LookupValue>;
  }): Partial<Claim>;

  static entityToResponse(params: { entity: Claim }): ClaimResponseDto;
  
  static dtoToApiBody(params: { dto: CreateClaimDto }): CrunchworkClaimDto;
}
```

### 8.6 Query DTO

```typescript
export class ClaimQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsArray() statusIds?: string[];
  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() sortBy?: 'claimNumber' | 'lodgementDate' | 'status' | 'updatedAt';
  @IsOptional() @IsEnum(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}
```

### 8.7 Response DTO

```typescript
export class ClaimResponseDto {
  id: string;
  claimNumber: string;
  externalReference: string;
  lodgementDate: string;
  status: LookupValueDto;
  account: LookupValueDto;
  address: AddressDto;
  catCode: LookupValueDto;
  lossType: LookupValueDto;
  lossSubType: LookupValueDto;
  dateOfLoss: string;
  vulnerableCustomer: boolean;
  totalLoss: boolean;
  contentiousClaim: boolean;
  policyName: string;
  policyNumber: string;
  policyType: LookupValueDto;
  contacts: ContactDto[];
  assignees: AssigneeDto[];
  jobs: JobSummaryDto[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Acceptance Criteria

- [ ] `POST /claims` creates claim in Crunchwork and persists locally
- [ ] `GET /claims` returns paginated, tenant-scoped list with search and filter
- [ ] `GET /claims/:id` returns full claim detail with contacts and assignees
- [ ] `POST /claims/:id` updates claim in Crunchwork and syncs locally
- [ ] Search by claimNumber and externalReference works
- [ ] JSONB data stored correctly alongside promoted columns
- [ ] All lookup references resolved via LookupsService
