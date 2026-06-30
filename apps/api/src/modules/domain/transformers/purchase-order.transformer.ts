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
      workOrderNumber: asString(payload.purchaseOrderNumber),
      name: asString(payload.name),
      note: asString(payload.note),
      startDate: asString(payload.startDate),
      endDate: asString(payload.endDate),
      woTo: isPlainObject(payload.poTo) ? payload.poTo : {},
      woFor: isPlainObject(payload.poFor) ? payload.poFor : {},
      woFrom: isPlainObject(payload.poFrom) ? payload.poFrom : {},
      totalAmount: asString(payload.totalAmount),
      adjustedTotal: asString(payload.adjustedTotal),
      workOrderPayload: payload,
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

    const cwVendor = isPlainObject(payload.vendor) ? payload.vendor : undefined;
    if (cwVendor && (cwVendor.id || cwVendor.externalReference)) {
      parentRefs.push({
        entityType: 'vendor',
        externalId: asString(cwVendor.id) ?? asString(cwVendor.externalReference)!,
        required: false,
        nestedPayload: cwVendor,
      });
    }

    // Lookups
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'work_order_status', externalReference: extRef, autoCreate: true });
    }
    if (isPlainObject(payload.purchaseOrderType)) {
      const extRef = asString(payload.purchaseOrderType.externalReference) ?? asString(payload.purchaseOrderType.id);
      if (extRef) lookups.push({ field: 'workOrderTypeLookupId', domain: 'work_order_type', externalReference: extRef, autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
