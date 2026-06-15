import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, ParentRef } from './transformer.interface';
import { asString, isPlainObject } from './transform-utils';

@Injectable()
export class ReportTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const parentRefs: ParentRef[] = [];

    const entity: Record<string, unknown> = {
      tenantId,
      title: asString(payload.title),
      reference: asString(payload.reference),
      reportData: payload,
      apiPayload: payload,
    };

    const cwJobId = isPlainObject(payload.job) ? asString(payload.job.id) : undefined;
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false });

    const cwClaimId = isPlainObject(payload.claim) ? asString(payload.claim.id) : undefined;
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    return { entity, lookups: [], parentRefs };
  }
}
