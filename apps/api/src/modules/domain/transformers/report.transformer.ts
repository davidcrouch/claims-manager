import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asTimestamp, isPlainObject } from './transform-utils';

@Injectable()
export class ReportTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    // reportMeta bucket for fields without dedicated columns
    const reportMeta: Record<string, unknown> = {};
    const summary = asString(payload.summary);
    if (summary) reportMeta.summary = summary;
    const publishedAt = asTimestamp(payload.publishedAt);
    if (publishedAt) reportMeta.publishedAt = publishedAt;
    if (Array.isArray(payload.sections)) reportMeta.sections = payload.sections;
    if (Array.isArray(payload.attachments)) reportMeta.attachments = payload.attachments;
    if (Array.isArray(payload.signatories)) reportMeta.signatories = payload.signatories;

    // createdBy / updatedBy user references
    const createdByRef = isPlainObject(payload.createdBy) ? asString(payload.createdBy.externalReference) : undefined;
    const updatedByRef = isPlainObject(payload.updatedBy) ? asString(payload.updatedBy.externalReference) : undefined;

    const entity: Record<string, unknown> = {
      tenantId,
      title: asString(payload.title),
      reference: asString(payload.reference),
      reportMeta: Object.keys(reportMeta).length > 0 ? reportMeta : {},
      createdByUserId: createdByRef,
      updatedByUserId: updatedByRef,
      reportData: payload,
      apiPayload: payload,
    };

    // Parent: job — nested object or flat string
    const cwJobId = isPlainObject(payload.job)
      ? asString((payload.job as Record<string, unknown>).id)
      : asString(payload.jobId);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false });

    // Parent: claim — nested object or flat string
    const cwClaimId = isPlainObject(payload.claim)
      ? asString((payload.claim as Record<string, unknown>).id)
      : asString(payload.claimId);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    // Lookups — reportType (object or bare-string)
    if (isPlainObject(payload.reportType)) {
      const extRef = asString(payload.reportType.externalReference) ?? asString(payload.reportType.name) ?? asString(payload.reportType.id);
      if (extRef) lookups.push({ field: 'reportTypeLookupId', domain: 'report_type', externalReference: extRef, name: asString(payload.reportType.name), autoCreate: true });
    } else if (typeof payload.reportType === 'string' && payload.reportType.trim()) {
      lookups.push({ field: 'reportTypeLookupId', domain: 'report_type', externalReference: payload.reportType.trim(), name: payload.reportType.trim(), autoCreate: true });
    }

    // Lookups — status (object or bare-string)
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.name) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'report_status', externalReference: extRef, name: asString(payload.status.name), autoCreate: true });
    } else if (typeof payload.status === 'string' && payload.status.trim()) {
      lookups.push({ field: 'statusLookupId', domain: 'report_status', externalReference: payload.status.trim(), name: payload.status.trim(), autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
