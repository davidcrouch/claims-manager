import { Injectable } from '@nestjs/common';
import type {
  EntityTransformer,
  TransformResult,
  LookupRequest,
  ParentRef,
  RawContact,
} from './transformer.interface';
import type { JobInsert } from '../../../database/repositories';
import {
  asString,
  asBool,
  asDateString,
  isPlainObject,
  extractObject,
} from './transform-utils';

@Injectable()
export class JobTransformer implements EntityTransformer<JobInsert> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: JobInsert;
  }): TransformResult<JobInsert> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];
    const contacts: RawContact[] = [];

    if (!payload.id) {
      return {
        entity: {},
        lookups: [],
        parentRefs: [],
        skip: 'payload.id is missing — not a valid job object',
      };
    }

    const entity: Partial<JobInsert> = {
      tenantId,
      externalReference: asString(payload.externalReference) ?? asString(payload.id),
      requestDate: asDateString(payload.requestDate),
      collectExcess: asBool(payload.collectExcess),
      excess: asString(payload.excess),
      makeSafeRequired: asBool(payload.makeSafeRequired),
      jobInstructions: asString(payload.instructions),
      apiPayload: payload,
      customData: isPlainObject(payload.customData)
        ? (payload.customData as Record<string, unknown>)
        : {},
    };

    // ── Address ─────────────────────────────────────────────────────
    const address = payload.address ?? payload.siteAddress;
    if (isPlainObject(address)) {
      entity.address = address;
      entity.addressPostcode = asString(address.postcode);
      entity.addressSuburb = asString(address.suburb);
      entity.addressState = asString(address.state);
      entity.addressCountry = asString(address.country);
    }

    // ── Parent: Claim (required) ────────────────────────────────────
    const nestedClaim = isPlainObject(payload.claim)
      ? (payload.claim as Record<string, unknown>)
      : undefined;
    const cwClaimId = asString(payload.claimId) ?? (nestedClaim ? asString(nestedClaim.id) : undefined);
    if (cwClaimId) {
      parentRefs.push({
        entityType: 'claim',
        externalId: cwClaimId,
        required: true,
        nestedPayload: nestedClaim,
      });
    }

    // ── Parent: Vendor (optional) ───────────────────────────────────
    const cwVendor = isPlainObject(payload.vendor) ? payload.vendor : undefined;
    if (cwVendor?.id) {
      parentRefs.push({
        entityType: 'vendor',
        externalId: asString(cwVendor.id)!,
        required: false,
      });
    }

    // ── Lookups ─────────────────────────────────────────────────────
    const jobType = payload.jobType ?? payload.type;
    if (isPlainObject(jobType)) {
      const extRef = asString(jobType.externalReference) ?? asString(jobType.id);
      if (extRef) {
        lookups.push({
          field: 'jobTypeLookupId',
          domain: 'job_type',
          externalReference: extRef,
          name: asString(jobType.name),
          autoCreate: true,
        });
      }
    }

    if (isPlainObject(payload.status)) {
      const extRef = asString((payload.status as Record<string, unknown>).externalReference)
        ?? asString((payload.status as Record<string, unknown>).id);
      if (extRef) {
        lookups.push({
          field: 'statusLookupId',
          domain: 'job_status',
          externalReference: extRef,
          name: asString((payload.status as Record<string, unknown>).name),
          autoCreate: true,
        });
      }
    }

    // ── Contacts ────────────────────────────────────────────────────
    if (Array.isArray(payload.contacts)) {
      for (const entry of payload.contacts) {
        if (!isPlainObject(entry)) continue;
        const extRef = asString(entry.externalReference);
        if (!extRef) continue;
        contacts.push({
          externalReference: extRef,
          firstName: asString(entry.firstName),
          lastName: asString(entry.lastName),
          email: asString(entry.email),
          mobilePhone: asString(entry.mobilePhone),
          homePhone: asString(entry.homePhone),
          workPhone: asString(entry.workPhone),
          typeDomain: 'contact_type',
          typeField: entry.type,
          typeExternalReference: isPlainObject(entry.type)
            ? asString(entry.type.externalReference)
            : undefined,
          preferredMethodDomain: 'contact_method',
          preferredMethodField: entry.preferredMethodOfContact,
          preferredMethodExternalReference: isPlainObject(entry.preferredMethodOfContact)
            ? asString((entry.preferredMethodOfContact as Record<string, unknown>).externalReference)
            : undefined,
          sourcePayload: entry,
        });
      }
    }

    // ── JSONB blocks ────────────────────────────────────────────────
    entity.vendorSnapshot = extractObject(payload, 'vendor') ?? {};
    entity.temporaryAccommodationDetails = extractObject(payload, 'temporaryAccommodation') ?? {};
    entity.specialistDetails = extractObject(payload, 'specialist') ?? {};
    entity.rectificationDetails = extractObject(payload, 'rectification') ?? {};
    entity.auditDetails = extractObject(payload, 'audit') ?? {};
    entity.mobilityConsiderations = payload.mobilityConsiderations ?? [];

    return {
      entity,
      lookups,
      parentRefs,
      contacts: contacts.length > 0 ? contacts : undefined,
    };
  }
}
