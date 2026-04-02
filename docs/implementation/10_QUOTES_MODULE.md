# 10 — Quotes Module

## Objective

Implement the Quotes module with full support for the hierarchical quote structure: Quote → Groups → Combos → Items. Quotes are created by Vendors and linked to jobs.

---

## Steps

### 10.1 Module Structure

```
src/modules/quotes/
├── quotes.module.ts
├── quotes.controller.ts
├── quotes.service.ts
├── quotes-sync.service.ts
├── dto/
│   ├── create-quote.dto.ts
│   ├── update-quote.dto.ts
│   ├── quote-query.dto.ts
│   └── quote-response.dto.ts
├── mappers/
│   └── quote.mapper.ts
└── interfaces/
    └── quote.interface.ts
```

### 10.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/quotes` | Create quote (Vendor) | Vendor |
| `GET` | `/quotes` | List quotes (local DB, filterable) | All authenticated |
| `GET` | `/quotes/:id` | Get quote detail with line items | All authenticated |
| `POST` | `/quotes/:id` | Update quote | Insurance, Vendor |

### 10.3 Service Layer

```typescript
@Injectable()
export class QuotesService {
  async create(params: { dto: CreateQuoteDto }): Promise<QuoteResponseDto>;
  async findAll(params: { query: QuoteQueryDto }): Promise<PaginatedResponse<QuoteResponseDto>>;
  async findOne(params: { id: string }): Promise<QuoteResponseDto>;
  async findByJob(params: { jobId: string }): Promise<QuoteResponseDto[]>;
  async update(params: { id: string; dto: UpdateQuoteDto }): Promise<QuoteResponseDto>;
}
```

### 10.4 Sync Service

Handles the complex hierarchical structure:

```typescript
@Injectable()
export class QuotesSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiQuote: CrunchworkQuoteDto;
  }): Promise<Quote> {
    // 1. Upsert quote header
    // 2. Store JSONB fields: quote_to, quote_for, quote_from, schedule_info, approval_info
    // 3. Extract promoted columns: quote_to_email, quote_to_name, etc.
    // 4. Resolve lookups: status, quote_type
    // 5. Sync groups → quote_groups table
    // 6. For each group: sync combos → quote_combos table
    // 7. For each combo: sync items → quote_items table
    // 8. For each group: sync standalone items → quote_items table
    // 9. Calculate and store totals
    // 10. Store full api_payload
  }
}
```

### 10.5 Quote Line Item Hierarchy

Per the API spec and DB design:

```
Quote
├── Groups[]
│   ├── groupLabel (lookup)
│   ├── description
│   ├── dimensions (JSONB)
│   ├── Combos[]
│   │   ├── name, category, subCategory
│   │   ├── lineScopeStatus (lookup)
│   │   ├── quantity
│   │   └── Items[]
│   │       ├── name, category, subCategory
│   │       ├── unitType (lookup), lineScopeStatus (lookup)
│   │       ├── quantity, unitCost, buyCost, tax
│   │       ├── markupType, markupValue
│   │       └── totals (JSONB)
│   └── Items[] (standalone, not in combo)
```

### 10.6 Create Quote DTO

Structure mirrors the API's Create Quote JSON body:

```typescript
export class CreateQuoteDto {
  @IsUUID() jobId: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() reference?: string;
  @IsOptional() @IsString() note?: string;
  @IsOptional() @IsString() quoteTypeExternalReference?: string;
  @ValidateNested({ each: true })
  @Type(() => CreateQuoteGroupDto)
  groups: CreateQuoteGroupDto[];
}
```

### 10.7 Quote Response DTO

```typescript
export class QuoteResponseDto {
  id: string;
  quoteNumber: string;
  name: string;
  reference: string;
  status: LookupValueDto;
  quoteType: LookupValueDto;
  jobId: string;
  claimId: string;
  quoteTo: QuotePartyDto;
  quoteFor: QuotePartyDto;
  quoteFrom: QuotePartyDto;
  subTotal: number;
  totalTax: number;
  totalAmount: number;
  groups: QuoteGroupResponseDto[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Acceptance Criteria

- [ ] `POST /quotes` creates quote in Crunchwork with full hierarchy
- [ ] `GET /quotes/:id` returns quote with groups, combos, and items
- [ ] Quote list filterable by status, job, date
- [ ] Sync correctly handles the full group→combo→item tree
- [ ] Totals calculated and stored at each level
- [ ] Lookup references resolved for all quote-level types
