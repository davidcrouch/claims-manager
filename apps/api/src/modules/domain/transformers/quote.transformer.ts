import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import type { QuoteInsert } from '../../../database/repositories';
import { asString, asTimestamp, asNumericString, isPlainObject } from './transform-utils';

@Injectable()
export class QuoteTransformer implements EntityTransformer<QuoteInsert> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: QuoteInsert;
  }): TransformResult<QuoteInsert> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    const entity: Partial<QuoteInsert> = {
      tenantId,
      externalReference: asString(payload.id),
      quoteNumber: asString(payload.quoteNumber),
      name: asString(payload.name),
      reference: asString(payload.reference),
      note: asString(payload.note),
      quoteDate: asTimestamp(payload.date ?? payload.quoteDate),
      expiresInDays: payload.expiresInDays != null ? Number(payload.expiresInDays) : undefined,
      subTotal: asNumericString(payload.subTotal),
      totalTax: asNumericString(payload.totalTax),
      totalAmount: asNumericString(payload.total ?? payload.totalAmount),
      apiPayload: payload,
    };

    // Parents — Crunchwork sends either nested object { id } or flat string field
    const cwJobId = isPlainObject(payload.job)
      ? asString((payload.job as Record<string, unknown>).id)
      : asString(payload.jobId);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false });

    const cwClaimId = isPlainObject(payload.claim)
      ? asString((payload.claim as Record<string, unknown>).id)
      : asString(payload.claimId);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    // Lookups
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'quote_status', externalReference: extRef, autoCreate: true });
    }
    if (isPlainObject(payload.quoteType)) {
      const extRef = asString(payload.quoteType.externalReference) ?? asString(payload.quoteType.id);
      if (extRef) lookups.push({ field: 'quoteTypeLookupId', domain: 'quote_type', externalReference: extRef, autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
