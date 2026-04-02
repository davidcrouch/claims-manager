# 18 — Vendors Module

## Objective

Implement the Vendors module for vendor management and allocation. Vendor allocation is driven by `jobType`, `account`, `postcode`, `lossType`, and `totalLoss` parameters and returns available vendors.

---

## Steps

### 18.1 Module Structure

```
src/modules/vendors/
├── vendors.module.ts
├── vendors.controller.ts
├── vendors.service.ts
├── vendors-sync.service.ts
├── dto/
│   ├── vendor-allocation-query.dto.ts
│   ├── vendor-query.dto.ts
│   └── vendor-response.dto.ts
├── mappers/
│   └── vendor.mapper.ts
└── interfaces/
    └── vendor.interface.ts
```

### 18.2 Controller Endpoints

| Method | Route | Description | Phase | Auth | Notes |
|--------|-------|-------------|-------|------|-------|
| `GET` | `/vendors` | List local vendors | - | All authenticated | From local DB |
| `GET` | `/vendors/:id` | Get vendor detail | - | All authenticated | From local DB |
| `GET` | `/vendors/allocation` | Query vendor allocation | **4** | Insurance | Gate: Phase 4 — feature flag. Return 501 if not yet active |

### 18.3 Vendor Allocation

Per the API spec (Section 3.3.4), vendor allocation uses query parameters:

```typescript
export class VendorAllocationQueryDto {
  @IsString() jobType: string;       // externalReference
  @IsString() account: string;       // externalReference
  @IsString() postcode: string;
  @IsOptional() @IsString() lossType?: string;
  @IsOptional() @IsBoolean() totalLoss?: boolean;
}
```

The API returns a list of vendors with address, phone, and after-hours phone.

### 18.4 Service Layer

```typescript
@Injectable()
export class VendorsService {
  async findAll(params: { query: VendorQueryDto }): Promise<PaginatedResponse<VendorResponseDto>>;
  async findOne(params: { id: string }): Promise<VendorResponseDto>;
  async getAllocation(params: { query: VendorAllocationQueryDto }): Promise<VendorResponseDto[]>;
}
```

### 18.5 Sync Service

Vendors are synced from API responses (when jobs include vendor data) and from allocation queries:

```typescript
async syncFromApi(params: {
  tenantId: string;
  apiVendor: CrunchworkVendorDto;
}): Promise<Vendor> {
  // 1. Upsert vendor (by tenant_id + external_reference)
  // 2. Store JSONB: address, contact_details
  // 3. Extract promoted: postcode, state, phone, etc.
}
```

### 18.6 Allocation Rules (Local)

The `vendor_allocation_rules` table allows storing local allocation preferences that can be used to enhance or override the API's allocation response.

---

## Acceptance Criteria

- [ ] `GET /vendors/allocation` proxies to Crunchwork and returns vendor list
- [ ] Vendors synced locally from job and allocation responses
- [ ] Vendor list supports search and filter
- [ ] Vendor detail includes address and contact information
