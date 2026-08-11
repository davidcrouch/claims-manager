import { Injectable, Logger } from '@nestjs/common';
import {
  JobsRepository,
  JobContactsRepository,
  ContactsRepository,
  ExternalLinksRepository,
  type JobInsert,
  type ContactInsert,
  type JobContactInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { NestedEntityExtractor } from '../nested-entity-extractor.service';
import { LookupResolver } from '../lookup-resolver.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

/**
 * CW → internal `jobs` mapper.
 *
 * Reference: `docs/mapping/jobs.md` — every CW field from §3.3.2 of the
 * Insurance REST API v17 contract has a destination defined there.
 *
 * Notes:
 * - `parent_job_id` is internal-only and is never written or cleared from CW.
 * - `contacts[]` sync is additive (no pruning), matching the claim mapper.
 * - `appointments[]` remain in `api_payload`; appointment rows are owned by
 *   `CrunchworkAppointmentMapper`.
 * - Unresolved `job_type` auto-creates a stub (column is NOT NULL).
 * - Unresolved `status` leaves FK null and continues.
 */
@Injectable()
export class CrunchworkJobMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkJobMapper');

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly jobContactsRepo: JobContactsRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly nestedEntityExtractor: NestedEntityExtractor,
    private readonly lookupResolver: LookupResolver,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = (extObj.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const tx = params.tx;
    const cwJobId = asString(payload.id);

    this.logger.log(
      `CrunchworkJobMapper.map — externalObjectId=${externalObjectId} cwJobId=${cwJobId ?? 'unknown'}`,
    );

    if (!cwJobId) {
      throw new Error(
        `CrunchworkJobMapper.map — cannot map job ${externalObjectId}: payload.id is missing; ` +
          `the fetched payload is likely not a job object (possible HTML/SPA response or wrong entity type).`,
      );
    }

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'job',
    );

    const nested = await this.nestedEntityExtractor.extractFromJobPayload({
      jobPayload: payload,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      tx,
    });

    if (!nested.claimId && !existingLink) {
      throw new Error(
        `CrunchworkJobMapper.map — cannot create job ${externalObjectId}: no claimId could be resolved from payload ` +
          `(payload.claim?.id is missing or the nested claim extractor returned nothing). ` +
          `Refusing to insert a job with an empty claim_id.`,
      );
    }

    const jobFields = await this.buildJobFields({
      payload,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      cwJobId,
      claimId: nested.claimId ?? null,
      vendorId: nested.vendorId ?? null,
      tx,
    });

    let jobId: string;
    if (existingLink) {
      // Never overwrite parent_job_id from CW — strip if somehow present.
      const { parentJobId: _ignored, ...updateData } = jobFields as JobInsert & {
        parentJobId?: string | null;
      };
      void _ignored;
      await this.jobsRepo.update({
        id: existingLink.internalEntityId,
        data: updateData,
        tx,
      });
      jobId = existingLink.internalEntityId;
    } else {
      const jobData: JobInsert = {
        tenantId: params.tenantId,
        ...jobFields,
        claimId: nested.claimId!,
        jobTypeLookupId: jobFields.jobTypeLookupId!,
      };

      const created = await this.jobsRepo.createIfNotExists({
        data: jobData,
        tx,
      });

      if (created) {
        jobId = created.id;
      } else {
        const raced = await this.jobsRepo.findByExternalReference({
          tenantId: params.tenantId,
          externalReference: cwJobId,
          tx,
        });
        if (!raced) {
          throw new Error(
            `CrunchworkJobMapper.map — insert skipped by onConflictDoNothing but no existing row found ` +
              `by externalReference=${cwJobId} for tenant=${params.tenantId}.`,
          );
        }
        this.logger.warn(
          `CrunchworkJobMapper.map — lost race on job insert externalReference=${cwJobId}; updating winner id=${raced.id}`,
        );
        const { parentJobId: _ignored, ...updateData } =
          jobFields as JobInsert & {
            parentJobId?: string | null;
          };
        void _ignored;
        await this.jobsRepo.update({
          id: raced.id,
          data: {
            ...updateData,
            claimId: nested.claimId ?? raced.claimId,
          },
          tx,
        });
        jobId = raced.id;
      }
    }

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: jobId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    await this.syncContacts({
      payload,
      tenantId: params.tenantId,
      jobId,
      tx,
    });

    return {
      internalEntityId: jobId,
      internalEntityType: 'job',
    };
  }

  private async buildJobFields(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    cwJobId: string;
    claimId: string | null;
    vendorId: string | null;
    tx?: DrizzleDbOrTx;
  }): Promise<Partial<JobInsert>> {
    const { payload, tenantId, connectionId, cwJobId, claimId, vendorId, tx } =
      params;

    const jobTypeLookupId = await this.resolveLookup({
      tenantId,
      domain: 'job_type',
      field: payload.jobType,
      autoCreate: true,
      sourceEntity: 'job',
      tx,
    });

    if (!jobTypeLookupId) {
      throw new Error(
        `CrunchworkJobMapper.buildJobFields — jobType.externalReference is missing from the payload ` +
          `and jobs.job_type_lookup_id is NOT NULL. Crunchwork payload must include a jobType object.`,
      );
    }

    const statusLookupId = await this.resolveLookup({
      tenantId,
      domain: 'job_status',
      field: payload.status,
      sourceEntity: 'job',
      tx,
    });

    const address = isPlainObject(payload.address) ? payload.address : {};
    const vendorSnapshot = isPlainObject(payload.vendor) ? payload.vendor : {};

    const temporaryAccommodationDetails = this.buildTemporaryAccommodation(
      payload,
    );
    const specialistDetails = this.buildSpecialistDetails(payload);
    const rectificationDetails = this.buildRectificationDetails(payload);
    const auditDetails = this.buildAuditDetails(payload);
    const mobilityConsiderations = this.buildMobilityConsiderations(payload);

    const customData: Record<string, unknown> = {
      ...(isPlainObject(payload.customData) ? payload.customData : {}),
    };
    if (payload.updatedAtDate !== undefined) {
      customData.cwUpdatedAtDate = payload.updatedAtDate;
    }
    const insurerExternalReference = asString(payload.externalReference);
    if (insurerExternalReference) {
      customData.insurerExternalReference = insurerExternalReference;
    }
    this.collectUnknownKeys(payload, customData);

    const parentClaimId = asUuid(payload.parentClaimId);

    const fields: Partial<JobInsert> = {
      connectionId,
      externalReference: cwJobId,
      externalJobId: insurerExternalReference ?? undefined,
      jobTypeLookupId,
      statusLookupId: statusLookupId ?? undefined,
      parentClaimId: parentClaimId ?? undefined,
      requestDate: parseDate(payload.requestDate, this.logger, 'requestDate'),
      collectExcess: asBoolean(payload.collectExcess),
      excess: asNumericString(payload.excess),
      makeSafeRequired: asBoolean(payload.makeSafeRequired),
      jobInstructions: asString(payload.jobInstructions),
      address,
      addressPostcode: asString(address.postcode),
      addressSuburb: asString(address.suburb),
      addressState: asString(address.state),
      addressCountry: asString(address.country),
      vendorSnapshot,
      temporaryAccommodationDetails,
      specialistDetails,
      rectificationDetails,
      auditDetails,
      mobilityConsiderations,
      customData,
      apiPayload: payload,
    };

    if (claimId) fields.claimId = claimId;
    if (vendorId) fields.vendorId = vendorId;

    return fields;
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
      out.specialistCategory = lookupSnapshot(payload.specialistCategory);
    }
    if (payload.specialistReport !== undefined) {
      out.specialistReport = lookupSnapshot(payload.specialistReport);
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
      out.originalJobType = lookupSnapshot(payload.originalJobType);
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
      out.auditType = lookupSnapshot(payload.auditType);
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

  private async resolveLookup(params: {
    tenantId: string;
    domain: string;
    field: unknown;
    autoCreate?: boolean;
    sourceEntity?: string;
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
      const name =
        asString(params.field.name) ?? asString(params.field.Name);
      if (!externalReference) return null;
      return this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: params.domain,
        externalReference,
        name: name ?? undefined,
        autoCreate: params.autoCreate ?? false,
        sourceEntity: params.sourceEntity,
        tx: params.tx,
      });
    }
    return null;
  }

  private async syncContacts(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    jobId: string;
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
          `CrunchworkJobMapper.syncContacts — skipping contact without externalReference (jobId=${params.jobId})`,
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

      const joinData: JobContactInsert = {
        tenantId: params.tenantId,
        jobId: params.jobId,
        contactId: contact.id,
        sortIndex,
        sourcePayload: {
          typeName: nameFromLookup(entry.type),
          preferredMethodName: nameFromLookup(entry.preferredMethodOfContact),
          raw: entry,
        },
      };
      await this.jobContactsRepo.upsert({ data: joinData, tx: params.tx });
      sortIndex += 1;
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

// ---------------------------------------------------------------------------
// helpers

const KNOWN_PAYLOAD_KEYS = new Set<string>([
  'id',
  'tenantId',
  'externalReference',
  'claimId',
  'parentClaimId',
  'claim',
  'updatedAtDate',
  'jobType',
  'status',
  'address',
  'requestDate',
  'collectExcess',
  'excess',
  'makeSafeRequired',
  'jobInstructions',
  'vendor',
  'appointments',
  'contacts',
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
  'mobilityConsiderations',
  'isSpecificSpecialistRequired',
  'specialistCategory',
  'specialistReport',
  'specialistBusinessName',
  'locationOfDamage',
  'typeOfDamage',
  'originalJobReference',
  'originalJobType',
  'paidJob',
  'auditType',
  'customData',
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

function asUuid(value: unknown): string | null {
  const s = asString(value);
  if (!s) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) {
    return null;
  }
  return s;
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
      `CrunchworkJobMapper.parseDate — non-string ${field}; storing null`,
    );
    return null;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    logger.warn(
      `CrunchworkJobMapper.parseDate — invalid ${field}='${s}'; storing null`,
    );
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function nameFromLookup(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (isPlainObject(value)) {
    return asString(value.name) ?? asString(value.Name);
  }
  return null;
}

function lookupSnapshot(
  value: unknown,
): { name?: string | null; externalReference?: string | null } | unknown {
  if (!isPlainObject(value)) return value;
  return {
    name: asString(value.name) ?? asString(value.Name),
    externalReference: asString(value.externalReference),
  };
}
