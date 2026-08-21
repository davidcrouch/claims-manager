# 54d — Quote Type in Event Payload

**Gap addressed:** G5 (`quoteType` not passed in `quote.published` event payload)

## Problem

The make-safe ASL has a `WaitForCompletionAndInvoice` state that listens for variation quotes:

```json
"WaitForCompletionAndInvoice": {
  "Type": "WaitForEvent",
  "EventPatterns": [
    {
      "eventType": "purchase_order.completed",
      "Next": "CheckJobCompletion"
    },
    {
      "eventType": "quote.published",
      "filter": { "quoteType": "variation" },
      "Next": "WaitForVariationOutcome"
    }
  ]
}
```

The `OutboundEventsService.emitQuotePublished` method accepts an optional `quoteType` parameter:

```typescript
async emitQuotePublished(params: {
  quoteId: string;
  jobId: string;
  tenantId: string;
  publishedAt: string;
  quoteType?: string;       // ← accepted but never passed
  // ...auto-approval fields...
}): Promise<void> { ... }
```

However, `QuotesService.publish` does not pass the quote's type when emitting. The `quoteType` field in the event payload is always `undefined`, so the ASL filter `{ "quoteType": "variation" }` never matches.

## Solution

### 1. Pass `quoteType` when emitting `quote.published`

**File:** `apps/api/src/modules/quotes/quotes.service.ts`
**Method:** `publish` (both external and direct paths)

Resolve the quote's type before emitting the event. The quote type can come from:
- A `typeLookupId` on the quote row, resolved to a lookup name
- A `type` or `quoteType` field in the quote's data
- The quote's relationship to an existing PO (variation vs original)

Determine the type and pass it:

```typescript
if (this.outboundEvents && existing.jobId) {
  const quoteType = await this.resolveQuoteType({
    quoteId: params.id,
    tenantId,
  });

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
    quoteType,                    // ← NEW
    ...autoApprovalContext,
  }).catch(() => {});
}
```

### 2. Add `resolveQuoteType` helper

```typescript
private async resolveQuoteType(params: {
  quoteId: string;
  tenantId: string;
}): Promise<string | undefined> {
  const logPrefix = 'QuotesService.resolveQuoteType';
  try {
    const quote = await this.quotesRepo.findOne({
      id: params.quoteId,
      tenantId: params.tenantId,
    });
    if (!quote) return undefined;

    // Check for type lookup
    if (quote.typeLookupId) {
      const lookupMap = await this.lookupsRepo.findByIds({
        ids: [quote.typeLookupId],
        tenantId: params.tenantId,
      });
      const lookup = lookupMap.get(quote.typeLookupId);
      if (lookup?.name) {
        return lookup.name.toLowerCase();
      }
    }

    // Fallback: if the quote has a parentQuoteId, it's a variation
    if (quote.parentQuoteId) {
      return 'variation';
    }

    return 'original';
  } catch (err) {
    this.logger.warn(
      `${logPrefix} — failed: ${(err as Error).message}`,
    );
    return undefined;
  }
}
```

### 3. Verify ASL filter matching

The more0-ensure `WaitForEvent` handler matches filters against `event.payload`. Ensure the filter `{ "quoteType": "variation" }` is a simple string equality check against `payload.quoteType`. If the engine uses `===` comparison, the value must be `"variation"` exactly (lowercase).

## Files Changed

| File | Repo | Change |
|------|------|--------|
| `apps/api/src/modules/quotes/quotes.service.ts` | claims-manager | Add `resolveQuoteType`, pass `quoteType` in event |

## Testing

1. Publish an original quote → verify event payload contains `quoteType: "original"`.
2. Publish a variation quote (one with `parentQuoteId` set) → verify `quoteType: "variation"`.
3. Integration: in a make-safe workflow at `WaitForCompletionAndInvoice`, publish a variation → verify ASL transitions to `WaitForVariationOutcome`.
4. Publish a non-variation quote at the same stage → verify ASL does NOT match the variation filter (event is ignored or unmatched).
