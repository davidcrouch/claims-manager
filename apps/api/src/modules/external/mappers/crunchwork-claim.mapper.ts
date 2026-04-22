import { Injectable, Logger } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import {
  ClaimsRepository,
  ClaimContactsRepository,
  ClaimAssigneesRepository,
  ContactsRepository,
  ExternalLinksRepository,
  type ClaimInsert,
  type ContactInsert,
  type ClaimContactInsert,
  type ClaimAssigneeInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { LookupResolver } from '../lookup-resolver.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { Inject } from '@nestjs/common';
import { claims } from '../../../database/schema';

/**
 * CW → internal `claims` mapper.
 *
 * Reference: `docs/mapping/claims.md` — every CW field from §3.3.1 of the
 * Insurance REST API v17 contract has a destination defined there. This
 * mapper is the executable form of that spec.
 *
 * Divergences from the doc (intentional, reasoned):
 * - `account` unresolved lookup: spec says "Fail API Call"; we **auto-create**
 *   a stub instead. Failing a whole claim projection on a missing account
 *   lookup would push the event into dead-letter for something that's almost
 *   always a benign "we haven't seeded this account code yet" — the webhook
 *   pipeline has no caller to surface the 4xx to. Auto-creation is already
 *   audit-logged via `external_reference_resolution_log`.
 * - `contacts[]` sync: additive (no pruning of `claim_contacts`), because
 *   contacts is a shared table and a CW payload's contact list often isn't
 *   authoritative.
 * - `claim_assignees[]` sync: pruned to match the CW payload exactly, since
 *   stale assignments are operationally misleading.
 * - Date parsing: lenient — invalid/empty → null + warn, do not fail.
 */
@Injectable()
export class CrunchworkClaimMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkClaimMapper');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly claimsRepo: ClaimsRepository,
    private readonly claimContactsRepo: ClaimContactsRepository,
    private readonly claimAssigneesRepo: ClaimAssigneesRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly lookupResolver: LookupResolver,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    const tx = params.tx;
    const extObj = params.externalObject;
    const payload = (extObj.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const cwClaimId = (payload.id as string | undefined) ?? null;
    const claimNumber = asString(payload.claimNumber);

    this.logger.log(
      `CrunchworkClaimMapper.map — externalObjectId=${externalObjectId} cwClaimId=${cwClaimId ?? 'unknown'}`,
    );

    const existingClaimId = await this.resolveExistingClaimId({
      tenantId: params.tenantId,
      externalObjectId,
      cwClaimId,
      claimNumber,
      tx,
    });

    const claimFields = await this.buildClaimFields({
      payload,
      tenantId: params.tenantId,
      cwClaimId,
      claimNumber,
      tx,
    });

    let claimId: string;
    if (existingClaimId) {
      await this.claimsRepo.update({
        id: existingClaimId,
        data: claimFields,
        tx,
      });
      claimId = existingClaimId;
    } else {
      const created = await this.claimsRepo.createIfNotExists({
        data: { tenantId: params.tenantId, ...claimFields } as ClaimInsert,
        tx,
      });
      if (created) {
        claimId = created.id;
      } else {
        const racedId = await this.resolveExistingClaimId({
          tenantId: params.tenantId,
          externalObjectId,
          cwClaimId,
          claimNumber,
          tx,
        });
        if (!racedId) {
          throw new Error(
            `CrunchworkClaimMapper.map — insert skipped by onConflictDoNothing but no existing row found ` +
              `by externalReference=${cwClaimId ?? 'n/a'} or claimNumber=${claimNumber ?? 'n/a'} ` +
              `for tenant=${params.tenantId}.`,
          );
        }
        this.logger.warn(
          `CrunchworkClaimMapper.map — lost race on claim insert cwClaimId=${cwClaimId ?? 'n/a'}; updating winner id=${racedId}`,
        );
        await this.claimsRepo.update({
          id: racedId,
          data: claimFields,
          tx,
        });
        claimId = racedId;
      }
    }

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'claim',
        internalEntityId: claimId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    await this.syncContacts({
      payload,
      tenantId: params.tenantId,
      claimId,
      tx,
    });

    await this.syncAssignees({
      payload,
      tenantId: params.tenantId,
      claimId,
      tx,
    });

    return { internalEntityId: claimId, internalEntityType: 'claim' };
  }

  private async resolveExistingClaimId(params: {
    tenantId: string;
    externalObjectId: string;
    cwClaimId: string | null;
    claimNumber: string | null;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: params.externalObjectId,
      tx: params.tx,
    });
    const link = existingLinks.find((l) => l.internalEntityType === 'claim');
    if (link) return link.internalEntityId;

    const db = params.tx ?? this.db;

    if (params.cwClaimId) {
      const [byExtRef] = await db
        .select({ id: claims.id })
        .from(claims)
        .where(
          and(
            eq(claims.tenantId, params.tenantId),
            eq(claims.externalReference, params.cwClaimId),
            isNull(claims.deletedAt),
          ),
        )
        .limit(1);
      if (byExtRef) return byExtRef.id;
    }

    if (params.claimNumber) {
      const [byNumber] = await db
        .select({ id: claims.id })
        .from(claims)
        .where(
          and(
            eq(claims.tenantId, params.tenantId),
            eq(claims.claimNumber, params.claimNumber),
            isNull(claims.deletedAt),
          ),
        )
        .limit(1);
      if (byNumber) return byNumber.id;
    }

    return null;
  }

  private async buildClaimFields(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    cwClaimId: string | null;
    claimNumber: string | null;
    tx?: DrizzleDbOrTx;
  }): Promise<Partial<ClaimInsert>> {
    const { payload, tenantId, cwClaimId, claimNumber, tx } = params;

    const statusLookupId = await this.resolveLookup({
      tenantId,
      domain: 'claim_status',
      field: payload.status,
      tx,
    });
    const accountLookupId = await this.resolveLookup({
      tenantId,
      domain: 'account',
      field: payload.account,
      autoCreate: true,
      tx,
    });
    const catCodeLookupId = await this.resolveLookup({
      tenantId,
      domain: 'cat_code',
      field: payload.catCode,
      autoCreate: true,
      tx,
    });
    const lossTypeLookupId = await this.resolveLookup({
      tenantId,
      domain: 'loss_type',
      field: payload.lossType,
      tx,
    });
    const lossSubtypeLookupId = await this.resolveLookup({
      tenantId,
      domain: 'loss_subtype',
      field: payload.lossSubType,
      tx,
    });

    const customDataRaw: Record<string, unknown> = {};
    const claimDecisionLookupId = await this.resolveOrRaw({
      tenantId,
      domain: 'claim_decision',
      field: payload.claimDecision,
      rawKey: 'claimDecisionRaw',
      customData: customDataRaw,
      tx,
    });
    const priorityLookupId = await this.resolveOrRaw({
      tenantId,
      domain: 'priority',
      field: payload.priority,
      rawKey: 'priorityRaw',
      customData: customDataRaw,
      tx,
    });
    const policyTypeLookupId = await this.resolveOrRaw({
      tenantId,
      domain: 'policy_type',
      field: payload.policyType,
      rawKey: 'policyTypeRaw',
      customData: customDataRaw,
      tx,
    });
    const lineOfBusinessLookupId = await this.resolveOrRaw({
      tenantId,
      domain: 'line_of_business',
      field: payload.lineOfBusiness,
      rawKey: 'lineOfBusinessRaw',
      customData: customDataRaw,
      tx,
    });

    const address = (payload.address ?? {}) as Record<string, unknown>;

    const policyDetails: Record<string, unknown> = {};
    if (payload.policyInceptionDate !== undefined) {
      policyDetails.policyInceptionDate = payload.policyInceptionDate;
    }
    const policyTypeName = nameFromLookup(payload.policyType);
    if (policyTypeName) policyDetails.policyTypeName = policyTypeName;
    const lineOfBusinessName = nameFromLookup(payload.lineOfBusiness);
    if (lineOfBusinessName)
      policyDetails.lineOfBusinessName = lineOfBusinessName;

    const financialDetails: Record<string, unknown> = {};
    if (payload.buildingSumInsured !== undefined) {
      financialDetails.buildingSumInsured = payload.buildingSumInsured;
    }
    if (payload.contentsSumInsured !== undefined) {
      financialDetails.contentsSumInsured = payload.contentsSumInsured;
    }
    if (payload.collectExcess !== undefined) {
      financialDetails.collectExcess = payload.collectExcess;
    }
    if (payload.excess !== undefined) {
      financialDetails.excess = payload.excess;
    }
    if (payload.accommodationBenefitLimit !== undefined) {
      financialDetails.accommodationBenefitLimit =
        payload.accommodationBenefitLimit;
    }

    const vulnerabilityDetails: Record<string, unknown> = {};
    if (payload.vulnerabilityCategory !== undefined) {
      vulnerabilityDetails.category = payload.vulnerabilityCategory;
    }

    const contentionDetails: Record<string, unknown> = {};
    if (payload.contentiousActivityDetails !== undefined) {
      contentionDetails.activityDetails = payload.contentiousActivityDetails;
    }

    const customData: Record<string, unknown> = {
      ...(isPlainObject(payload.customData) ? payload.customData : {}),
      ...customDataRaw,
    };
    if (payload.updatedAtDate !== undefined) {
      customData.cwUpdatedAtDate = payload.updatedAtDate;
    }
    if (payload.maximumAccomodationDurationLimit !== undefined) {
      customData.maximumAccommodationDurationLimit =
        payload.maximumAccomodationDurationLimit;
    }
    this.collectUnknownKeys(payload, customData);

    return {
      claimNumber: claimNumber ?? undefined,
      externalReference: cwClaimId ?? undefined,
      externalClaimId: asString(payload.externalReference) ?? undefined,
      lodgementDate: parseDate(
        payload.lodgementDate,
        this.logger,
        'lodgementDate',
      ),
      dateOfLoss: parseTimestamp(payload.dateOfLoss, this.logger, 'dateOfLoss'),
      statusLookupId: statusLookupId ?? undefined,
      accountLookupId: accountLookupId ?? undefined,
      catCodeLookupId: catCodeLookupId ?? undefined,
      lossTypeLookupId: lossTypeLookupId ?? undefined,
      lossSubtypeLookupId: lossSubtypeLookupId ?? undefined,
      claimDecisionLookupId: claimDecisionLookupId ?? undefined,
      priorityLookupId: priorityLookupId ?? undefined,
      policyTypeLookupId: policyTypeLookupId ?? undefined,
      lineOfBusinessLookupId: lineOfBusinessLookupId ?? undefined,
      address,
      addressPostcode: asString(address.postcode),
      addressSuburb: asString(address.suburb),
      addressState: asString(address.state),
      addressCountry: asString(address.country),
      addressLatitude: asNumericString(address.latitude),
      addressLongitude: asNumericString(address.longitude),
      policyDetails,
      financialDetails,
      vulnerabilityDetails,
      contentionDetails,
      policyNumber: asString(payload.policyNumber),
      policyName: asString(payload.policyName),
      abn: asString(payload.abn),
      postalAddress: asString(payload.postalAddress),
      incidentDescription: asString(payload.incidentDescription),
      vulnerableCustomer: asBoolean(payload.vulnerableCustomer),
      totalLoss: asBoolean(payload.totalLoss),
      contentiousClaim: asBoolean(payload.contentiousClaim),
      contentiousActivityFlag: asBoolean(payload.contentiousActivityFlag),
      autoApprovalApplies: asBoolean(payload.autoApprovalApplies),
      contentsDamaged: asBoolean(payload.contentsDamaged),
      customData,
      apiPayload: payload,
    };
  }

  private async resolveLookup(params: {
    tenantId: string;
    domain: string;
    field: unknown;
    autoCreate?: boolean;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.field) return null;
    if (typeof params.field === 'string') {
      return this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: params.domain,
        name: params.field,
        tx: params.tx,
      });
    }
    if (isPlainObject(params.field)) {
      const externalReference = asString(params.field.externalReference);
      const name = asString(params.field.name);
      if (!externalReference) return null;
      return this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: params.domain,
        externalReference,
        name: name ?? undefined,
        autoCreate: params.autoCreate ?? false,
        tx: params.tx,
      });
    }
    return null;
  }

  /**
   * `claimDecision`, `priority`, `policyType`, `lineOfBusiness` can arrive as
   * either a CW object or a bare string. Object → lookup; bare string → name
   * match, fall back to storing the raw value in `custom_data.<rawKey>`.
   */
  private async resolveOrRaw(params: {
    tenantId: string;
    domain: string;
    field: unknown;
    rawKey: string;
    customData: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (params.field == null) return null;
    if (typeof params.field === 'string') {
      const byName = await this.lookupResolver.resolveByName({
        tenantId: params.tenantId,
        domain: params.domain,
        name: params.field,
        tx: params.tx,
      });
      if (byName) return byName;
      params.customData[params.rawKey] = params.field;
      return null;
    }
    return this.resolveLookup({
      tenantId: params.tenantId,
      domain: params.domain,
      field: params.field,
      tx: params.tx,
    });
  }

  private async syncContacts(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    claimId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const raw = params.payload.contacts;
    if (!Array.isArray(raw)) return;

    let sortIndex = 0;
    for (const entry of raw) {
      if (!isPlainObject(entry)) continue;

      const externalReference = asString(entry.externalReference);
      if (!externalReference) {
        this.logger.warn(
          `CrunchworkClaimMapper.syncContacts — skipping contact without externalReference (claimId=${params.claimId})`,
        );
        continue;
      }

      const typeLookupId = await this.resolveLookup({
        tenantId: params.tenantId,
        domain: 'contact_type',
        field: entry.type,
        tx: params.tx,
      });
      const preferredLookupId = await this.resolveLookup({
        tenantId: params.tenantId,
        domain: 'contact_method',
        field: entry.preferredMethodOfContact,
        tx: params.tx,
      });

      const contactData: ContactInsert & { externalReference: string } = {
        tenantId: params.tenantId,
        externalReference,
        firstName: asString(entry.firstName),
        lastName: asString(entry.lastName),
        email: asString(entry.email),
        mobilePhone: asString(entry.mobilePhone),
        homePhone: asString(entry.homePhone),
        workPhone: asString(entry.workPhone),
        notes: asString(entry.notes),
        typeLookupId: typeLookupId ?? undefined,
        preferredContactMethodLookupId: preferredLookupId ?? undefined,
        contactPayload: entry,
      };

      const contact = await this.contactsRepo.upsertByExternalReference({
        data: contactData,
        tx: params.tx,
      });

      const joinData: ClaimContactInsert = {
        tenantId: params.tenantId,
        claimId: params.claimId,
        contactId: contact.id,
        sortIndex,
        sourcePayload: {
          typeName: nameFromLookup(entry.type),
          preferredMethodName: nameFromLookup(entry.preferredMethodOfContact),
          raw: entry,
        },
      };
      await this.claimContactsRepo.upsert({ data: joinData, tx: params.tx });
      sortIndex += 1;
    }
  }

  private async syncAssignees(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    claimId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const raw = params.payload.assignees;
    const keepExternalRefs: string[] = [];

    if (Array.isArray(raw)) {
      for (const entry of raw) {
        if (!isPlainObject(entry)) continue;

        const externalReference = asString(entry.externalReference);
        if (!externalReference) {
          this.logger.warn(
            `CrunchworkClaimMapper.syncAssignees — skipping assignee without externalReference (claimId=${params.claimId})`,
          );
          continue;
        }

        const typeLookupId = await this.resolveLookup({
          tenantId: params.tenantId,
          domain: 'assignee_type',
          field: entry.type,
          tx: params.tx,
        });

        const data: ClaimAssigneeInsert & { externalReference: string } = {
          tenantId: params.tenantId,
          claimId: params.claimId,
          externalReference,
          displayName: asString(entry.name),
          email: asString(entry.email),
          assigneeTypeLookupId: typeLookupId ?? undefined,
          assigneePayload: {
            typeName: nameFromLookup(entry.type),
            raw: entry,
          },
        };

        await this.claimAssigneesRepo.upsertByExternalRef({
          data,
          tx: params.tx,
        });
        keepExternalRefs.push(externalReference);
      }
    }

    const pruned = await this.claimAssigneesRepo.pruneNotInExternalRefs({
      claimId: params.claimId,
      keepExternalRefs,
      tx: params.tx,
    });
    if (pruned > 0) {
      this.logger.log(
        `CrunchworkClaimMapper.syncAssignees — pruned ${pruned} stale assignee rows from claimId=${params.claimId}`,
      );
    }
  }

  /**
   * Any top-level CW claim key not explicitly handled elsewhere in this mapper
   * is copied verbatim under `custom_data.<key>` so nothing is silently lost
   * from the queryable surface (see docs/mapping/claims.md §6.5 last paragraph).
   * `api_payload` always has the full body regardless.
   */
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

// ---------------------------------------------------------------------------
// helpers

/** Keys that `buildClaimFields` already routed explicitly. */
const KNOWN_PAYLOAD_KEYS = new Set<string>([
  'id',
  'tenantId',
  'externalReference',
  'claimNumber',
  'lodgementDate',
  'dateOfLoss',
  'updatedAtDate',
  'status',
  'account',
  'catCode',
  'lossType',
  'lossSubType',
  'claimDecision',
  'priority',
  'policyType',
  'lineOfBusiness',
  'address',
  'policyInceptionDate',
  'buildingSumInsured',
  'contentsSumInsured',
  'collectExcess',
  'excess',
  'accommodationBenefitLimit',
  'vulnerableCustomer',
  'vulnerabilityCategory',
  'totalLoss',
  'contentiousClaim',
  'contentiousActivityFlag',
  'contentiousActivityDetails',
  'autoApprovalApplies',
  'contentsDamaged',
  'incidentDescription',
  'abn',
  'policyName',
  'policyNumber',
  'postalAddress',
  'customData',
  'maximumAccomodationDurationLimit',
  'contacts',
  'assignees',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (value == null) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === 'yes' || v === '1') return true;
    if (v === 'false' || v === 'no' || v === '0') return false;
  }
  return null;
}

function asNumericString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value))
    return value.toString();
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !Number.isNaN(Number(value))
  ) {
    return value;
  }
  return null;
}

function parseDate(
  value: unknown,
  logger: Logger,
  field: string,
): string | null {
  if (value == null || value === '') return null;
  const s = asString(value);
  if (!s) {
    logger.warn(
      `CrunchworkClaimMapper.parseDate — non-string ${field}; storing null`,
    );
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    logger.warn(
      `CrunchworkClaimMapper.parseDate — invalid ${field}='${s}'; storing null`,
    );
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function parseTimestamp(
  value: unknown,
  logger: Logger,
  field: string,
): Date | null {
  if (value == null || value === '') return null;
  const s = asString(value);
  if (!s) {
    logger.warn(
      `CrunchworkClaimMapper.parseTimestamp — non-string ${field}; storing null`,
    );
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    logger.warn(
      `CrunchworkClaimMapper.parseTimestamp — invalid ${field}='${s}'; storing null`,
    );
    return null;
  }
  return d;
}

function nameFromLookup(value: unknown): string | null {
  if (isPlainObject(value)) return asString(value.name);
  return null;
}
