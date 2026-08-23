import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asNumericString, asTimestamp, isPlainObject } from './transform-utils';

@Injectable()
export class InvoiceTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    // createdBy / updatedBy user references
    const createdByRef = isPlainObject(payload.createdBy) ? asString(payload.createdBy.externalReference) : undefined;
    const updatedByRef = isPlainObject(payload.updatedBy) ? asString(payload.updatedBy.externalReference) : undefined;

    const entity: Record<string, unknown> = {
      tenantId,
      invoiceNumber: asString(payload.invoiceNumber),
      issueDate: asTimestamp(payload.issueDate),
      receivedDate: asTimestamp(payload.receivedDate),
      comments: asString(payload.comments),
      declinedReason: asString(payload.declinedReason),
      subTotal: asNumericString(payload.subTotal),
      totalTax: asNumericString(payload.totalTax),
      totalAmount: asNumericString(payload.totalAmount),
      excessAmount: asNumericString(payload.excessAmount),
      createdByUserId: createdByRef,
      updatedByUserId: updatedByRef,
      invoicePayload: payload,
    };

    // Parent: purchase order (may project as WO) — nested object or flat string.
    // Pass nestedPayload when available so EntityRelationshipService can inline-project.
    const poNested = isPlainObject(payload.purchaseOrder) ? (payload.purchaseOrder as Record<string, unknown>) : undefined;
    const cwPoId = poNested ? asString(poNested.id) : asString(payload.purchaseOrderId);
    if (cwPoId) {
      parentRefs.push({ entityType: 'purchase_order', externalId: cwPoId, required: false, nestedPayload: poNested });
    }

    // Parent: job — nested object or flat string
    const jobNested = isPlainObject(payload.job) ? (payload.job as Record<string, unknown>) : undefined;
    const cwJobId = jobNested ? asString(jobNested.id) : asString(payload.jobId);
    if (cwJobId) {
      parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false, nestedPayload: jobNested });
    }

    // Parent: claim — nested object or flat string
    const claimNested = isPlainObject(payload.claim) ? (payload.claim as Record<string, unknown>) : undefined;
    const cwClaimId = claimNested ? asString(claimNested.id) : asString(payload.claimId);
    if (cwClaimId) {
      parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false, nestedPayload: claimNested });
    }

    // Lookups — status (handle object or bare-string)
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.name) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'invoice_status', externalReference: extRef, name: asString(payload.status.name), autoCreate: true });
    } else if (typeof payload.status === 'string' && payload.status.trim()) {
      lookups.push({ field: 'statusLookupId', domain: 'invoice_status', externalReference: payload.status.trim(), name: payload.status.trim(), autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
