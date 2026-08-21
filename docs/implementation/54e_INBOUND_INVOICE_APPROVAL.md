# 54e — Inbound Invoice Approval Event

**Gap addressed:** G6 (inbound Crunchwork invoice approval does not emit `invoice.approved`)

## Problem

When an insurer approves an invoice via the Crunchwork CRM, an inbound webhook updates the local invoice row's status. However, this inbound projection path does not emit the `invoice.approved` outbound event that the ASL needs to advance from `WaitForInvoice` (assessment) or detect invoice completion (make-safe).

The local `InvoicesService.update` path already emits `invoice.approved` when the status changes to "Approved" via the REST API. But the inbound webhook projection may bypass `InvoicesService.update` and write directly to the repository.

This gap affects all three workflow types, though the make-safe ASL's `WaitForCompletionAndInvoice` listens for `purchase_order.completed` (which may fire independently), reducing the immediate impact.

## Solution

### 1. Identify the inbound invoice projection path

The Crunchwork inbound webhook pipeline processes incoming payloads and upserts entities. For invoices, this may be:

- A dedicated use-case class (e.g. `ProjectInvoiceUseCase`)
- A handler in the webhook projection service
- A direct call to `InvoicesService.update` (in which case the event already fires)

**Investigation step:** Trace the inbound webhook handler for invoice status updates to determine which code path executes the status change.

### 2. Emit `invoice.approved` in the projection path

Wherever the inbound projection updates the invoice status, add event emission:

```typescript
// After upserting the invoice with the new status from Crunchwork
if (newStatusName === 'Approved' && previousStatusName !== 'Approved') {
  if (this.outboundEvents && jobId) {
    this.outboundEvents.emitInvoiceApproved({
      invoiceId,
      jobId,
      tenantId,
      purchaseOrderId: purchaseOrderId ?? undefined,
      approvedAt: new Date().toISOString(),
    }).catch(() => {});
  }
}
```

### 3. Resolve the status name from the lookup

The inbound payload may contain a Crunchwork status ID or name. If a lookup ID is used, resolve the name before comparing:

```typescript
private async resolveStatusName(params: {
  statusLookupId: string;
  tenantId: string;
}): Promise<string | null> {
  const lookupMap = await this.lookupsRepo.findByIds({
    ids: [params.statusLookupId],
    tenantId: params.tenantId,
  });
  const lookup = lookupMap.get(params.statusLookupId);
  return lookup?.name?.toLowerCase() ?? null;
}
```

### 4. Ensure idempotency

The event should only fire once per approval transition. If the projection is re-run (e.g. webhook retry), the status won't change from `Approved` → `Approved`, so the `previousStatusName !== 'Approved'` guard handles idempotency.

If the projection doesn't have access to the previous status (upsert semantics), fetch the existing invoice before the update:

```typescript
const existing = await this.invoicesRepo.findOne({ id: invoiceId, tenantId });
const previousStatus = existing?.statusLookupId;

// ... perform upsert ...

if (newStatusLookupId !== previousStatus) {
  const newStatusName = await this.resolveStatusName({
    statusLookupId: newStatusLookupId,
    tenantId,
  });
  if (newStatusName === 'approved') {
    this.outboundEvents.emitInvoiceApproved({ ... }).catch(() => {});
  }
}
```

## Files Changed

| File | Repo | Change |
|------|------|--------|
| Webhook projection handler (TBD — depends on investigation) | claims-manager | Emit `invoice.approved` on inbound approval |
| `apps/api/src/modules/invoices/invoices.service.ts` | claims-manager | Verify existing `checkAndEmitInvoiceApproved` covers all update paths |

## Testing

1. Simulate an inbound Crunchwork webhook payload that sets an invoice's status to "Approved" → verify `invoice.approved` event is emitted.
2. Re-send the same webhook → verify no duplicate event (idempotency).
3. Send a webhook that sets status to a non-approval status → verify no event.
4. Integration (assessment): advance a workflow to `WaitForInvoice`, simulate insurer invoice approval via inbound webhook → verify workflow transitions to `WaitForPOCompletion`.
5. Integration (make-safe): verify `WaitForCompletionAndInvoice` handles invoice approval → PO completion sequence.
