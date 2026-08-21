# Invoice — CW ↔ internal mapping

**Internal table:** `invoices` (see `apps/api/src/database/schema/index.ts`)
**Transformer:** `apps/api/src/modules/domain/transformers/invoice.transformer.ts`

---

## 1. Destination categories

| Category | Target | Notes |
|---|---|---|
| Promoted column | explicit column on `invoices` | Queryable |
| Lookup FK | `status_lookup_id` | Resolved via lookup domain |
| `invoice_payload` | full CW response | Always stored; lossless fallback |

---

## 2. Identity & scalar fields

| CW field | Internal column | Notes |
|---|---|---|
| `invoiceNumber` | `invoice_number` | |
| `issueDate` | `issue_date` | `timestamptz` |
| `receivedDate` | `received_date` | `timestamptz` |
| `comments` | `comments` | |
| `declinedReason` | `declined_reason` | Reason for decline/rejection |
| `subTotal` | `sub_total` | `numeric(14,2)` |
| `totalTax` | `total_tax` | `numeric(14,2)` |
| `totalAmount` | `total_amount` | `numeric(14,2)` |
| `excessAmount` | `excess_amount` | `numeric(14,2)` |
| `createdBy.externalReference` | `created_by_user_id` | User who created |
| `updatedBy.externalReference` | `updated_by_user_id` | User who last updated |

---

## 3. Lookup references

| CW field | Internal column | Lookup domain | If unresolved |
|---|---|---|---|
| `status` (object or string) | `status_lookup_id` | `invoice_status` | Auto-create stub |

Object form: `{ id, name, externalReference }` — resolves `externalReference` first, then `name`, then `id`.
String form: treated as both `externalReference` and `name`.

---

## 4. Parent references

| CW field | Entity type | Notes |
|---|---|---|
| `purchaseOrder.id` / `purchaseOrderId` | `purchase_order` | May resolve to WO in projection layer |
| `job.id` / `jobId` | `job` | |
| `claim.id` / `claimId` | `claim` | |

Both nested object (`{ id: "..." }`) and flat string forms are handled.

---

## 5. `invoice_payload`

The **entire** CW invoice response is stored in `invoices.invoice_payload` as the lossless fallback.

---

## 6. Gaps / not yet mapped

| CW field | Notes |
|---|---|
| `lineItems[]` | Handled separately by line-item sync service |
| `issuerOrganisation` / `recipientOrganisation` | Org resolution not yet wired in transformer |
| `sourceExternalReference` | Set by projection layer, not transformer |
