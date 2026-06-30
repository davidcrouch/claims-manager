import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, ParentRef } from './transformer.interface';
import { asString } from './transform-utils';

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
    const parentRefs: ParentRef[] = [];

    const rawScope = asString(payload.scope);
    const cwRecordType = asString(payload.relatedRecordType);
    const scope = (rawScope ?? (cwRecordType ? RECORD_TYPE_TO_SCOPE[cwRecordType] : undefined) ?? '').toLowerCase();

    const relatedRecordType = SCOPE_TO_RECORD_TYPE[scope] ?? (cwRecordType || 'Job');

    const scopeId = asString(payload.scopeId) ?? asString(payload.relatedRecordId);

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
      apiPayload: payload,
    };

    const providerType = SCOPE_TO_ENTITY_TYPE[scope];
    if (providerType && scopeId) {
      parentRefs.push({ entityType: providerType, externalId: scopeId, required: false });
    }

    return { entity, lookups: [], parentRefs };
  }
}
