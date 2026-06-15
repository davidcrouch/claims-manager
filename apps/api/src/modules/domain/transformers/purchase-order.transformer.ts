import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, isPlainObject } from './transform-utils';

@Injectable()
export class PurchaseOrderTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    const entity: Record<string, unknown> = {
      tenantId,
      externalId: asString(payload.id),
      purchaseOrderNumber: asString(payload.purchaseOrderNumber),
      name: asString(payload.name),
      note: asString(payload.note),
      startDate: asString(payload.startDate),
      endDate: asString(payload.endDate),
      poTo: isPlainObject(payload.poTo) ? payload.poTo : {},
      poFor: isPlainObject(payload.poFor) ? payload.poFor : {},
      poFrom: isPlainObject(payload.poFrom) ? payload.poFrom : {},
      totalAmount: asString(payload.totalAmount),
      adjustedTotal: asString(payload.adjustedTotal),
      purchaseOrderPayload: payload,
    };

    // Parents
    const cwJobId = isPlainObject(payload.job) ? asString(payload.job.id) : undefined;
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false });

    const cwClaimId = isPlainObject(payload.claim) ? asString(payload.claim.id) : undefined;
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    // Lookups
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'purchase_order_status', externalReference: extRef, autoCreate: true });
    }
    if (isPlainObject(payload.purchaseOrderType)) {
      const extRef = asString(payload.purchaseOrderType.externalReference) ?? asString(payload.purchaseOrderType.id);
      if (extRef) lookups.push({ field: 'purchaseOrderTypeLookupId', domain: 'purchase_order_type', externalReference: extRef, autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
