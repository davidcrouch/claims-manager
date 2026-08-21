import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asBool, asTimestamp, isPlainObject } from './transform-utils';

@Injectable()
export class MessageTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    // createdBy user reference
    const createdByRef = isPlainObject(payload.createdBy)
      ? asString(payload.createdBy.externalReference)
      : asString(payload.createdByUserId);

    const entity: Record<string, unknown> = {
      tenantId,
      subject: asString(payload.subject),
      body: asString(payload.text) ?? asString(payload.body),
      acknowledgementRequired: asBool(payload.acknowledgementRequired) ?? false,
      acknowledgedAt: asTimestamp(payload.acknowledgedAt),
      acknowledgedByUserId: asString(payload.acknowledgedByUserId),
      toUserId: asString(payload.toUserId),
      createdByUserId: createdByRef,
      messagePayload: payload,
    };

    // from/to parents — CW may send nested objects or direct UUID strings
    const fromJobId = isPlainObject(payload.fromJob)
      ? asString(payload.fromJob.id)
      : asString(payload.fromJobId);
    if (fromJobId) parentRefs.push({ entityType: 'fromJob', externalId: fromJobId, required: false });

    const toJobId = isPlainObject(payload.toJob)
      ? asString(payload.toJob.id)
      : asString(payload.toJobId);
    if (toJobId) parentRefs.push({ entityType: 'toJob', externalId: toJobId, required: false });

    const fromClaimId = isPlainObject(payload.fromClaim)
      ? asString(payload.fromClaim.id)
      : asString(payload.fromClaimId);
    if (fromClaimId) parentRefs.push({ entityType: 'fromClaim', externalId: fromClaimId, required: false });

    const toClaimId = isPlainObject(payload.toClaim)
      ? asString(payload.toClaim.id)
      : asString(payload.toClaimId);
    if (toClaimId) parentRefs.push({ entityType: 'toClaim', externalId: toClaimId, required: false });

    // Lookups — messageType (object or bare-string)
    const msgType = payload.messageType ?? payload.messageTypeLookupId;
    if (isPlainObject(msgType)) {
      const extRef = asString((msgType as Record<string, unknown>).externalReference) ?? asString((msgType as Record<string, unknown>).name) ?? asString((msgType as Record<string, unknown>).id);
      if (extRef) lookups.push({ field: 'messageTypeLookupId', domain: 'message_type', externalReference: extRef, name: asString((msgType as Record<string, unknown>).name), autoCreate: true });
    } else if (typeof msgType === 'string' && msgType.trim()) {
      lookups.push({ field: 'messageTypeLookupId', domain: 'message_type', externalReference: msgType.trim(), name: msgType.trim(), autoCreate: true });
    }

    // Lookups — toAssigneeType (object or bare-string)
    const assigneeType = payload.toAssigneeType ?? payload.toAssigneeTypeLookupId;
    if (isPlainObject(assigneeType)) {
      const extRef = asString((assigneeType as Record<string, unknown>).externalReference) ?? asString((assigneeType as Record<string, unknown>).name) ?? asString((assigneeType as Record<string, unknown>).id);
      if (extRef) lookups.push({ field: 'toAssigneeTypeLookupId', domain: 'assignee_type', externalReference: extRef, name: asString((assigneeType as Record<string, unknown>).name), autoCreate: true });
    } else if (typeof assigneeType === 'string' && assigneeType.trim()) {
      lookups.push({ field: 'toAssigneeTypeLookupId', domain: 'assignee_type', externalReference: assigneeType.trim(), name: assigneeType.trim(), autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
