import { Injectable } from '@nestjs/common';
import type {
  EntityTransformer,
  TransformResult,
  LookupRequest,
  ParentRef,
  RawContact,
  RawAssignee,
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
    const assignees: RawAssignee[] = [];

    if (!payload.id) {
      return {
        entity: {},
        lookups: [],
        parentRefs: [],
        skip: 'payload.id is missing — not a valid job object',
      };
    }

    // ── custom_data: merge CW customData + promoted CW fields + unknown keys
    const customData: Record<string, unknown> = {
      ...(isPlainObject(payload.customData) ? (payload.customData as Record<string, unknown>) : {}),
    };

    if (payload.updatedAtDate !== undefined) customData.cwUpdatedAtDate = payload.updatedAtDate;
    if (payload.createdAtDate !== undefined) customData.cwCreatedAtDate = payload.createdAtDate;
    if (asString(payload.externalReference)) customData.insurerExternalReference = asString(payload.externalReference);
    if (payload.estimatedStartDate !== undefined) customData.estimatedStartDate = payload.estimatedStartDate;
    if (payload.estimatedCompletionDate !== undefined) customData.estimatedCompletionDate = payload.estimatedCompletionDate;
    if (payload.estimatedDeliveryDate !== undefined) customData.estimatedDeliveryDate = payload.estimatedDeliveryDate;
    if (payload.claimRecommendation !== undefined) customData.claimRecommendation = payload.claimRecommendation;
    if (payload.approvalLimitApplicable !== undefined) customData.approvalLimitApplicable = payload.approvalLimitApplicable;
    if (asString(payload.internalAllocatedVendorJobId)) customData.internalAllocatedVendorJobId = asString(payload.internalAllocatedVendorJobId);
    if (asString(payload.internalAllocatedVendorJobReference)) customData.internalAllocatedVendorJobReference = asString(payload.internalAllocatedVendorJobReference);
    if (payload.lastSubmissionDate !== undefined) customData.lastSubmissionDate = payload.lastSubmissionDate;
    if (payload.firstSubmissionDate !== undefined) customData.firstSubmissionDate = payload.firstSubmissionDate;
    if (asString(payload.reference)) customData.reference = asString(payload.reference);

    this.collectUnknownKeys(payload, customData);

    const entity: Partial<JobInsert> = {
      tenantId,
      externalReference: asString(payload.id),
      externalJobId: asString(payload.externalReference),
      requestDate: asDateString(payload.requestDate),
      collectExcess: asBool(payload.collectExcess),
      excess: asString(payload.excess),
      makeSafeRequired: asBool(payload.makeSafeRequired),
      jobInstructions: asString(payload.jobInstructions) ?? asString(payload.instructions),
      apiPayload: payload,
      customData,
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

    // ── parentClaimId (vendor allocation hierarchy) ─
    // Resolved in the use case via external_links lookup against 'claim' entity type.
    // Stored on entity.customData so the use case can extract and resolve it.
    const cwParentClaimId = asString(payload.parentClaimId);
    if (cwParentClaimId) {
      customData.cwParentClaimId = cwParentClaimId;
    }

    // ── Parent: Vendor (optional) ───────────────────────────────────
    const cwVendor = isPlainObject(payload.vendor) ? payload.vendor : undefined;
    if (cwVendor?.id) {
      parentRefs.push({
        entityType: 'vendor',
        externalId: asString(cwVendor.id)!,
        required: false,
        nestedPayload: cwVendor,
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
        const extRef = asString(entry.externalReference) ?? asString(entry.id);
        const firstName = asString(entry.firstName);
        const lastName = asString(entry.lastName);
        const email = asString(entry.email);
        const mobilePhone = asString(entry.mobilePhone);
        const homePhone = asString(entry.homePhone);
        const workPhone = asString(entry.workPhone);
        if (
          !extRef &&
          !email &&
          !mobilePhone &&
          !homePhone &&
          !workPhone &&
          !(firstName && lastName)
        ) {
          continue;
        }
        contacts.push({
          externalReference: extRef ?? undefined,
          firstName,
          lastName,
          email,
          mobilePhone,
          homePhone,
          workPhone,
          notes: asString(entry.notes),
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

    // ── Assignees ───────────────────────────────────────────────────
    if (Array.isArray(payload.assignees)) {
      for (const entry of payload.assignees) {
        if (!isPlainObject(entry)) continue;
        const extRef = asString(entry.externalReference) ?? asString(entry.id);
        if (!extRef) continue;
        assignees.push({
          externalReference: extRef,
          displayName: asString(entry.name) ?? asString(entry.displayName),
          email: asString(entry.email),
          assigneeTypeDomain: 'assignee_type',
          assigneeTypeField: entry.type,
          assigneeTypeExternalReference: isPlainObject(entry.type)
            ? asString(entry.type.externalReference)
            : undefined,
          sourcePayload: entry,
        });
      }
    }

    // ── JSONB blocks ────────────────────────────────────────────────
    entity.vendorSnapshot = extractObject(payload, 'vendor') ?? {};

    entity.temporaryAccommodationDetails = this.buildTemporaryAccommodation(payload);
    entity.specialistDetails = this.buildSpecialistDetails(payload);
    entity.rectificationDetails = this.buildRectificationDetails(payload);
    entity.auditDetails = this.buildAuditDetails(payload);
    entity.mobilityConsiderations = this.buildMobilityConsiderations(payload);

    return {
      entity,
      lookups,
      parentRefs,
      contacts: contacts.length > 0 ? contacts : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
    };
  }

  private buildTemporaryAccommodation(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    const keys = [
      'emergency',
      'habitableProperty',
      'estimatedStayStartDate',
      'estimatedStayEndDate',
      'numberOfAdults',
      'numberOfChildren',
      'numberOfBedrooms',
      'numberOfCots',
      'numberOfVehicles',
      'petsInformation',
    ] as const;
    for (const key of keys) {
      if (payload[key] !== undefined) out[key] = payload[key];
    }
    return out;
  }

  private buildSpecialistDetails(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (payload.isSpecificSpecialistRequired !== undefined) {
      out.isSpecificSpecialistRequired = payload.isSpecificSpecialistRequired;
    }
    if (payload.specialistCategory !== undefined) {
      out.specialistCategory = payload.specialistCategory;
    }
    if (payload.specialistReport !== undefined) {
      out.specialistReport = payload.specialistReport;
    }
    if (payload.specialistBusinessName !== undefined) {
      out.specialistBusinessName = payload.specialistBusinessName;
    }
    if (payload.locationOfDamage !== undefined) {
      out.locationOfDamage = payload.locationOfDamage;
    }
    if (payload.typeOfDamage !== undefined) {
      out.typeOfDamage = payload.typeOfDamage;
    }
    return out;
  }

  private buildRectificationDetails(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (payload.originalJobReference !== undefined) {
      out.originalJobReference = payload.originalJobReference;
    }
    if (payload.originalJobType !== undefined) {
      out.originalJobType = payload.originalJobType;
    }
    if (payload.paidJob !== undefined) {
      out.paidJob = payload.paidJob;
    }
    return out;
  }

  private buildAuditDetails(
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (payload.auditType !== undefined) {
      out.auditType = payload.auditType;
    }
    return out;
  }

  private buildMobilityConsiderations(
    payload: Record<string, unknown>,
  ): Array<{ name?: string; externalReference?: string }> {
    const raw = payload.mobilityConsiderations;
    if (!Array.isArray(raw)) return [];
    const out: Array<{ name?: string; externalReference?: string }> = [];
    for (const entry of raw) {
      if (!isPlainObject(entry)) continue;
      const name = asString(entry.name) ?? undefined;
      const externalReference = asString(entry.externalReference) ?? undefined;
      if (name || externalReference) {
        out.push({ name, externalReference });
      }
    }
    return out;
  }

  private collectUnknownKeys(
    payload: Record<string, unknown>,
    customData: Record<string, unknown>,
  ): void {
    for (const key of Object.keys(payload)) {
      if (JOB_KNOWN_PAYLOAD_KEYS.has(key)) continue;
      if (key in customData) continue;
      customData[key] = payload[key];
    }
  }
}

const JOB_KNOWN_PAYLOAD_KEYS = new Set<string>([
  'id', 'tenantId', 'externalReference', 'claimId', 'claim', 'parentClaimId',
  'vendor', 'jobType', 'type', 'status',
  'address', 'siteAddress',
  'requestDate', 'collectExcess', 'excess', 'makeSafeRequired',
  'jobInstructions', 'instructions',
  'contacts', 'assignees', 'appointments',
  'customData', 'updatedAtDate', 'createdAtDate',
  'estimatedStartDate', 'estimatedCompletionDate', 'estimatedDeliveryDate',
  'claimRecommendation', 'approvalLimitApplicable', 'reference',
  'internalAllocatedVendorJobId', 'internalAllocatedVendorJobReference',
  'lastSubmissionDate', 'firstSubmissionDate',
  // TA keys
  'emergency', 'habitableProperty', 'estimatedStayStartDate', 'estimatedStayEndDate',
  'numberOfAdults', 'numberOfChildren', 'numberOfBedrooms', 'numberOfCots',
  'numberOfVehicles', 'petsInformation',
  // Specialist keys
  'isSpecificSpecialistRequired', 'specialistCategory', 'specialistReport',
  'specialistBusinessName', 'locationOfDamage', 'typeOfDamage',
  // Rectification keys
  'originalJobReference', 'originalJobType', 'paidJob',
  // Audit keys
  'auditType',
  // Mobility keys
  'mobilityConsiderations',
]);
