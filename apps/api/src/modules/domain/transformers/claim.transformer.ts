import { Injectable } from '@nestjs/common';
import type {
  EntityTransformer,
  TransformResult,
  LookupRequest,
  RawContact,
  RawAssignee,
} from './transformer.interface';
import type { ClaimInsert } from '../../../database/repositories';
import {
  asString,
  asBool,
  asDateString,
  asTimestamp,
  asNumericString,
  isPlainObject,
  extractObject,
  nameFromLookup,
} from './transform-utils';

/**
 * Pure CW → internal `claims` transformer.
 *
 * Mirrors the field extraction logic from CrunchworkClaimMapper but produces
 * a declarative TransformResult instead of directly resolving lookups.
 *
 * Divergences from the original mapper are preserved:
 * - Lookup fields arrive as `{ id, name }` objects → declared as LookupRequests
 * - Object-or-string fields (claimDecision, priority, etc.) → declared with
 *   the id extracted from the object form; bare-string forms stored in customData
 *   (same as the mapper's resolveOrRaw pattern)
 * - Contacts/assignees extracted into typed arrays for the sync services
 * - Unknown top-level keys collected into customData
 */
@Injectable()
export class ClaimTransformer implements EntityTransformer<ClaimInsert> {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: ClaimInsert;
  }): TransformResult<ClaimInsert> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const contacts: RawContact[] = [];
    const assignees: RawAssignee[] = [];
    const customDataRaw: Record<string, unknown> = {};

    const cwClaimId = asString(payload.id);
    const claimNumber = asString(payload.claimNumber) ?? asString(payload.referenceNumber);

    const entity: Partial<ClaimInsert> = {
      tenantId,
      claimNumber,
      externalReference: cwClaimId,
      externalClaimId: asString(payload.externalReference),
      lodgementDate: asDateString(payload.lodgementDate),
      dateOfLoss: asTimestamp(payload.dateOfLoss),
      incidentDescription: asString(payload.incidentDescription),
      postalAddress: asString(payload.postalAddress),
      policyNumber: asString(payload.policyNumber),
      policyName: asString(payload.policyName),
      abn: asString(payload.abn),
      vulnerableCustomer: asBool(payload.vulnerableCustomer),
      totalLoss: asBool(payload.totalLoss),
      contentiousClaim: asBool(payload.contentiousClaim),
      contentiousActivityFlag: asBool(payload.contentiousActivityFlag),
      autoApprovalApplies: asBool(payload.autoApprovalApplies),
      contentsDamaged: asBool(payload.contentsDamaged),
      apiPayload: payload,
    };

    // ── Address ─────────────────────────────────────────────────────
    const address = (payload.address ?? {}) as Record<string, unknown>;
    if (isPlainObject(payload.address)) {
      entity.address = address;
      entity.addressPostcode = asString(address.postcode);
      entity.addressSuburb = asString(address.suburb);
      entity.addressState = asString(address.state);
      entity.addressCountry = asString(address.country);
      entity.addressLatitude = asNumericString(address.latitude);
      entity.addressLongitude = asNumericString(address.longitude);
    }

    // ── JSONB blocks ────────────────────────────────────────────────
    const policyDetails: Record<string, unknown> = {};
    if (payload.policyInceptionDate !== undefined) {
      policyDetails.policyInceptionDate = payload.policyInceptionDate;
    }
    const policyTypeName = nameFromLookup(payload.policyType);
    if (policyTypeName) policyDetails.policyTypeName = policyTypeName;
    const lineOfBusinessField = payload.lineOfBusiness ?? payload.LineOfBusiness;
    const lineOfBusinessName = nameFromLookup(lineOfBusinessField);
    if (lineOfBusinessName) policyDetails.lineOfBusinessName = lineOfBusinessName;
    entity.policyDetails = policyDetails;

    const financialDetails: Record<string, unknown> = {};
    for (const k of [
      'buildingSumInsured',
      'contentsSumInsured',
      'collectExcess',
      'excess',
      'accommodationBenefitLimit',
    ]) {
      if (payload[k] !== undefined) financialDetails[k] = payload[k];
    }
    entity.financialDetails = financialDetails;

    const vulnerabilityDetails: Record<string, unknown> = {};
    if (payload.vulnerabilityCategory !== undefined) {
      vulnerabilityDetails.category = payload.vulnerabilityCategory;
    }
    entity.vulnerabilityDetails = vulnerabilityDetails;

    const contentionDetails: Record<string, unknown> = {};
    if (payload.contentiousActivityDetails !== undefined) {
      contentionDetails.activityDetails = payload.contentiousActivityDetails;
    }
    entity.contentionDetails = contentionDetails;

    // ── Lookup declarations (object form → LookupRequest) ───────────
    this.declareLookup(lookups, payload.account, 'accountLookupId', 'account', true);
    this.declareLookup(lookups, payload.status, 'statusLookupId', 'claim_status');
    this.declareLookup(lookups, payload.catCode, 'catCodeLookupId', 'cat_code', true);
    this.declareLookup(lookups, payload.lossType, 'lossTypeLookupId', 'loss_type');
    this.declareLookup(lookups, payload.lossSubType, 'lossSubtypeLookupId', 'loss_subtype');

    // Object-or-string fields: extract id if object; if bare string, stash in customData
    this.declareOrRaw(lookups, customDataRaw, payload.claimDecision, 'claimDecisionLookupId', 'claim_decision', 'claimDecisionRaw');
    this.declareOrRaw(lookups, customDataRaw, payload.priority, 'priorityLookupId', 'priority', 'priorityRaw');
    this.declareOrRaw(lookups, customDataRaw, payload.policyType, 'policyTypeLookupId', 'policy_type', 'policyTypeRaw');
    this.declareOrRaw(lookups, customDataRaw, lineOfBusinessField, 'lineOfBusinessLookupId', 'line_of_business', 'lineOfBusinessRaw');

    // ── Custom data (unknown keys + explicit fields) ────────────────
    const customData: Record<string, unknown> = {
      ...(isPlainObject(payload.customData) ? payload.customData : {}),
      ...customDataRaw,
    };
    if (payload.updatedAtDate !== undefined) customData.cwUpdatedAtDate = payload.updatedAtDate;
    if (payload.maximumAccomodationDurationLimit !== undefined) {
      customData.maximumAccommodationDurationLimit = payload.maximumAccomodationDurationLimit;
    }
    this.collectUnknownKeys(payload, customData);
    entity.customData = customData;

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

    return {
      entity,
      lookups,
      parentRefs: [],
      contacts: contacts.length > 0 ? contacts : undefined,
      assignees: assignees.length > 0 ? assignees : undefined,
    };
  }

  private declareLookup(
    lookups: LookupRequest[],
    field: unknown,
    targetField: string,
    domain: string,
    autoCreate = false,
  ): void {
    if (!field) return;
    if (isPlainObject(field)) {
      const extRef = asString(field.externalReference) ?? asString(field.id);
      if (!extRef) return;
      lookups.push({
        field: targetField,
        domain,
        externalReference: extRef,
        name: asString(field.name),
        autoCreate,
      });
    }
  }

  private declareOrRaw(
    lookups: LookupRequest[],
    customData: Record<string, unknown>,
    field: unknown,
    targetField: string,
    domain: string,
    rawKey: string,
  ): void {
    if (field == null) return;
    if (isPlainObject(field)) {
      this.declareLookup(lookups, field, targetField, domain);
      return;
    }
    if (typeof field === 'string') {
      // Bare string: attempt lookup by name in the use case; stash raw value
      lookups.push({
        field: targetField,
        domain,
        externalReference: field,
        name: field,
        autoCreate: false,
      });
      customData[rawKey] = field;
    }
  }

  private collectUnknownKeys(
    payload: Record<string, unknown>,
    customData: Record<string, unknown>,
  ): void {
    for (const key of Object.keys(payload)) {
      if (KNOWN_PAYLOAD_KEYS.has(key)) continue;
      if (key in customData) continue;
      customData[key] = payload[key];
    }
  }
}

const KNOWN_PAYLOAD_KEYS = new Set<string>([
  'id', 'tenantId', 'externalReference', 'claimNumber', 'referenceNumber',
  'lodgementDate', 'dateOfLoss', 'updatedAtDate',
  'status', 'account', 'catCode', 'lossType', 'lossSubType',
  'claimDecision', 'priority', 'policyType', 'lineOfBusiness', 'LineOfBusiness',
  'address', 'policyInceptionDate',
  'buildingSumInsured', 'contentsSumInsured', 'collectExcess', 'excess',
  'accommodationBenefitLimit',
  'vulnerableCustomer', 'vulnerabilityCategory',
  'totalLoss', 'contentiousClaim', 'contentiousActivityFlag',
  'contentiousActivityDetails', 'autoApprovalApplies', 'contentsDamaged',
  'incidentDescription', 'abn', 'policyName', 'policyNumber', 'postalAddress',
  'customData', 'maximumAccomodationDurationLimit',
  'contacts', 'assignees',
]);
