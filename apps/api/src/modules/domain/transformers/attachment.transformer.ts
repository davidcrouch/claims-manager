import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asTimestamp, isPlainObject } from './transform-utils';

const SCOPE_TO_RECORD_TYPE: Record<string, string> = {
  job: 'Job', claim: 'Claim', quote: 'Quote',
  purchase_order: 'PurchaseOrder', report: 'Report', invoice: 'Invoice',
};

const RECORD_TYPE_TO_SCOPE: Record<string, string> = {
  Job: 'job', Claim: 'claim', Quote: 'quote',
  PurchaseOrder: 'purchase_order', Report: 'report', Invoice: 'invoice',
};

const SCOPE_TO_ENTITY_TYPE: Record<string, string> = {
  job: 'job', claim: 'claim', quote: 'quote',
  purchase_order: 'purchase_order', report: 'report',
};

@Injectable()
export class AttachmentTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    const rawScope = asString(payload.scope);
    const cwRecordType = asString(payload.relatedRecordType);
    const scope = (rawScope ?? (cwRecordType ? RECORD_TYPE_TO_SCOPE[cwRecordType] : undefined) ?? '').toLowerCase();

    const relatedRecordType = SCOPE_TO_RECORD_TYPE[scope] ?? (cwRecordType || 'Job');

    const scopeId = asString(payload.scopeId) ?? asString(payload.relatedRecordId);

    // createdBy user reference
    const createdByRef = isPlainObject(payload.createdBy)
      ? asString(payload.createdBy.externalReference)
      : asString(payload.createdByUserId);

    // attachmentMeta bucket — fields without dedicated columns
    const attachmentMeta: Record<string, unknown> = {};
    const uploadedAt = asTimestamp(payload.uploadedAt);
    if (uploadedAt) attachmentMeta.uploadedAt = uploadedAt;
    const category = asString(payload.category);
    if (category) attachmentMeta.category = category;
    if (Array.isArray(payload.tags)) attachmentMeta.tags = payload.tags.filter((t): t is string => typeof t === 'string');

    const entity: Record<string, unknown> = {
      tenantId,
      relatedRecordType,
      title: asString(payload.title) ?? asString(payload.fileName),
      description: asString(payload.description),
      fileName: asString(payload.fileName),
      mimeType: asString(payload.mimeType),
      fileSize: typeof payload.fileSize === 'number' ? payload.fileSize : undefined,
      storageProvider: 'crunchwork',
      fileUrl: asString(payload.downloadUrl) ?? asString(payload.fileUrl),
      createdByUserId: createdByRef,
      attachmentMeta: Object.keys(attachmentMeta).length > 0 ? attachmentMeta : {},
      apiPayload: payload,
    };

    // Lookups — documentType / category (object or bare-string)
    const docType = payload.documentType ?? payload.documentCategory;
    if (isPlainObject(docType)) {
      const extRef = asString((docType as Record<string, unknown>).externalReference) ?? asString((docType as Record<string, unknown>).name) ?? asString((docType as Record<string, unknown>).id);
      if (extRef) lookups.push({ field: 'documentTypeLookupId', domain: 'document_type', externalReference: extRef, name: asString((docType as Record<string, unknown>).name), autoCreate: true });
    } else if (typeof docType === 'string' && docType.trim()) {
      lookups.push({ field: 'documentTypeLookupId', domain: 'document_type', externalReference: docType.trim(), name: docType.trim(), autoCreate: true });
    }

    const providerType = SCOPE_TO_ENTITY_TYPE[scope];
    if (providerType && scopeId) {
      parentRefs.push({ entityType: providerType, externalId: scopeId, required: false });
    }

    return { entity, lookups, parentRefs };
  }
}
