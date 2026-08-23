import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asNumericString, isPlainObject } from './transform-utils';

// ── Party-bucket helpers ────────────────────────────────────────────
// CW sends party info as flat top-level keys (toName, forEmail, etc.).
// We collect them into structured JSONB buckets.

const TO_FIELDS: [string, string][] = [
  ['toName', 'name'],
  ['toCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['toContactName', 'contactName'],
  ['toInvoiceNumber', 'invoiceNumber'],
  ['toPhoneNumber', 'phoneNumber'],
  ['toEmail', 'email'],
  ['toUnitNumber', 'unitNumber'],
  ['toStreetNumber', 'streetNumber'],
  ['toStreetName', 'streetName'],
  ['toSuburb', 'suburb'],
  ['toPostCode', 'postCode'],
  ['toState', 'state'],
  ['toCountry', 'country'],
];

const FOR_FIELDS: [string, string][] = [
  ['forName', 'name'],
  ['forCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['forContactName', 'contactName'],
  ['forInvoiceNumber', 'invoiceNumber'],
  ['forPhoneNumber', 'phoneNumber'],
  ['forEmail', 'email'],
  ['forUnitNumber', 'unitNumber'],
  ['forStreetNumber', 'streetNumber'],
  ['forStreetName', 'streetName'],
  ['forSuburb', 'suburb'],
  ['forPostCode', 'postCode'],
  ['forState', 'state'],
  ['forCountry', 'country'],
];

const FROM_FIELDS: [string, string][] = [
  ['fromName', 'name'],
  ['fromCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['fromContactName', 'contactName'],
  ['fromPhoneNumber', 'phoneNumber'],
  ['fromEmail', 'email'],
  ['fromUnitNumber', 'unitNumber'],
  ['fromStreetNumber', 'streetNumber'],
  ['fromStreetName', 'streetName'],
  ['fromSuburb', 'suburb'],
  ['fromPostCode', 'postCode'],
  ['fromState', 'state'],
  ['fromCountry', 'country'],
];

function collectPartyBucket(
  payload: Record<string, unknown>,
  mapping: [string, string][],
): Record<string, string> {
  const bucket: Record<string, string> = {};
  for (const [cwKey, jsonbKey] of mapping) {
    const v = asString(payload[cwKey]);
    if (v) bucket[jsonbKey] = v;
  }
  return bucket;
}

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

    // §6 — Party buckets: prefer flat CW keys; fall back to nested objects
    const woTo = collectPartyBucket(payload, TO_FIELDS);
    const woFor = collectPartyBucket(payload, FOR_FIELDS);
    const woFrom = collectPartyBucket(payload, FROM_FIELDS);

    // §5 — Service window bucket
    const serviceWindow: Record<string, unknown> = {};
    const startDate = asString(payload.startDate);
    const endDate = asString(payload.endDate);
    const startTime = asString(payload.startTime);
    const endTime = asString(payload.endTime);
    if (startDate) serviceWindow.startDate = startDate;
    if (endDate) serviceWindow.endDate = endDate;
    if (startTime) serviceWindow.startTime = startTime;
    if (endTime) serviceWindow.endTime = endTime;
    if (payload.expiresInDays != null) serviceWindow.expiresInDays = payload.expiresInDays;

    // §8.1 — Adjustment info bucket
    const adjustedTotal = asNumericString(payload.adjustedTotal);
    const adjustedTotalAdj = asNumericString(payload.adjustedTotalAdjustmentAmount);
    const adjustmentInfo: Record<string, unknown> = {};
    if (adjustedTotal) adjustmentInfo.adjustedTotal = adjustedTotal;
    if (adjustedTotalAdj) adjustmentInfo.adjustedTotalAdjustmentAmount = adjustedTotalAdj;

    // §8.2 — Allocation context bucket
    const allocationContext: Record<string, unknown> = {};
    if (payload.vendorAllocationJobTypeId) allocationContext.vendorAllocationJobTypeId = payload.vendorAllocationJobTypeId;
    if (payload.vendorAllocationReportTypeId) allocationContext.vendorAllocationReportTypeId = payload.vendorAllocationReportTypeId;
    if (payload.quoteRevisionId) allocationContext.quoteRevisionId = payload.quoteRevisionId;
    if (payload.expiresInDays != null) allocationContext.expiresInDays = payload.expiresInDays;

    // §2 — createdBy / updatedBy user references
    const createdByRef = isPlainObject(payload.createdBy) ? asString(payload.createdBy.externalReference) : undefined;
    const updatedByRef = isPlainObject(payload.updatedBy) ? asString(payload.updatedBy.externalReference) : undefined;

    const entity: Record<string, unknown> = {
      tenantId,
      // §2 — externalId is the insurer's own PO reference, NOT the CW UUID
      externalId: asString(payload.externalId) ?? asString(payload.id),
      workOrderNumber: asString(payload.purchaseOrderNumber),
      name: asString(payload.name),
      note: asString(payload.note),
      // §5 — Dates/times
      startDate,
      endDate,
      startTime: startTime ?? undefined,
      endTime: endTime ?? undefined,
      serviceWindow: Object.keys(serviceWindow).length > 0 ? serviceWindow : {},
      // §6 — Party buckets + promoted scalars
      woTo: Object.keys(woTo).length > 0 ? woTo : (isPlainObject(payload.poTo) ? payload.poTo : {}),
      woFor: Object.keys(woFor).length > 0 ? woFor : (isPlainObject(payload.poFor) ? payload.poFor : {}),
      woFrom: Object.keys(woFrom).length > 0 ? woFrom : (isPlainObject(payload.poFrom) ? payload.poFrom : {}),
      woToEmail: woTo.email ?? undefined,
      woForName: woFor.name ?? undefined,
      // §7 — Promoted scalars (CW field is `total`, not `totalAmount`)
      totalAmount: asNumericString(payload.total) ?? asNumericString(payload.totalAmount),
      adjustedTotal,
      adjustedTotalAdjustmentAmount: adjustedTotalAdj,
      // §8 — JSONB buckets
      adjustmentInfo: Object.keys(adjustmentInfo).length > 0 ? adjustmentInfo : {},
      allocationContext: Object.keys(allocationContext).length > 0 ? allocationContext : {},
      // §2 — User references
      createdByUserId: createdByRef ?? undefined,
      updatedByUserId: updatedByRef ?? undefined,
      // Lossless payload
      workOrderPayload: payload,
    };

    // §3 — Parents: Crunchwork sends either nested object { id } or flat string field.
    // Pass nestedPayload when available so EntityRelationshipService can inline-project.
    const jobNested = isPlainObject(payload.job) ? (payload.job as Record<string, unknown>) : undefined;
    const cwJobId = jobNested ? asString(jobNested.id) : asString(payload.jobId);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false, nestedPayload: jobNested });

    const claimNested = isPlainObject(payload.claim) ? (payload.claim as Record<string, unknown>) : undefined;
    const cwClaimId = claimNested ? asString(claimNested.id) : asString(payload.claimId);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false, nestedPayload: claimNested });

    const cwVendor = isPlainObject(payload.vendor) ? payload.vendor : undefined;
    if (cwVendor && (cwVendor.id || cwVendor.externalReference)) {
      parentRefs.push({
        entityType: 'vendor',
        externalId: asString(cwVendor.id) ?? asString(cwVendor.externalReference)!,
        required: false,
        nestedPayload: cwVendor,
      });
    }

    // §3 — Quote parent
    const cwQuoteId = asString(payload.quoteRevisionId);
    if (cwQuoteId) parentRefs.push({ entityType: 'quote', externalId: cwQuoteId, required: false });

    // §4 — Lookups (handle both object and bare-string forms)
    if (isPlainObject(payload.status)) {
      const extRef = asString(payload.status.externalReference) ?? asString(payload.status.name) ?? asString(payload.status.id);
      if (extRef) lookups.push({ field: 'statusLookupId', domain: 'purchase_order_status', externalReference: extRef, name: asString(payload.status.name), autoCreate: true });
    } else if (typeof payload.status === 'string' && payload.status.trim()) {
      lookups.push({ field: 'statusLookupId', domain: 'purchase_order_status', externalReference: payload.status.trim(), name: payload.status.trim(), autoCreate: true });
    }

    if (isPlainObject(payload.purchaseOrderType)) {
      const extRef = asString(payload.purchaseOrderType.externalReference) ?? asString(payload.purchaseOrderType.name) ?? asString(payload.purchaseOrderType.id);
      if (extRef) lookups.push({ field: 'workOrderTypeLookupId', domain: 'purchase_order_type', externalReference: extRef, name: asString(payload.purchaseOrderType.name), autoCreate: true });
    } else if (typeof payload.purchaseOrderType === 'string' && payload.purchaseOrderType.trim()) {
      lookups.push({ field: 'workOrderTypeLookupId', domain: 'purchase_order_type', externalReference: payload.purchaseOrderType.trim(), name: payload.purchaseOrderType.trim(), autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
