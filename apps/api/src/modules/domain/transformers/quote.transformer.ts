import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import type { QuoteInsert } from '../../../database/repositories';
import { asString, asTimestamp, asNumericString, asDateString, asBool, isPlainObject } from './transform-utils';
import { partyBucketsFromCwPayload } from './quote-party-buckets';

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

    // §4 — Party buckets
    const parties = partyBucketsFromCwPayload(payload);
    const qTo = parties.quoteTo;
    const qFor = parties.quoteFor;
    const qFrom = parties.quoteFrom;

    // §6.2 — Schedule info bucket
    const scheduleInfo: Record<string, unknown> = {};
    const estStartDate = asString(payload.estimatedStartDate);
    const estCompDate = asString(payload.estimatedCompletionDate);
    if (estStartDate) scheduleInfo.estimatedStartDate = estStartDate;
    if (estCompDate) scheduleInfo.estimatedCompletionDate = estCompDate;
    const reasonForVariation = asString(payload.reasonForVariation);
    if (reasonForVariation) scheduleInfo.reasonForVariation = reasonForVariation;

    // §6.3 — Approval info bucket
    const approvalInfo: Record<string, unknown> = {};
    if (payload.isAutoApproved != null) approvalInfo.isAutoApproved = asBool(payload.isAutoApproved);
    if (isPlainObject(payload.status)) {
      const st = payload.status as Record<string, unknown>;
      if (st.type) approvalInfo.statusType = asString(st.type);
      if (st.name) approvalInfo.statusName = asString(st.name);
    }
    if (isPlainObject(payload.quoteType)) {
      const qt = payload.quoteType as Record<string, unknown>;
      if (qt.name) approvalInfo.quoteTypeName = asString(qt.name);
    }
    if (isPlainObject(payload.createdBy)) {
      const cb = payload.createdBy as Record<string, unknown>;
      if (cb.name) approvalInfo.createdByName = asString(cb.name);
      if (cb.externalReference) approvalInfo.createdByExternalReference = asString(cb.externalReference);
    }
    if (isPlainObject(payload.updatedBy)) {
      const ub = payload.updatedBy as Record<string, unknown>;
      if (ub.name) approvalInfo.updatedByName = asString(ub.name);
      if (ub.externalReference) approvalInfo.updatedByExternalReference = asString(ub.externalReference);
    }

    // §2 — createdBy / updatedBy user references
    const createdByRef = isPlainObject(payload.createdBy) ? asString(payload.createdBy.externalReference) : undefined;
    const updatedByRef = isPlainObject(payload.updatedBy) ? asString(payload.updatedBy.externalReference) : undefined;

    // §6.4 — Custom data bucket
    const customData: Record<string, unknown> = {};
    if (isPlainObject(payload.customData)) {
      Object.assign(customData, payload.customData);
    }
    const cwExtRef = asString(payload.externalReference);
    if (cwExtRef) customData.cwExternalReference = cwExtRef;
    const cwCreatedAt = asString(payload.createdAtDate);
    if (cwCreatedAt) customData.cwCreatedAtDate = cwCreatedAt;
    const cwUpdatedAt = asString(payload.updatedAtDate);
    if (cwUpdatedAt) customData.cwUpdatedAtDate = cwUpdatedAt;

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
      // §4 — Party buckets + promoted scalars
      quoteTo: Object.keys(qTo).length > 0 ? qTo : {},
      quoteFor: Object.keys(qFor).length > 0 ? qFor : {},
      quoteFrom: Object.keys(qFrom).length > 0 ? qFrom : {},
      quoteToEmail: qTo.email ?? undefined,
      quoteToName: qTo.name ?? undefined,
      quoteForName: qFor.name ?? undefined,
      // §5 — Promoted date columns
      estimatedStartDate: asDateString(payload.estimatedStartDate),
      estimatedCompletionDate: asDateString(payload.estimatedCompletionDate),
      // §5 — Promoted boolean
      isAutoApproved: asBool(payload.isAutoApproved),
      // §6 — JSONB buckets
      scheduleInfo: Object.keys(scheduleInfo).length > 0 ? scheduleInfo : {},
      approvalInfo: Object.keys(approvalInfo).length > 0 ? approvalInfo : {},
      customData: Object.keys(customData).length > 0 ? customData : {},
      // §2 — User references
      createdByUserId: createdByRef ?? undefined,
      updatedByUserId: updatedByRef ?? undefined,
      apiPayload: payload,
    };

    // Parents — Crunchwork sends either nested object { id } or flat string field.
    // Pass nestedPayload when available so EntityRelationshipService can inline-project.
    const jobNested = isPlainObject(payload.job) ? (payload.job as Record<string, unknown>) : undefined;
    const cwJobId = jobNested ? asString(jobNested.id) : asString(payload.jobId);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false, nestedPayload: jobNested });

    const claimNested = isPlainObject(payload.claim) ? (payload.claim as Record<string, unknown>) : undefined;
    const cwClaimId = claimNested ? asString(claimNested.id) : asString(payload.claimId);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false, nestedPayload: claimNested });

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
