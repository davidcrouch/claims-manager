import { Injectable, Inject, Optional, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  JobsRepository,
  ContactsRepository,
  LookupsRepository,
  type JobInsert,
  type JobViewRow,
} from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';
import { FilesystemService } from '../filesystem/filesystem.service';

type ContactInput = {
  contactId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  notes?: string;
  typeLookupId?: string;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly jobContactsRepo: JobContactsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
    private readonly outboundSync: OutboundSyncService,
    private readonly lookupResolver: LookupResolver,
    private readonly filesystemService: FilesystemService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveProvider(
    tenantId: string,
    providerOverride?: string,
  ): Promise<{ providerCode: string; connectionId: string }> {
    if (providerOverride === 'direct') {
      return { providerCode: 'direct', connectionId: tenantId };
    }

    if (providerOverride) {
      if (!this.connectionResolver) {
        throw new BadRequestException(`No connection resolver available for provider: ${providerOverride}`);
      }
      const connection = await this.connectionResolver.resolveForTenant({
        tenantId,
        providerCode: providerOverride,
      });
      if (!connection) {
        throw new BadRequestException(`No active connection for provider: ${providerOverride}`);
      }
      return { providerCode: providerOverride, connectionId: connection.id };
    }

    if (!this.connectionResolver) {
      return { providerCode: 'direct', connectionId: tenantId };
    }

    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (connection) {
      return { providerCode: connection.providerCode, connectionId: connection.id };
    }

    return { providerCode: 'direct', connectionId: tenantId };
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    claimId?: string;
    sort?: string;
    search?: string;
    status?: string;
    jobType?: string;
    assignedToUserId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`JobsService.findAll — tenantId=${tenantId} claimId=${params.claimId ?? 'all'}`);
    const result = await this.jobsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      claimId: params.claimId,
      sort: params.sort,
      search: params.search,
      status: params.status,
      jobType: params.jobType,
      assignedToUserId: params.assignedToUserId,
    });
    return { data: result.data.map(this.shapeJobResponse), total: result.total };
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!job) throw new NotFoundException('Job not found');
    return this.shapeJobResponse(job);
  }

  private shapeJobResponse(row: JobViewRow) {
    const { statusName, statusExternalReference, jobTypeName, jobTypeExternalReference, vendorName, vendorExternalReference, connectionProviderCode, assigneeName, ...rest } = row;
    return {
      ...rest,
      provider: connectionProviderCode ?? 'internal',
      assigneeName: assigneeName ?? null,
      status: row.statusLookupId
        ? { id: row.statusLookupId, name: statusName ?? undefined, externalReference: statusExternalReference ?? undefined }
        : undefined,
      jobType: { id: row.jobTypeLookupId, name: jobTypeName ?? undefined, externalReference: jobTypeExternalReference ?? undefined },
      vendor: row.vendorId
        ? { id: row.vendorId, name: vendorName ?? undefined, externalReference: vendorExternalReference ?? undefined }
        : undefined,
    };
  }

  async create(params: { body: Record<string, unknown>; providerOverride?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { providerCode, connectionId } = await this.resolveProvider(tenantId, params.providerOverride);
    const needsSync = providerCode !== 'direct';

    if (needsSync && !params.body.claimId) {
      throw new BadRequestException('claimId is required when syncing to an external provider');
    }

    if (!params.body.jobTypeLookupId && !(params.body.jobType as { id?: string } | undefined)?.id) {
      throw new BadRequestException('jobTypeLookupId is required');
    }

    const contactsInput = Array.isArray(params.body.contacts)
      ? (params.body.contacts as ContactInput[])
      : [];

    this.logger.debug(
      `JobsService.create — tenantId=${tenantId} provider=${providerCode} connectionId=${connectionId} needsSync=${needsSync} contacts=${contactsInput.length}`,
    );

    const body = { ...params.body };
    if (!body.statusLookupId && !(body.status as { id?: string } | undefined)?.id) {
      const pendingStatusId =
        (await this.lookupResolver.resolveByName({
          tenantId,
          domain: 'job_status',
          name: 'Pending',
        })) ??
        (await this.lookupResolver.resolve({
          tenantId,
          domain: 'job_status',
          externalReference: 'seed-job-status-pending',
          name: 'Pending',
          autoCreate: true,
        }));
      if (pendingStatusId) {
        body.statusLookupId = pendingStatusId;
      } else {
        this.logger.warn(
          `JobsService.create — no Pending job_status lookup for tenantId=${tenantId}; job will have null status`,
        );
      }
    }

    const job = await this.db.transaction(async (tx) => {
      const resolvedContacts = await this.resolveContacts({
        tenantId,
        contacts: contactsInput,
        tx,
      });

      const inserted = await this.jobsRepo.create({
        data: {
          tenantId,
          connectionId: connectionId !== tenantId ? connectionId : undefined,
          syncStatus: needsSync ? 'pending' : null,
          ...this.buildInsertFromBody(
            body,
            resolvedContacts.map((c) => c.snapshot),
          ),
        },
        tx,
      });
      for (let i = 0; i < resolvedContacts.length; i++) {
        const contact = resolvedContacts[i];
        await this.jobContactsRepo.upsert({
          data: {
            tenantId,
            jobId: inserted.id,
            contactId: contact.contactId,
            sortIndex: i,
            sourcePayload: contact.snapshot,
          },
          tx,
        });
      }

      if (needsSync) {
        await this.outboundSync.enqueue({
          tenantId,
          connectionId,
          entityType: 'job',
          entityId: inserted.id,
          action: 'create',
          payload: body,
          idempotencyKey: `create:job:${inserted.id}`,
          tx,
        });
      }

      return inserted;
    });

    this.logger.debug(
      `JobsService.create — id=${job.id} assignedToUserId=${job.assignedToUserId ?? 'none'}`,
    );

    const filesystemTemplateId =
      typeof params.body.filesystemTemplateId === 'string'
        ? params.body.filesystemTemplateId
        : undefined;

    try {
      await this.filesystemService.ensureProjectFilesystemForJob(
        tenantId,
        job.id,
        filesystemTemplateId,
      );
    } catch (err) {
      this.logger.error(
        `JobsService.create — project filesystem setup failed jobId=${job.id}: ${err instanceof Error ? err.message : err}`,
      );
      throw err;
    }

    return this.findOne({ id: job.id });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    providerOverride?: string;
  }) {
    const existing = await this.findOne({ id: params.id });
    const tenantId = this.tenantContext.getTenantId();
    const { providerCode, connectionId } = await this.resolveProvider(tenantId, params.providerOverride);
    const needsSync = providerCode !== 'direct';

    this.logger.debug(
      `JobsService.update — id=${params.id} provider=${providerCode} needsSync=${needsSync}`,
    );

    const job = await this.db.transaction(async (tx) => {
      const updated = await this.jobsRepo.update({
        id: params.id,
        data: {
          ...this.buildUpdateFromBody(params.body),
          ...(needsSync ? { syncStatus: 'pending' } : {}),
        },
        tx,
      });

      if (needsSync) {
        await this.outboundSync.enqueue({
          tenantId,
          connectionId,
          entityType: 'job',
          entityId: params.id,
          action: 'update',
          payload: {
            ...params.body,
            externalId: existing.externalReference,
          },
          idempotencyKey: `update:job:${params.id}:${Date.now()}`,
          tx,
        });
      }

      return updated;
    });

    return this.findOne({ id: params.id });
  }

  async addContacts(params: {
    id: string;
    contacts: Record<string, unknown>[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Job not found');

    const contactsInput = (Array.isArray(params.contacts) ? params.contacts : []) as ContactInput[];
    if (contactsInput.length === 0) {
      throw new BadRequestException('contacts is required');
    }

    this.logger.debug(
      `JobsService.addContacts — jobId=${params.id} tenantId=${tenantId} contacts=${contactsInput.length}`,
    );

    await this.db.transaction(async (tx) => {
      const resolvedContacts = await this.resolveContacts({
        tenantId,
        contacts: contactsInput,
        tx,
      });

      const existingLinks = await this.jobContactsRepo.findByJob({
        jobId: params.id,
        tx,
      });
      const linkedIds = new Set(existingLinks.map((l) => l.contactId));
      const minSort = existingLinks.reduce(
        (min, row) => Math.min(min, row.sortIndex ?? 0),
        0,
      );
      // Negative sort indexes put newly added contacts above existing ones.
      let nextSort = Math.min(minSort, 0) - resolvedContacts.length;

      const apiPayload =
        existing.apiPayload && typeof existing.apiPayload === 'object' && !Array.isArray(existing.apiPayload)
          ? { ...(existing.apiPayload as Record<string, unknown>) }
          : {};
      const priorSnapshots = Array.isArray(apiPayload.contacts)
        ? ([...apiPayload.contacts] as Record<string, unknown>[])
        : [];
      const priorById = new Map<string, Record<string, unknown>>();
      for (const snap of priorSnapshots) {
        const id = typeof snap.id === 'string' ? snap.id : undefined;
        if (id) priorById.set(id, snap);
      }

      const newSnapshots: Record<string, unknown>[] = [];
      for (const contact of resolvedContacts) {
        if (!linkedIds.has(contact.contactId)) {
          await this.jobContactsRepo.upsert({
            data: {
              tenantId,
              jobId: params.id,
              contactId: contact.contactId,
              sortIndex: nextSort,
              sourcePayload: contact.snapshot,
            },
            tx,
          });
          nextSort += 1;
          linkedIds.add(contact.contactId);
          newSnapshots.push(contact.snapshot);
          priorById.delete(contact.contactId);
        } else {
          await this.jobContactsRepo.upsert({
            data: {
              tenantId,
              jobId: params.id,
              contactId: contact.contactId,
              sortIndex:
                existingLinks.find((l) => l.contactId === contact.contactId)?.sortIndex ?? 0,
              sourcePayload: contact.snapshot,
            },
            tx,
          });
          priorById.set(contact.contactId, contact.snapshot);
        }
      }

      const remainingPrior = priorSnapshots
        .map((snap) => {
          const id = typeof snap.id === 'string' ? snap.id : undefined;
          if (!id) return snap;
          return priorById.get(id) ?? snap;
        })
        .filter((snap) => {
          const id = typeof snap.id === 'string' ? snap.id : undefined;
          // Drop duplicates that were moved into newSnapshots.
          return !id || !newSnapshots.some((n) => n.id === id);
        });

      await this.jobsRepo.update({
        id: params.id,
        data: {
          apiPayload: {
            ...apiPayload,
            contacts: [...newSnapshots, ...remainingPrior],
          },
        },
        tx,
      });
    });

    return this.findOne({ id: params.id });
  }

  async removeContact(params: { id: string; contactId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Job not found');

    this.logger.debug(
      `JobsService.removeContact — jobId=${params.id} contactId=${params.contactId} tenantId=${tenantId}`,
    );

    await this.db.transaction(async (tx) => {
      await this.jobContactsRepo.deleteByJobAndContact({
        jobId: params.id,
        contactId: params.contactId,
        tx,
      });

      const apiPayload =
        existing.apiPayload && typeof existing.apiPayload === 'object' && !Array.isArray(existing.apiPayload)
          ? { ...(existing.apiPayload as Record<string, unknown>) }
          : {};
      const priorSnapshots = Array.isArray(apiPayload.contacts)
        ? (apiPayload.contacts as Record<string, unknown>[])
        : [];
      const nextContacts = priorSnapshots.filter((snap) => snap.id !== params.contactId);

      await this.jobsRepo.update({
        id: params.id,
        data: {
          apiPayload: {
            ...apiPayload,
            contacts: nextContacts,
          },
        },
        tx,
      });
    });

    return this.findOne({ id: params.id });
  }

  private async resolveContactType(
    tenantId: string,
    typeLookupId?: string | null,
  ): Promise<Record<string, unknown> | undefined> {
    const id = typeLookupId?.trim();
    if (!id) return undefined;
    const lookup = await this.lookupsRepo.findOne({ id, tenantId });
    if (!lookup) return { id };
    return {
      id: lookup.id,
      name: lookup.name ?? undefined,
      externalReference: lookup.externalReference ?? undefined,
    };
  }

  private async resolveContacts(params: {
    tenantId: string;
    contacts: ContactInput[];
    tx: DrizzleDbOrTx;
  }): Promise<{ contactId: string; snapshot: Record<string, unknown> }[]> {
    const resolved: { contactId: string; snapshot: Record<string, unknown> }[] = [];

    for (const input of params.contacts) {
      let contactId = input.contactId?.trim() || undefined;
      let snapshot: Record<string, unknown>;

      if (contactId) {
        const existing = await this.contactsRepo.findOne({
          id: contactId,
          tenantId: params.tenantId,
        });
        if (!existing) {
          throw new BadRequestException(`Contact not found: ${contactId}`);
        }
        const type = await this.resolveContactType(params.tenantId, existing.typeLookupId);
        snapshot = {
          id: existing.id,
          firstName: existing.firstName ?? undefined,
          lastName: existing.lastName ?? undefined,
          email: existing.email ?? undefined,
          mobilePhone: existing.mobilePhone ?? undefined,
          homePhone: existing.homePhone ?? undefined,
          workPhone: existing.workPhone ?? undefined,
          notes: existing.notes ?? undefined,
          ...(type ? { type } : {}),
        };
      } else {
        const firstName = input.firstName?.trim();
        if (!firstName) {
          throw new BadRequestException('Contact firstName is required when contactId is not provided');
        }
        const typeLookupId = input.typeLookupId?.trim() || null;
        const created = await this.contactsRepo.create({
          data: {
            tenantId: params.tenantId,
            firstName,
            lastName: input.lastName?.trim() || null,
            email: input.email?.trim() || null,
            mobilePhone: input.mobilePhone?.trim() || null,
            homePhone: input.homePhone?.trim() || null,
            workPhone: input.workPhone?.trim() || null,
            notes: input.notes?.trim() || null,
            typeLookupId,
          },
          tx: params.tx,
        });
        contactId = created.id;
        const type = await this.resolveContactType(params.tenantId, created.typeLookupId);
        snapshot = {
          id: created.id,
          firstName: created.firstName ?? undefined,
          lastName: created.lastName ?? undefined,
          email: created.email ?? undefined,
          mobilePhone: created.mobilePhone ?? undefined,
          homePhone: created.homePhone ?? undefined,
          workPhone: created.workPhone ?? undefined,
          notes: created.notes ?? undefined,
          ...(type ? { type } : {}),
        };
      }

      resolved.push({ contactId, snapshot });
    }

    return resolved;
  }

  private buildInsertFromBody(
    body: Record<string, unknown>,
    contactSnapshots: Record<string, unknown>[] = [],
  ): Omit<JobInsert, 'tenantId' | 'connectionId' | 'syncStatus'> {
    const nestedJobType = body.jobType as { id?: string } | undefined;
    const jobTypeLookupId =
      (body.jobTypeLookupId as string | undefined) ?? nestedJobType?.id;

    const address =
      body.address && typeof body.address === 'object' && !Array.isArray(body.address)
        ? (body.address as Record<string, unknown>)
        : {};

    const asText = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;

    return {
      claimId: (body.claimId as string) ?? undefined,
      jobTypeLookupId: jobTypeLookupId as string,
      name: asText(body.name),
      externalReference: null,
      vendorId: (body.vendorId as string) ?? undefined,
      statusLookupId: (body.statusLookupId as string) ?? undefined,
      parentJobId: (body.parentJobId as string) ?? undefined,
      address,
      addressSuburb: asText(address.suburb),
      addressPostcode: asText(address.postcode),
      addressState: asText(address.state),
      addressCountry: asText(address.country),
      requestDate: (body.requestDate as string) ?? undefined,
      collectExcess: (body.collectExcess as boolean) ?? undefined,
      excess: body.excess != null ? String(body.excess) : undefined,
      makeSafeRequired: (body.makeSafeRequired as boolean) ?? undefined,
      jobInstructions: asText(body.jobInstructions),
      assignedToUserId: parseOptionalUserId(body.assignedToUserId) ?? undefined,
      apiPayload: contactSnapshots.length > 0 ? { contacts: contactSnapshots } : {},
    };
  }

  private buildUpdateFromBody(body: Record<string, unknown>): Partial<JobInsert> {
    const data: Partial<JobInsert> = {};
    if (body.claimId !== undefined) data.claimId = (body.claimId as string) || null;
    if (body.name !== undefined) data.name = (body.name as string) || null;
    if (body.vendorId !== undefined) data.vendorId = body.vendorId as string;
    if (body.statusLookupId !== undefined) data.statusLookupId = body.statusLookupId as string;
    if (body.address !== undefined) {
      const address =
        body.address && typeof body.address === 'object' && !Array.isArray(body.address)
          ? (body.address as Record<string, unknown>)
          : {};
      data.address = address;
      const asText = (value: unknown): string | null =>
        typeof value === 'string' && value.trim() ? value.trim() : null;
      data.addressSuburb = asText(address.suburb);
      data.addressPostcode = asText(address.postcode);
      data.addressState = asText(address.state);
      data.addressCountry = asText(address.country);
    }
    if (body.requestDate !== undefined) data.requestDate = body.requestDate as string;
    if (body.collectExcess !== undefined) data.collectExcess = body.collectExcess as boolean;
    if (body.excess !== undefined) data.excess = body.excess != null ? String(body.excess) : undefined;
    if (body.makeSafeRequired !== undefined) data.makeSafeRequired = body.makeSafeRequired as boolean;
    if (body.jobInstructions !== undefined) data.jobInstructions = body.jobInstructions as string;
    if (body.jobTypeLookupId !== undefined) data.jobTypeLookupId = body.jobTypeLookupId as string;
    if (body.parentJobId !== undefined) data.parentJobId = body.parentJobId as string;
    if (body.customData !== undefined) data.customData = body.customData as Record<string, unknown>;
    if (body.assignedToUserId !== undefined) {
      data.assignedToUserId = parseOptionalUserId(body.assignedToUserId) ?? null;
    }
    return data;
  }
}

function parseOptionalUserId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__unassigned__') return null;
  return trimmed;
}
