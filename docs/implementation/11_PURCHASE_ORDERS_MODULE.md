# 11 — Purchase Orders Module

## Objective

Implement the Purchase Orders module. POs mirror the quotes hierarchy (groups → combos → items) and represent approved work allocations. POs link to vendors, quotes, and jobs, and may have associated invoices.

---

## Steps

### 11.1 Module Structure

```
src/modules/purchase-orders/
├── purchase-orders.module.ts
├── purchase-orders.controller.ts
├── purchase-orders.service.ts
├── purchase-orders-sync.service.ts
├── dto/
│   ├── create-purchase-order.dto.ts
│   ├── update-purchase-order.dto.ts
│   ├── purchase-order-query.dto.ts
│   └── purchase-order-response.dto.ts
├── mappers/
│   └── purchase-order.mapper.ts
└── interfaces/
    └── purchase-order.interface.ts
```

### 11.2 Controller Endpoints

| Method | Route | Description | Auth |
|--------|-------|-------------|------|
| `GET` | `/purchase-orders` | List POs (local DB) | All authenticated |
| `GET` | `/purchase-orders/:id` | Get PO detail with line items | Insurance, Vendor |
| `POST` | `/purchase-orders/:id` | Update PO | Insurance |

### 11.3 Service Layer

```typescript
@Injectable()
export class PurchaseOrdersService {
  async findAll(params: { query: PurchaseOrderQueryDto }): Promise<PaginatedResponse<PurchaseOrderResponseDto>>;
  async findOne(params: { id: string }): Promise<PurchaseOrderResponseDto>;
  async findByJob(params: { jobId: string }): Promise<PurchaseOrderResponseDto[]>;
  async update(params: { id: string; dto: UpdatePurchaseOrderDto }): Promise<PurchaseOrderResponseDto>;
}
```

### 11.4 Sync Service

```typescript
@Injectable()
export class PurchaseOrdersSyncService {
  async syncFromApi(params: {
    tenantId: string;
    apiPurchaseOrder: CrunchworkPurchaseOrderDto;
  }): Promise<PurchaseOrder> {
    // 1. Upsert PO header
    // 2. Store JSONB: po_to, po_for, po_from, service_window, adjustment_info, allocation_context
    // 3. Extract promoted columns
    // 4. Resolve lookups: status, purchase_order_type
    // 5. Link vendor and quote if present
    // 6. Sync groups → purchase_order_groups
    // 7. Sync combos → purchase_order_combos
    // 8. Sync items → purchase_order_items
    // 9. Store full purchase_order_payload
  }
}
```

### 11.5 PO Line Item Hierarchy

Mirrors quotes but with PO-specific fields:

```
PurchaseOrder
├── Groups[]
│   ├── groupLabel (lookup)
│   ├── dimensions (JSONB)
│   ├── Combos[]
│   │   ├── name, category, subCategory
│   │   ├── quoteComboPoid (link to quote combo)
│   │   └── Items[]
│   │       ├── quoteLineItemId (link to quote item)
│   │       ├── reconciliation, manualAllocation
│   │       └── ...same pricing fields as quote items
│   └── Items[] (standalone)
```

### 11.6 PO-Specific Fields

From the API spec, POs include additional fields beyond quotes:

- `startDate`, `endDate`, `startTime`, `endTime` (service window)
- `adjustedTotal`, `adjustedTotalAdjustmentAmount` (adjustment info)
- `allocationContext` (vendor allocation details)
- `externalId` (external system PO number)

### 11.7 Response DTO

```typescript
export class PurchaseOrderResponseDto {
  id: string;
  purchaseOrderNumber: string;
  name: string;
  status: LookupValueDto;
  purchaseOrderType: LookupValueDto;
  jobId: string;
  claimId: string;
  vendorId: string;
  quoteId: string | null;
  poTo: POPartyDto;
  poFor: POPartyDto;
  poFrom: POPartyDto;
  startDate: string;
  endDate: string;
  totalAmount: number;
  adjustedTotal: number;
  groups: POGroupResponseDto[];
  invoices: InvoiceSummaryDto[];
  createdAt: string;
  updatedAt: string;
}
```

---

## Acceptance Criteria

- [ ] `GET /purchase-orders/:id` returns PO with full line item hierarchy
- [ ] `POST /purchase-orders/:id` updates PO in Crunchwork and syncs locally
- [ ] PO list filterable by status, vendor, job
- [ ] Linked invoices included in PO detail
- [ ] Sync handles group→combo→item tree like quotes
- [ ] JSONB party blocks and service window stored correctly
