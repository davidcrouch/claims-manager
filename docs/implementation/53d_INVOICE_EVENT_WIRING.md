# 53d — Invoice Event Wiring

**Gap addressed:** G2 (no `invoice.approved` event emitter)

## Problem

The ASL state `WaitForInvoice` listens for `invoice.approved`, but:
1. `OutboundEventsService` has no `emitInvoiceApproved` method
2. `InvoicesService` has no `OutboundEventsService` dependency
3. No invoice status change emits any outbound event

Without this, the workflow stalls after the quote review phase and never reaches job completion.

## Solution

### 1. Add `emitInvoiceApproved` to `OutboundEventsService`

**File:** `apps/api/src/modules/outbound-events/outbound-events.service.ts`

```typescript
async emitInvoiceApproved(params: {
  invoiceId: string;
  jobId: string;
  tenantId: string;
  purchaseOrderId?: string;
  approvedAt?: string;
}): Promise<void> {
  await this.emit({
    eventType: 'invoice.approved',
    entityType: 'job',
    entityId: params.jobId,
    tenantId: params.tenantId,
    payload: {
      invoiceId: params.invoiceId,
      jobId: params.jobId,
      purchaseOrderId: params.purchaseOrderId,
      approvedAt: params.approvedAt ?? new Date().toISOString(),
    },
  });
}
```

### 2. Inject `OutboundEventsService` into `InvoicesService`

**File:** `apps/api/src/modules/invoices/invoices.service.ts`

Add the dependency:
```typescript
import { OutboundEventsService } from '../outbound-events/outbound-events.service';

@Injectable()
export class InvoicesService {
  constructor(
    // ... existing deps
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}
}
```

### 3. Emit on invoice status change

Invoice approval in this system happens via inbound webhook projection (Crunchwork updates invoice status) or via local status update. We need to detect when the status changes to an "Approved" equivalent.

**Approach:** Add event emission in the `update` method and also after `publish` when the invoice moves to "Submitted" (since the Crunchwork approval happens asynchronously). The primary trigger is when the status lookup resolves to "Approved".

Add a status-change check after update:

```typescript
async update(params: {
  id: string;
  body: Record<string, unknown>;
  userId?: string;
}) {
  const existing = await this.findOne({ id: params.id });
  if (!existing) return null;

  // ... existing update logic ...

  const updated = await this.invoicesRepo.update({ id: params.id, data });

  // Emit invoice.approved when status changes to Approved
  this.emitIfApproved(existing, updated);

  return updated;
}

private emitIfApproved(
  previous: Record<string, unknown>,
  current: Record<string, unknown> | null,
): void {
  if (!this.outboundEvents || !current) return;

  const prevStatusId = previous.statusLookupId as string;
  const newStatusId = current.statusLookupId as string;
  if (prevStatusId === newStatusId) return;

  // Check by status name on the lookup or by known status patterns
  const statusName = (current.statusName as string)
    ?? (current.status as string)
    ?? '';

  if (statusName === 'Approved' || statusName === 'approved') {
    const jobId = (current.jobId ?? '') as string;
    if (!jobId) return;

    const tenantId = this.tenantContext.getTenantId();
    this.outboundEvents.emitInvoiceApproved({
      invoiceId: current.id as string,
      jobId,
      tenantId,
      purchaseOrderId: (current.purchaseOrderId as string) ?? undefined,
    }).catch(() => {});
  }
}
```

### 4. Handle inbound webhook projection for invoice status

When invoices are updated via the Crunchwork inbound webhook (e.g. insurer approves an invoice), the projection pipeline updates the local invoice row. This path also needs to emit the event.

**File:** `apps/api/src/modules/domain/use-cases/project-invoice.use-case.ts` (or equivalent projection handler)

After the invoice row is upserted with the new status, check if the status is "Approved" and emit:

```typescript
if (this.outboundEvents && invoiceStatus === 'Approved' && jobId) {
  this.outboundEvents.emitInvoiceApproved({
    invoiceId,
    jobId,
    tenantId,
    purchaseOrderId,
  }).catch(() => {});
}
```

### 5. Update `InvoicesModule` imports

**File:** `apps/api/src/modules/invoices/invoices.module.ts`

Import `OutboundEventsModule` so the service can resolve the dependency:

```typescript
import { OutboundEventsModule } from '../outbound-events/outbound-events.module';

@Module({
  imports: [/* existing */, OutboundEventsModule],
  // ...
})
export class InvoicesModule {}
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/outbound-events/outbound-events.service.ts` | claims-manager | Add emitInvoiceApproved |
| `apps/api/src/modules/invoices/invoices.service.ts` | claims-manager | Inject OutboundEventsService, emit on status change |
| `apps/api/src/modules/invoices/invoices.module.ts` | claims-manager | Import OutboundEventsModule |
| Webhook projection handler (if applicable) | claims-manager | Emit on inbound invoice approval |

## Testing

1. Update an invoice's status to "Approved" → verify `invoice.approved` event is emitted.
2. Update to a non-approved status → verify no event.
3. Verify the workflow resumes from `WaitForInvoice` when the event arrives.
4. Test the PO completion path: after invoice.approved, emit purchase_order.completed → verify workflow transitions to `CheckJobCompletion`.
