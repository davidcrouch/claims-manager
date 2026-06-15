import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, ParentRef } from './transformer.interface';
import { asString, asBool, isPlainObject } from './transform-utils';

@Injectable()
export class MessageTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const parentRefs: ParentRef[] = [];

    const entity: Record<string, unknown> = {
      tenantId,
      subject: asString(payload.subject),
      body: asString(payload.body),
      acknowledgementRequired: asBool(payload.acknowledgementRequired) ?? false,
      messagePayload: payload,
    };

    // from/to parents
    const fromJobId = isPlainObject(payload.fromJob) ? asString(payload.fromJob.id) : undefined;
    if (fromJobId) parentRefs.push({ entityType: 'fromJob', externalId: fromJobId, required: false });

    const toJobId = isPlainObject(payload.toJob) ? asString(payload.toJob.id) : undefined;
    if (toJobId) parentRefs.push({ entityType: 'toJob', externalId: toJobId, required: false });

    const fromClaimId = isPlainObject(payload.fromClaim) ? asString(payload.fromClaim.id) : undefined;
    if (fromClaimId) parentRefs.push({ entityType: 'fromClaim', externalId: fromClaimId, required: false });

    const toClaimId = isPlainObject(payload.toClaim) ? asString(payload.toClaim.id) : undefined;
    if (toClaimId) parentRefs.push({ entityType: 'toClaim', externalId: toClaimId, required: false });

    return { entity, lookups: [], parentRefs };
  }
}
