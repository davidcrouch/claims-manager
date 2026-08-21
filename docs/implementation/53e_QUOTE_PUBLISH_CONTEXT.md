# 53e — Quote Publish Auto-Approval Context

**Gap addressed:** G6 (quote publish event missing auto-approval context fields)

## Problem

The `emitQuotePublished` method on `OutboundEventsService` accepts auto-approval context fields (`claimRecommendation`, `autoApprovalApplies`, `claimDecision`, `withinDelegateAuthority`), but the `QuotesService.publish` method doesn't pass them:

```typescript
// Current — missing auto-approval fields
this.outboundEvents.emitQuotePublished({
  quoteId: params.id,
  jobId: existing.jobId,
  tenantId,
  publishedAt: new Date().toISOString(),
}).catch(() => {});
```

The ASL's `EvaluateAutoApproval` Choice state checks all four fields on `$.event.payload`:
```json
"And": [
  { "Variable": "$.event.payload.claimRecommendation", "StringEquals": "Accept" },
  { "Variable": "$.event.payload.autoApprovalApplies", "BooleanEquals": true },
  { "Variable": "$.event.payload.claimDecision", "StringEquals": "Accept" },
  { "Variable": "$.event.payload.withinDelegateAuthority", "BooleanEquals": true }
]
```

Without these fields, auto-approval will never trigger — every quote will fall through to manual `WaitForQuoteOutcome`.

## Solution

### 1. Enrich the quote publish event with auto-approval context

**File:** `apps/api/src/modules/quotes/quotes.service.ts`

In the `publish` method, after successfully publishing the quote, resolve the auto-approval context from the job and quote data before emitting the event.

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

### 2. Add `resolveAutoApprovalContext` helper

```typescript
private async resolveAutoApprovalContext(params: {
  quoteId: string;
  jobId: string;
  tenantId: string;
}): Promise<{
  claimRecommendation?: string;
  autoApprovalApplies?: boolean;
  claimDecision?: string;
  withinDelegateAuthority?: boolean;
}> {
  const logPrefix = 'QuotesService.resolveAutoApprovalContext';

  try {
    // Get the job to read customData fields
    const job = await this.jobsRepo.findOne({
      id: params.jobId,
      tenantId: params.tenantId,
    });
    if (!job) return {};

    const customData = (job.customData ?? {}) as Record<string, unknown>;
    const claimRecommendation = customData.claimRecommendation as string | undefined;
    const autoApprovalApplies = customData.autoApprovalApplies as boolean | undefined;
    const claimDecision = customData.claimDecision as string | undefined;

    // Determine if the quote is within the delegate authority limit.
    // This requires comparing the quote total against the insurer's
    // configured limit for this vendor.
    let withinDelegateAuthority: boolean | undefined;

    const quote = await this.quotesRepo.findOne({
      id: params.quoteId,
      tenantId: params.tenantId,
    });

    if (quote && autoApprovalApplies) {
      const quoteTotal = quote.totalAmount
        ? parseFloat(String(quote.totalAmount))
        : 0;

      // Read the delegate authority limit from job or account config.
      // For now, use the value from customData if set by insurer.
      const delegateLimit = customData.delegateAuthorityLimit
        ? parseFloat(String(customData.delegateAuthorityLimit))
        : null;

      if (delegateLimit !== null) {
        withinDelegateAuthority = quoteTotal <= delegateLimit;
      }
    }

    this.logger.debug(
      `${logPrefix} — job=${params.jobId} recommendation=${claimRecommendation} ` +
      `autoApproval=${autoApprovalApplies} decision=${claimDecision} ` +
      `withinAuthority=${withinDelegateAuthority}`,
    );

    return {
      claimRecommendation,
      autoApprovalApplies,
      claimDecision,
      withinDelegateAuthority,
    };
  } catch (err) {
    this.logger.warn(
      `${logPrefix} — failed: ${(err as Error).message}`,
    );
    return {};
  }
}
```

### 3. Ensure jobs repository is available in QuotesService

If `QuotesService` doesn't already inject the jobs repository, add it:

```typescript
constructor(
  // ... existing deps
  private readonly jobsRepo: JobsRepository,
) {}
```

And update the module imports if needed.

## Where the Auto-Approval Fields Come From

| Field | Source | Set by |
|-------|--------|--------|
| `claimRecommendation` | `job.customData.claimRecommendation` | User (vendor) sets this before publishing the quote |
| `autoApprovalApplies` | `job.customData.autoApprovalApplies` | Insurer sets this on job allocation (via inbound webhook) |
| `claimDecision` | `job.customData.claimDecision` | Insurer sets this on the claim (via inbound webhook) |
| `delegateAuthorityLimit` | `job.customData.delegateAuthorityLimit` | Insurer's configured limit for the vendor (via inbound webhook) |
| `withinDelegateAuthority` | Computed | quote.totalAmount <= delegateAuthorityLimit |

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/quotes/quotes.service.ts` | claims-manager | Add resolveAutoApprovalContext, pass context to emitQuotePublished |

## Testing

1. Publish a quote where all auto-approval criteria are met → verify the event payload contains all four fields.
2. Publish a quote where `claimRecommendation` is not "Accept" → verify field is present but different.
3. Publish a quote exceeding delegate authority → verify `withinDelegateAuthority` is `false`.
4. Integration: publish a qualifying quote → verify the ASL takes the `AutoApproveQuote` path.
5. Integration: publish a non-qualifying quote → verify the ASL falls through to `WaitForQuoteOutcome`.
