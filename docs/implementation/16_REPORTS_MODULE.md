# 16 — Reports Module

## Objective

Implement the Reports module for assessment and completion reports. Reports are heavily JSONB-driven, with the report body varying by type. Reports are created by Vendors and linked to jobs.

---

## Steps

### 16.1 Module Structure

```
src/modules/reports/
├── reports.module.ts
├── reports.controller.ts
├── reports.service.ts
├── reports-sync.service.ts
├── dto/
│   ├── create-report.dto.ts
│   ├── update-report.dto.ts
│   ├── report-query.dto.ts
│   └── report-response.dto.ts
├── mappers/
│   └── report.mapper.ts
└── interfaces/
    └── report.interface.ts
```

### 16.2 Controller Endpoints

| Method | Route | Description | Phase | Auth |
|--------|-------|-------------|-------|------|
| `POST` | `/reports` | Create report | 1 | Vendor |
| `GET` | `/reports` | List reports (local DB) | - | All authenticated |
| `GET` | `/reports/:id` | Get report detail | 2 | Insurance, Vendor |
| `POST` | `/reports/:id` | Update report | 1 | Vendor |

### 16.3 Service Layer

```typescript
@Injectable()
export class ReportsService {
  async create(params: { dto: CreateReportDto }): Promise<ReportResponseDto>;
  async findAll(params: { query: ReportQueryDto }): Promise<PaginatedResponse<ReportResponseDto>>;
  async findOne(params: { id: string }): Promise<ReportResponseDto>;
  async findByJob(params: { jobId: string }): Promise<ReportResponseDto[]>;
  async findByClaim(params: { claimId: string }): Promise<ReportResponseDto[]>;
  async update(params: { id: string; dto: UpdateReportDto }): Promise<ReportResponseDto>;
}
```

### 16.4 JSONB Storage

Reports are the most JSONB-heavy entity. The `report_data` column stores the full report body, and `report_meta` stores metadata. The structure varies by report type (assessment, completion, specialist, etc.).

```typescript
export class CreateReportDto {
  @IsOptional() @IsUUID() claimId?: string;
  @IsOptional() @IsUUID() jobId?: string;
  @IsString() reportTypeExternalReference: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() reference?: string;
  @IsObject() reportData: Record<string, any>;  // variable structure per type
}
```

### 16.5 Sync Service

```typescript
async syncFromApi(params: {
  tenantId: string;
  apiReport: CrunchworkReportDto;
}): Promise<Report> {
  // 1. Upsert report record
  // 2. Link to claim and/or job
  // 3. Resolve lookups: report_type, status
  // 4. Store full report_data as JSONB
  // 5. Store report_meta as JSONB
  // 6. Store api_payload
}
```

### 16.6 Webhook Event

- `NEW_REPORT`: Created by vendors, triggers local sync

---

## Acceptance Criteria

- [ ] `POST /reports` creates report in Crunchwork and persists locally
- [ ] `GET /reports/:id` returns full JSONB report data
- [ ] Report list filterable by type, job, claim
- [ ] JSONB report_data preserved without schema enforcement
- [ ] GIN index on report_data supports content queries
