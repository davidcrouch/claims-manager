# 27d — Entity Mapper Service

**Date:** 2026-04-09
**Status:** Implementation Plan
**Depends on:** [27c](27c_MORE0_TOOL_ENDPOINTS.md)

---

## 0. Purpose

Document the entity mapper layer that projects external objects into internal business tables (claims, jobs, quotes, purchase orders, invoices, etc.). The mappers already exist — this plan covers their role in the v2 pipeline, required hardening, and the transaction boundary they participate in.

---

## 1. Current State

### 1.1 Mapper Registry

Seven mappers are implemented in `src/modules/external/mappers/`:

| Mapper | Entity Type Key | Internal Table | Status |
|--------|----------------|----------------|--------|
| `CrunchworkJobMapper` | `job` | `jobs` | Implemented |
| `CrunchworkClaimMapper` | `claim` | `claims` | Implemented |
| `CrunchworkPurchaseOrderMapper` | `purchase_order` | `purchase_orders` | Implemented |
| `CrunchworkInvoiceMapper` | `invoice` | `invoices` | Implemented |
| `CrunchworkTaskMapper` | `task` | `tasks` | Implemented |
| `CrunchworkMessageMapper` | `message` | `messages` | Implemented |
| `CrunchworkAttachmentMapper` | `attachment` | `attachments` | Implemented |

Missing: `quote`, `report`, `appointment`. These entity types have webhook events (`NEW_QUOTE`, `NEW_REPORT`, `NEW_APPOINTMENT`) but no mapper implementations yet.

### 1.2 Mapper Interface

All mappers implement the `EntityMapper` interface:

```typescript
export interface EntityMapper {
  map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
  }): Promise<{ internalEntityId: string; internalEntityType: string }>;
}
```

### 1.3 Common Pattern

Every mapper follows the same structure:

1. Extract `latestPayload` from the external object.
2. Check `external_links` for an existing mapping.
3. If exists: **update** the internal record with the new payload.
4. If new: **create** the internal record, then **upsert** an `external_links` row.

The `CrunchworkJobMapper` has additional complexity — it uses `NestedEntityExtractor` to resolve/create the parent claim and vendor from nested payload data.

---

## 2. Changes for v2

### 2.1 Wrap Mapper + External Link in a Transaction

Currently, the mapper creates the internal record and the external link as separate operations. If the process crashes between the two, the internal record exists without a link, which breaks re-processing (the mapper would create a duplicate because it checks links first).

**Fix:** Accept an optional transaction parameter and use it for both operations:

```typescript
export interface EntityMapper {
  map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;  // NEW — optional transaction handle
  }): Promise<{ internalEntityId: string; internalEntityType: string }>;
}
```

The tool endpoint in `ExternalToolsController.mapEntity` (doc 27c) wraps the mapper call in a transaction before passing it through:

```typescript
await this.db.transaction(async (tx) => {
  mapResult = await mapper.map({
    externalObject: ...,
    tenantId: body.tenantId,
    connectionId: body.connectionId,
    tx,
  });

  if (body.processingLogId) {
    await this.processingLogRepo.updateStatus({
      id: body.processingLogId,
      status: 'completed',
      completedAt: new Date(),
      externalObjectId: body.externalObjectId,
      tx,
    });
  }
});
```

This makes TX-3 from the overview (doc 27) fully atomic: internal record + external link + processing log status all commit or all roll back.

### 2.2 Implement Missing Mappers

Add the three missing mappers:

#### `CrunchworkQuoteMapper`

```typescript
@Injectable()
export class CrunchworkQuoteMapper implements EntityMapper {
  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const payload = params.externalObject.latestPayload as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    const existingLink = await this.findExistingLink({
      externalObjectId, entityType: 'quote', tx: params.tx,
    });

    if (existingLink) {
      await this.quotesRepo.update({
        id: existingLink.internalEntityId,
        data: { apiPayload: payload, externalReference: payload.id as string },
        tx: params.tx,
      });
      return { internalEntityId: existingLink.internalEntityId, internalEntityType: 'quote' };
    }

    // Resolve parent job via external links
    const jobId = await this.resolveParentJob({
      payload, connectionId: params.connectionId, tx: params.tx,
    });

    const created = await this.quotesRepo.create({
      data: {
        tenantId: params.tenantId,
        jobId: jobId ?? '',
        externalReference: payload.id as string,
        apiPayload: payload,
      },
      tx: params.tx,
    });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'quote',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx: params.tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'quote' };
  }
}
```

#### `CrunchworkReportMapper`

Same pattern as above, targeting the `reports` table.

#### `CrunchworkAppointmentMapper`

Same pattern, targeting the `appointments` table. Appointment payloads include `jobId` which is resolved via external links.

### 2.3 Update `NestedEntityExtractor` for Transactions

The `NestedEntityExtractor` creates claims and external objects inline during job mapping. It must also accept a `tx` parameter so that nested entity creation participates in the same transaction:

```typescript
async extractFromJobPayload(params: {
  jobPayload: Record<string, unknown>;
  tenantId: string;
  connectionId: string;
  sourceEventId?: string;
  tx?: DrizzleDbOrTx;
}): Promise<{ claimId?: string; vendorId?: string }> {
  // ... pass tx to resolveOrCreateClaim, upsertFromFetch, etc.
}
```

---

## 3. Entity Type to Mapper Routing

The `ExternalToolsController` routes to mappers via the `:entityType` URL parameter. The mapping is:

| URL Entity Type | Mapper Class | Internal Table |
|----------------|--------------|----------------|
| `job` | `CrunchworkJobMapper` | `jobs` |
| `claim` | `CrunchworkClaimMapper` | `claims` |
| `purchase_order` | `CrunchworkPurchaseOrderMapper` | `purchase_orders` |
| `invoice` | `CrunchworkInvoiceMapper` | `invoices` |
| `task` | `CrunchworkTaskMapper` | `tasks` |
| `message` | `CrunchworkMessageMapper` | `messages` |
| `attachment` | `CrunchworkAttachmentMapper` | `attachments` |
| `quote` | `CrunchworkQuoteMapper` | `quotes` |
| `report` | `CrunchworkReportMapper` | `reports` |
| `appointment` | `CrunchworkAppointmentMapper` | `appointments` |

The entity type value used in the URL must match the `resolvedEntityType` produced by the ASL workflow's `resolve-entity-type` step and the `EVENT_TYPE_TO_ENTITY` map in `ExternalToolsController`.

---

## 4. Idempotency Contract

All mappers must be idempotent — calling `map` twice with the same external object must produce the same result:

- **Update path:** If an external link exists, the internal record is updated (not duplicated). The upsert on `external_links` is keyed on `(externalObjectId, internalEntityType)`.
- **Create path:** If no external link exists, a new internal record is created. On replay, the first `map` call creates the record and link; the second `map` call finds the link and takes the update path.
- **Concurrency:** Two concurrent `map` calls for the same external object could race on the create path. The unique constraint on `external_links(external_object_id, internal_entity_type)` prevents duplicate links. The second caller's INSERT will conflict and should fall back to the update path.

---

## 5. Nested Entity Handling

When a job arrives, its payload may contain embedded claim and vendor data. The `NestedEntityExtractor` resolves these:

```
Job payload arrives
├── payload.claim → resolve or create Claim
│   ├── Check external_links for existing claim mapping
│   ├── If found → return internal claim ID
│   └── If not → create claim + external_object + external_link
└── payload.vendor → resolve Vendor
    ├── Check vendors table for matching ID
    └── If not found → skip (vendor may arrive via separate event)
```

This cascade means a single job webhook can create up to 3 records: the job, its parent claim, and an external object for the claim. All three must be in the same transaction when possible.

---

## 6. File Changes Summary

| File | Change |
|------|--------|
| `src/modules/external/tools/external-tools.controller.ts` | Wrap `mapEntity` in DB transaction |
| `src/modules/external/mappers/*.mapper.ts` (all 7) | Add `tx?` parameter to `map` signature, pass to repo calls |
| `src/modules/external/nested-entity-extractor.service.ts` | Add `tx?` parameter, pass through to all repo/service calls |
| `src/modules/external/mappers/crunchwork-quote.mapper.ts` | **NEW** — quote projection |
| `src/modules/external/mappers/crunchwork-report.mapper.ts` | **NEW** — report projection |
| `src/modules/external/mappers/crunchwork-appointment.mapper.ts` | **NEW** — appointment projection |
| `src/modules/external/external.module.ts` | Register new mappers |

---

## Acceptance Criteria

- [ ] `EntityMapper` interface includes optional `tx` parameter
- [ ] All 7 existing mappers accept and pass `tx` to repository calls
- [ ] `NestedEntityExtractor` accepts and passes `tx`
- [ ] `CrunchworkQuoteMapper` implemented and registered
- [ ] `CrunchworkReportMapper` implemented and registered
- [ ] `CrunchworkAppointmentMapper` implemented and registered
- [ ] `ExternalToolsController.mapEntity` wraps mapper call in a transaction
- [ ] Processing log update is inside the same transaction as the mapper
- [ ] Idempotency verified: calling map twice with same external object produces same result
- [ ] Unit tests for each new mapper
- [ ] Integration test: end-to-end from external object to internal record + link
