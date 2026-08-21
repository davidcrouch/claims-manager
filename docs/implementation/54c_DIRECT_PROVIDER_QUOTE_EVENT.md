# 54c — Direct Provider Quote Publish Event

**Gap addressed:** G4 (`quote.published` not emitted for direct-provider jobs)

## Problem

`QuotesService.publish` only emits the `quote.published` event inside the Crunchwork sync path. When the job's provider is `direct` (no external CRM), the entire publish flow exits early after the local status update — the outbound event is never emitted.

The `quote.published` event is the trigger for the ASL to transition from `WaitForQuotePublished` to `OnQuotePublished` → `EvaluateAutoApproval`. Without it, the workflow stalls permanently at the submission stage.

This affects all three workflow types (assessment, make-safe, works) when running with the direct provider — most critically during E2E testing and for tenants that don't use Crunchwork.

## Solution

### 1. Move the event emission out of the Crunchwork sync block

**File:** `apps/api/src/modules/quotes/quotes.service.ts`
**Method:** `publish`

Currently the event emission is inside the Crunchwork publish path (after `cwClient.updateQuote`). Move it to a shared path that fires regardless of provider.

The code at lines 574–588 already does this correctly for external jobs:

```typescript
if (this.outboundEvents && existing.jobId) {
  const autoApprovalContext = await this.resolveAutoApprovalContext({
    quoteId: params.id,
    jobId: existing.jobId,
    tenantId,
  });

  this.outboundEvents.emitQuotePublished({
    quoteId: params.id,
    jobId: existing.jobId,
    tenantId,
    publishedAt: new Date().toISOString(),
    ...autoApprovalContext,
  }).catch(() => {});
}
```

For the direct-provider path, add the same emission block after the local status update. The direct publish path should:
1. Update the quote's local status to "Published" (or equivalent).
2. Emit `quote.published` with auto-approval context.

```typescript
// Direct-provider publish path
if (providerCode === 'direct') {
  const publishedStatus = await this.resolveStatusLookup({
    tenantId,
    domain: 'quote_status',
    name: 'Published',
  });

  await this.quotesRepo.update({
    id: params.id,
    data: {
      statusLookupId: publishedStatus.lookupId,
      ...(params.userId ? { updatedByUserId: params.userId } : {}),
    },
  });

  // Emit the event — same as external path
  if (this.outboundEvents && existing.jobId) {
    const autoApprovalContext = await this.resolveAutoApprovalContext({
      quoteId: params.id,
      jobId: existing.jobId,
      tenantId,
    });

    this.outboundEvents.emitQuotePublished({
      quoteId: params.id,
      jobId: existing.jobId,
      tenantId,
      publishedAt: new Date().toISOString(),
      ...autoApprovalContext,
    }).catch(() => {});
  }

  return this.findOne({ id: params.id });
}
```

If the code is already structured so that the event emission runs for all providers, verify that the direct path reaches it. The key check: trace the `publish` method to confirm the `emitQuotePublished` call is reachable when `providerCode === 'direct'`.

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/quotes/quotes.service.ts` | claims-manager | Emit `quote.published` on direct-provider publish path |

## Testing

1. Create a direct-provider job, create a quote, publish the quote → verify `quote.published` event is emitted.
2. Verify the event payload contains auto-approval context fields (`claimRecommendation`, `autoApprovalApplies`, `claimDecision`, `withinDelegateAuthority`).
3. Integration: run a make-safe workflow with direct provider through the quote publish stage → verify ASL transitions from `WaitForQuotePublished` to `OnQuotePublished`.
4. Verify external-provider (Crunchwork) publish still works unchanged.
