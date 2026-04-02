# 12 — Invoices Module

## Objective

Implement the Invoices module for creating, reading, and managing trade invoices. Invoices are submitted by vendors against purchase orders and go through status workflows (submitted → approved/declined).

---

## Steps

### 12.1 Module Structure

```
src/modules/invoices/
├── invoices.module.ts
├── invoices.controller.ts
├── invoices.service.ts
├── invoices-sync.service.ts
├── dto/
│   ├── create-invoice.dto.ts
│   ├── update-invoice.dto.ts
│   ├── invoice-query.dto.ts
│   └── invoice-response.dto.ts
├── mappers/
│   └── invoice.mapper.ts
└── interfaces/
    └── invoice.interface.ts
```

### 12.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `POST` | `/invoices` | Create invoice (Vendor) | Vendor |
| `GET` | `/invoices` | List invoices (local DB) | All authenticated |
| `GET` | `/invoices/:id` | Get invoice detail | Insurance, Vendor |
| `POST` | `/invoices/:id` | Update invoice | Insurance, Vendor |

### 12.3 Service Layer

```typescript
@Injectable()
export class InvoicesService {
  async create(params: { dto: CreateInvoiceDto }): Promise<InvoiceResponseDto>;
  async findAll(params: { query: InvoiceQueryDto }): Promise<PaginatedResponse<InvoiceResponseDto>>;
  async findOne(params: { id: string }): Promise<InvoiceResponseDto>;
  async findByPurchaseOrder(params: { purchaseOrderId: string }): Promise<InvoiceResponseDto[]>;
  async findByJob(params: { jobId: string }): Promise<InvoiceResponseDto[]>;
  async update(params: { id: string; dto: UpdateInvoiceDto }): Promise<InvoiceResponseDto>;
}
```

### 12.4 Sync Service

```typescript
@Injectable()
export class InvoicesSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiInvoice: CrunchworkInvoiceDto;
  }): Promise<Invoice> {
    // 1. Upsert invoice record
    // 2. Link to purchase order, claim, job
    // 3. Resolve status lookup
    // 4. Store financials: subTotal, totalTax, totalAmount, excessAmount
    // 5. Store invoice_payload JSONB
  }
}
```

### 12.5 Create Invoice DTO

Per the API spec, creating an invoice requires:

```typescript
export class CreateInvoiceDto {
  @IsUUID() purchaseOrderId: string;
  @IsString() invoiceNumber: string;
  @IsOptional() @IsString() comments?: string;
  @IsOptional() @IsDateString() issueDate?: string;
  @IsNumber() subTotal: number;
  @IsNumber() totalTax: number;
  @IsNumber() totalAmount: number;
}
```

### 12.6 Invoice Response DTO

```typescript
export class InvoiceResponseDto {
  id: string;
  invoiceNumber: string;
  purchaseOrderId: string;
  claimId: string;
  jobId: string;
  status: LookupValueDto;
  issueDate: string;
  receivedDate: string;
  comments: string;
  declinedReason: string | null;
  subTotal: number;
  totalTax: number;
  totalAmount: number;
  excessAmount: number;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 12.7 API Behavior Notes

From the API spec:
- New invoices are created via `POST /invoices`
- The `upsertPurchaseOrderTradeInvoices` webhook fires for new invoices on a PO
- `updatePurchaseOrderTradeInvoice` webhook fires for status changes on existing invoices
- The `isDeleted` flag marks soft-deleted invoices (do not actually delete)

---

## Acceptance Criteria

- [ ] `POST /invoices` creates invoice in Crunchwork and persists locally
- [ ] `GET /invoices/:id` returns invoice detail with PO and status info
- [ ] Invoice list supports search, filter by status, sort by date/amount
- [ ] Invoices linked to correct PO, claim, and job
- [ ] Soft delete behavior respected (isDeleted flag)
