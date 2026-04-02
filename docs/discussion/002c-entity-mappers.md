# 002c — Entity Mappers (More0 Tools)

**Date:** 2026-03-25 (revised)
**Status:** Implementation Plan
**Parent:** [002 — Master Index](./002-implementation-plan.md)
**Depends on:** [002a](./002a-schema-and-migrations.md), [002b](./002b-webhook-pipeline-refactor.md)

---

## 0. Scope

Implement per-entity CW→internal mappers for **all** webhook event types, with full field extraction (populating all typed columns, not just `apiPayload`). Also covers nested entity extraction (contacts, appointments, vendor from Job response).

**Relationship to More0:** Each mapper is a NestJS service invoked by the `POST /api/v1/tools/mappers/{entityType}` tool endpoint (created in 002b). The More0 workflow's `project-to-internal` step calls that endpoint, which dispatches to the correct mapper. The mapper logic itself is plain NestJS — More0 handles the orchestration of when/whether it runs.

---

## 1. CW API Entity Types to Handle

| CW Event Type | CW Fetch Endpoint | Mapper | Internal Target Tables |
|---------------|-------------------|--------|----------------------|
| `NEW_JOB` / `UPDATE_JOB` | `GET /jobs/{id}` | `CrunchworkJobMapper` | `jobs`, `claims`, `contacts`, `job_contacts`, `vendors`, `appointments`, `appointment_attendees` |
| `NEW_PURCHASE_ORDER` / `UPDATE_PURCHASE_ORDER` | `GET /purchase-orders/{id}` | `CrunchworkPurchaseOrderMapper` | `purchase_orders`, `purchase_order_groups`, `purchase_order_combos`, `purchase_order_items`, `invoices` |
| `NEW_INVOICE` / `UPDATE_INVOICE` | `GET /invoices/{id}` | `CrunchworkInvoiceMapper` | `invoices` |
| `NEW_MESSAGE` | `GET /messages/{id}` | `CrunchworkMessageMapper` | `messages` |
| `NEW_TASK` / `UPDATE_TASK` | `GET /tasks/{id}` | `CrunchworkTaskMapper` | `tasks` |
| `NEW_ATTACHMENT` / `UPDATE_ATTACHMENT` | `GET /attachments/{scopedId}` | `CrunchworkAttachmentMapper` | `attachments` |

---

## 2. Tool Endpoint Dispatch

The tool endpoint `POST /api/v1/tools/mappers/{entityType}` (from 002b) needs a dispatch mechanism. Rather than an in-process registry class, use a simple service map in the controller:

```typescript
// In ExternalToolsController
private readonly mappers: Record<string, EntityMapper>;

constructor(
  jobMapper: CrunchworkJobMapper,
  claimMapper: CrunchworkClaimMapper,
  poMapper: CrunchworkPurchaseOrderMapper,
  invoiceMapper: CrunchworkInvoiceMapper,
  taskMapper: CrunchworkTaskMapper,
  messageMapper: CrunchworkMessageMapper,
  attachmentMapper: CrunchworkAttachmentMapper,
) {
  this.mappers = {
    job: jobMapper,
    claim: claimMapper,
    purchase_order: poMapper,
    invoice: invoiceMapper,
    task: taskMapper,
    message: messageMapper,
    attachment: attachmentMapper,
  };
}
```

All mappers implement a common interface:
```typescript
export interface EntityMapper {
  map(params: {
    externalObject: ExternalObjectRow;
    tenantId: string;
    connectionId: string;
  }): Promise<{ internalEntityId: string; internalEntityType: string }>;
}
```

---

## 3. Work Items

### 3.1 — Enhance `CrunchworkJobMapper` with Full Field Extraction

**File:** `apps/api/src/modules/external/mappers/crunchwork-job.mapper.ts` **(Modify)**

**Field mapping (CW Job → internal `jobs`):**

| Internal Column | CW Source Path | Notes |
|----------------|---------------|-------|
| `tenantId` | from context | |
| `claimId` | resolved from nested claim | Via NestedEntityExtractor |
| `parentClaimId` | `cwJob.claim.id` | CW's direct FK (text) |
| `vendorId` | resolved from nested vendor | Via NestedEntityExtractor |
| `externalReference` | `cwJob.id` | CW entity UUID |
| `jobTypeLookupId` | resolve `cwJob.jobType.externalReference` | Domain: `job_type` |
| `statusLookupId` | resolve `cwJob.status.externalReference` | Domain: `job_status` |
| `requestDate` | `cwJob.requestDate` | |
| `collectExcess` | `cwJob.collectExcess` | |
| `excess` | `cwJob.excess` | |
| `makeSafeRequired` | `cwJob.makeSafeRequired` | |
| `address` | `cwJob.address` | JSONB |
| `addressPostcode` | `cwJob.address.postcode` | Extracted for indexing |
| `addressSuburb` | `cwJob.address.suburb` | |
| `addressState` | `cwJob.address.state` | |
| `addressCountry` | `cwJob.address.country` | |
| `jobInstructions` | `cwJob.jobInstructions` | |
| `vendorSnapshot` | `cwJob.vendor` | JSONB snapshot |
| `temporaryAccommodationDetails` | `cwJob.temporaryAccommodation` | JSONB |
| `specialistDetails` | `cwJob.specialist` | JSONB |
| `rectificationDetails` | `cwJob.rectification` | JSONB |
| `auditDetails` | `cwJob.audit` | JSONB |
| `mobilityConsiderations` | `cwJob.mobilityConsiderations` | JSONB array |
| `apiPayload` | full CW response | Convenience denormalization |

**Nested extraction (via `NestedEntityExtractor`):**
1. `cwJob.contacts[]` → upsert `contacts` + `job_contacts`
2. `cwJob.appointments[]` → upsert `appointments` + `appointment_attendees`
3. `cwJob.claim{}` → upsert claim via `CrunchworkClaimMapper`
4. `cwJob.vendor{}` → upsert vendor via `VendorsRepository`

---

### 3.2 — Enhance `CrunchworkClaimMapper` with Full Field Extraction

**File:** `apps/api/src/modules/external/mappers/crunchwork-claim.mapper.ts` **(Modify)**

**Field mapping (CW Claim → internal `claims`):**

| Internal Column | CW Source Path | Notes |
|----------------|---------------|-------|
| `claimNumber` | `cwClaim.claimNumber` | |
| `externalReference` | `cwClaim.id` | CW UUID |
| `externalClaimId` | `cwClaim.externalReference` | Insurer's ref |
| `accountLookupId` | resolve `cwClaim.account.externalReference` | Domain: `account` |
| `statusLookupId` | resolve `cwClaim.status.externalReference` | Domain: `claim_status` |
| `catCodeLookupId` | resolve `cwClaim.catCode.externalReference` | Domain: `cat_code` |
| `lossTypeLookupId` | resolve `cwClaim.lossType.externalReference` | Domain: `loss_type` |
| `lossSubtypeLookupId` | resolve `cwClaim.lossSubtype.externalReference` | Domain: `loss_subtype` |
| `lodgementDate` | `cwClaim.lodgementDate` | |
| `dateOfLoss` | `cwClaim.dateOfLoss` | |
| `address` | `cwClaim.address` | JSONB |
| `addressPostcode` | `cwClaim.address.postcode` | |
| `addressSuburb` | `cwClaim.address.suburb` | |
| `addressState` | `cwClaim.address.state` | |
| `addressCountry` | `cwClaim.address.country` | |
| `policyNumber` | `cwClaim.policyNumber` | |
| `policyName` | `cwClaim.policyName` | |
| `policyDetails` | `cwClaim.policyDetails` | JSONB |
| `financialDetails` | `cwClaim.financialDetails` | JSONB |
| `vulnerabilityDetails` | `cwClaim.vulnerability` | JSONB |
| `vulnerableCustomer` | `cwClaim.vulnerableCustomer` | |
| `totalLoss` | `cwClaim.totalLoss` | |
| `contentiousClaim` | `cwClaim.contentiousClaim` | |
| `autoApprovalApplies` | `cwClaim.autoApprovalApplies` | |
| `contentsDamaged` | `cwClaim.contentsDamaged` | |
| `incidentDescription` | `cwClaim.incidentDescription` | |
| `apiPayload` | full CW response | |

**Nested extraction:**
- `cwClaim.contacts[]` → upsert `contacts` + `claim_contacts`
- `cwClaim.assignees[]` → upsert `claim_assignees`

---

### 3.3 — Create `CrunchworkPurchaseOrderMapper`

**File:** `apps/api/src/modules/external/mappers/crunchwork-purchase-order.mapper.ts` **(Create)**

**Logic:**
1. Lookup or create `external_link` for the PO.
2. Map top-level PO fields → `purchase_orders`.
3. For each `group`: upsert `purchase_order_groups`.
4. For each `combo`: upsert `purchase_order_combos`.
5. For each `item`: upsert `purchase_order_items`.
6. Resolve `vendorId`, `jobId`, `claimId` from CW references via `external_links`.
7. If inline invoices exist → delegate to `CrunchworkInvoiceMapper`.

**Line item strategy:** Delete existing children for this PO, then reinsert. Simpler than diff-and-update; `groupPayload` JSONB preserves CW IDs for traceability.

**Key fields:** `purchaseOrderNumber`, `name`, `statusLookupId`, `purchaseOrderTypeLookupId`, `startDate`, `endDate`, `note`, `poTo`, `poFor`, `poFrom`, `totalAmount`, `adjustedTotal`, `purchaseOrderPayload`.

---

### 3.4 — Create `CrunchworkInvoiceMapper`

**File:** `apps/api/src/modules/external/mappers/crunchwork-invoice.mapper.ts` **(Create)**

**Key fields:** `invoiceNumber`, `purchaseOrderId` (resolved via external_links), `statusLookupId`, `issueDate`, `receivedDate`, `comments`, `subTotal`, `totalTax`, `totalAmount`, `excessAmount`, `invoicePayload`.

---

### 3.5 — Create `CrunchworkTaskMapper`

**File:** `apps/api/src/modules/external/mappers/crunchwork-task.mapper.ts` **(Create)**

**Key fields:** `name`, `description`, `taskTypeLookupId`, `claimId`, `jobId` (resolved), `dueDate`, `priority` (mapped to enum), `status` (mapped to enum), `assignedToExternalReference`, `taskPayload`.

---

### 3.6 — Create `CrunchworkMessageMapper`

**File:** `apps/api/src/modules/external/mappers/crunchwork-message.mapper.ts` **(Create)**

**Key fields:** `subject`, `body`, `messageTypeLookupId`, `fromJobId`, `toJobId`, `fromClaimId`, `toClaimId` (resolved), `acknowledgementRequired`, `messagePayload`.

---

### 3.7 — Create `CrunchworkAttachmentMapper`

**File:** `apps/api/src/modules/external/mappers/crunchwork-attachment.mapper.ts` **(Create)**

**Key fields:** `relatedRecordType`, `relatedRecordId` (resolved), `title`, `description`, `fileName`, `mimeType`, `fileSize`, `storageProvider='crunchwork'`, `fileUrl`, `apiPayload`.

> File download/S3 mirroring is out of scope. `fileUrl` stores the CW download endpoint.

---

### 3.8 — Enhance `NestedEntityExtractor` for Contacts and Appointments

**File:** `apps/api/src/modules/external/nested-entity-extractor.service.ts` **(Modify)**

**Add `extractContacts`:**
For each contact: upsert `contacts` by `tenantId` + `externalReference`, map `firstName`, `lastName`, `email`, `mobilePhone`, `homePhone`, `workPhone`, `typeLookupId`. Upsert `job_contacts` or `claim_contacts` join row.

**Add `extractAppointments`:**
For each appointment: upsert `appointments` by matching fields, map `name`, `location`, `startDate`, `endDate`, `appointmentTypeLookupId`, `status`. For each attendee → upsert `appointment_attendees`.

---

### 3.9 — Create `LookupResolver` Utility

**File:** `apps/api/src/modules/external/lookup-resolver.service.ts` **(Create)**

```typescript
async resolve(params: {
  tenantId: string;
  domain: string;
  externalReference: string;
  autoCreate?: boolean;
}): Promise<string | null>
```

1. Query `lookup_values` for matching row.
2. If found: return `id`.
3. If not found + `autoCreate=true`: insert new row, return `id`.
4. If not found + `autoCreate=false`: log to `external_reference_resolution_log`, return `null`.

---

### 3.10 — Register All Mappers in `ExternalModule`

**File:** `apps/api/src/modules/external/external.module.ts` **(Modify)**

Add all new mappers as providers. Update `ExternalToolsController` constructor to inject them.

---

## 4. CW Internal ID Resolution Pattern

When a mapper needs to find the internal UUID for a CW entity reference (e.g., PO mapper needs the internal `jobId`), it calls `ExternalObjectService.resolveInternalEntityId()`:

1. Query `external_objects` for `(connectionId, providerEntityType, providerEntityId)`.
2. Query `external_links` for `(externalObjectId, internalEntityType)`.
3. Return `internalEntityId` or `null`.

If null (entity not yet processed): set FK to null and log a warning. More0 will eventually process the referenced entity; a future reconciliation step can fill in missing FKs.

---

## 5. New Files Summary

| # | File (relative to `apps/api/src/`) | Purpose |
|---|-----|---------|
| 1 | `modules/external/mappers/crunchwork-purchase-order.mapper.ts` | PO + line items |
| 2 | `modules/external/mappers/crunchwork-invoice.mapper.ts` | Invoice |
| 3 | `modules/external/mappers/crunchwork-task.mapper.ts` | Task |
| 4 | `modules/external/mappers/crunchwork-message.mapper.ts` | Message |
| 5 | `modules/external/mappers/crunchwork-attachment.mapper.ts` | Attachment |
| 6 | `modules/external/lookup-resolver.service.ts` | Lookup resolution utility |

## 6. Modified Files Summary

| # | File | Change |
|---|------|--------|
| 1 | `modules/external/mappers/crunchwork-job.mapper.ts` | Full field extraction + nested entity calls |
| 2 | `modules/external/mappers/crunchwork-claim.mapper.ts` | Full field extraction + contact/assignee calls |
| 3 | `modules/external/nested-entity-extractor.service.ts` | Add extractContacts, extractAppointments |
| 4 | `modules/external/external.module.ts` | Register new mappers + LookupResolver |
| 5 | `modules/external/tools/external-tools.controller.ts` | Wire new mappers into dispatch map |

---

## 7. Test Strategy

| Test | Scope |
|------|-------|
| Per-mapper unit test | Mock repos, provide sample CW JSON, verify all typed columns populated, verify external_link created. |
| LookupResolver unit test | Verify resolve with existing lookup; verify auto-create; verify resolution log on miss. |
| NestedEntityExtractor unit test | Verify contacts extracted and linked; verify appointments extracted. |
| Field mapping regression test | JSON fixtures of real CW API responses → run mapper → snapshot-test the internal record fields. |

**Test fixtures directory:** `apps/api/test/fixtures/crunchwork/` with sample JSON per entity type.

---

## 8. Estimated Effort

| Item | Estimate |
|------|----------|
| Job mapper full field extraction | 3 hours |
| Claim mapper full field extraction | 2 hours |
| PurchaseOrder mapper (with line items) | 4 hours |
| Invoice mapper | 1.5 hours |
| Task mapper | 1.5 hours |
| Message mapper | 1.5 hours |
| Attachment mapper | 1.5 hours |
| NestedEntityExtractor (contacts, appointments) | 3 hours |
| LookupResolver | 1.5 hours |
| Tool controller wiring | 1 hour |
| Test fixtures | 2 hours |
| Unit tests (7 mappers + resolver + extractor) | 6 hours |
| **Total** | **~3.5 days** |
