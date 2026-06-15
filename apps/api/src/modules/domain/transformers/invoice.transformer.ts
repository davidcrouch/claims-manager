import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asTimestamp, isPlainObject } from './transform-utils';

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

    const entity: Record<string, unknown> = {
      tenantId,
      invoiceNumber: asString(payload.invoiceNumber),
      issueDate: asTimestamp(payload.issueDate),
      receivedDate: asTimestamp(payload.receivedDate),
      comments: asString(payload.comments),
      subTotal: asString(payload.subTotal),
      totalTax: asString(payload.totalTax),
      totalAmount: asString(payload.totalAmount),
      excessAmount: asString(payload.excessAmount),
      invoicePayload: payload,
    };

    // Parent: purchase_order (required for invoices)
    const cwPoId = isPlainObject(payload.purchaseOrder) ? asString(payload.purchaseOrder.id) : undefined;
    if (cwPoId) parentRefs.push({ entityType: 'purchase_order', externalId: cwPoId, required: true });

    // Lookups
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'invoice_status', externalReference: extRef, autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
