import { Injectable, Inject, Optional, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import {
  JobsRepository,
  ContactsRepository,
  LookupsRepository,
  ClaimsRepository,
  ClaimContactsRepository,
  type JobInsert,
  type JobViewRow,
} from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { LookupResolver } from '../external/lookup-resolver.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';
import { CrunchworkOutboundAdapter } from '../domain/outbound/adapters/crunchwork-outbound.adapter';
import { FilesystemService } from '../filesystem/filesystem.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import {
  asNonEmptyString,
  buildCrunchworkJobCreateBody,
  claimApiContactsToOutbound,
  isCwUsableLookupRef,
  lookupToCwObject,
  type CwContactOutbound,
} from './job-outbound.utils';
import { RecordNumberService } from '../../common/record-number/record-number.service';
import { resolveWorkflowCapability } from '../../common/job-kind-caps';

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
  /** CW / partner external reference — used when seeding from claim contacts. */
  externalReference?: string;
  typeExternalReference?: string;
  typeName?: string;
};

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly contactsRepo: ContactsRepository,
    private readonly jobContactsRepo: JobContactsRepository,
    private readonly claimContactsRepo: ClaimContactsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly tenantContext: TenantContext,
    private readonly outboundSync: OutboundSyncService,
    private readonly crunchworkOutbound: CrunchworkOutboundAdapter,
    private readonly lookupResolver: LookupResolver,
    private readonly filesystemService: FilesystemService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly recordNumberService: RecordNumberService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
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
    assignedToUserIds?: string;
    refs?: string;
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
      assignedToUserIds: params.assignedToUserIds,
      refs: params.refs,
    });
    const jobIds = result.data.map((row) => row.id);
    const claimIds = [
      ...new Set(
        result.data
          .map((row) => row.claimId)
          .filter((id): id is string => !!id),
      ),
    ];
    const [jobInsuredRows, claimInsuredRows] = jobIds.length
      ? await Promise.all([
          this.jobsRepo.findInsuredNamesByJobIds({ tenantId, jobIds }),
          claimIds.length
            ? this.claimsRepo.findInsuredNamesByClaimIds({ tenantId, claimIds })
            : Promise.resolve([]),
        ])
      : [[], []];
    const jobInsuredByJobId = new Map(
      jobInsuredRows.map((row) => [row.jobId, row.insuredName] as const),
    );
    const claimInsuredByClaimId = new Map(
      claimInsuredRows.map((row) => [row.claimId, row.insuredName] as const),
    );
    return {
      data: result.data.map((row) => ({
        ...this.shapeJobResponse(row),
        insuredName:
          jobInsuredByJobId.get(row.id) ??
          (row.claimId ? claimInsuredByClaimId.get(row.claimId) : null) ??
          null,
      })),
      total: result.total,
    };
  }

  async findFilterOptions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.jobsRepo.findFilterOptions({ tenantId });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!job) throw new NotFoundException('Job not found');
    return this.shapeJobResponse(job);
  }

  async getRelatedCounts(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!job) throw new NotFoundException('Job not found');
    this.logger.debug(`JobsService.getRelatedCounts — jobId=${params.id}`);
    return this.jobsRepo.countRelatedByJob({ tenantId, jobId: params.id });
  }

  private shapeJobResponse(row: JobViewRow) {
    const { statusName, statusExternalReference, jobTypeName, jobTypeExternalReference, vendorName, vendorExternalReference, connectionProviderCode, assigneeName, ...rest } = row;
    const payload = (rest.apiPayload ?? {}) as Record<string, unknown>;
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const externalRef = (rest.externalReference ?? '').trim() || payloadId;
    const syncStatus = rest.syncStatus ?? (externalRef ? 'synced' : null);
    return {
      ...rest,
      syncStatus,
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

    const body = { ...params.body };
    const claimId =
      typeof body.claimId === 'string' && body.claimId.trim()
        ? body.claimId.trim()
        : undefined;

    const claim = claimId
      ? await this.claimsRepo.findOne({ id: claimId, tenantId })
      : null;
    if (claimId && !claim) {
      throw new BadRequestException(`Claim not found: ${claimId}`);
    }

    const claimApiPayload =
      claim?.apiPayload && typeof claim.apiPayload === 'object' && !Array.isArray(claim.apiPayload)
        ? (claim.apiPayload as Record<string, unknown>)
        : null;
    const claimCwContacts = claimApiContactsToOutbound(claimApiPayload);

    let contactsInput = Array.isArray(body.contacts)
      ? ([...body.contacts] as ContactInput[])
      : [];

    // Always attach claim CW contacts when present so local job_contacts match
    // what we publish to NRMA (inbound often omits contacts[].externalReference
    // and only sends contacts[].id — we fall back to id).
    if (claimCwContacts.length > 0) {
      const seeded = claimCwContacts.map((c) => ({
        externalReference: c.externalReference,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        mobilePhone: c.mobilePhone,
        homePhone: c.homePhone,
        workPhone: c.workPhone,
        notes: c.notes,
        typeExternalReference: c.type.externalReference,
        typeName: c.type.name,
      }));
      const seededExt = new Set(seeded.map((c) => c.externalReference));
      const extras = contactsInput.filter((c) => {
        const ext = c.externalReference?.trim();
        return !ext || !seededExt.has(ext);
      });
      contactsInput = [...seeded, ...extras];
      this.logger.debug(
        `JobsService.create — using ${seeded.length} claim contact(s)` +
          (extras.length ? ` + ${extras.length} additional` : ''),
      );
    }

    this.logger.debug(
      `JobsService.create — tenantId=${tenantId} provider=${providerCode} connectionId=${connectionId} needsSync=${needsSync} contacts=${contactsInput.length}`,
    );

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

    // Builder Make Safe jobs must publish with makeSafeRequired=true.
    await this.applyMakeSafeRequiredDefault({ tenantId, body });

    const parentJobId =
      typeof body.parentJobId === 'string' && body.parentJobId.trim()
        ? body.parentJobId.trim()
        : undefined;
    const parentJob = parentJobId
      ? await this.jobsRepo.findByIdAndTenant({ id: parentJobId, tenantId })
      : null;
    if (parentJobId && !parentJob) {
      throw new BadRequestException(`Parent job not found: ${parentJobId}`);
    }
    if (parentJob && claimId && parentJob.claimId && parentJob.claimId !== claimId) {
      throw new BadRequestException('Parent job must belong to the same claim');
    }

    const { job, outboundPayload } = await this.db.transaction(async (tx) => {
      const resolvedContacts = await this.resolveContacts({
        tenantId,
        contacts: contactsInput,
        tx,
      });

      const insertBase = this.buildInsertFromBody(
        body,
        resolvedContacts.map((c) => c.snapshot),
      );
      if (!this.recordNumberService.isBlank(body.externalReference)) {
        insertBase.externalReference = String(body.externalReference).trim();
      }
      const { internalNumber, externalJobId } = await this.resolveJobInternalNumber({
        tenantId,
        explicitInternal: body.internalNumber,
        parentJob,
        tx,
      });
      insertBase.internalNumber = internalNumber;
      if (externalJobId) {
        insertBase.externalJobId = externalJobId;
      }

      const inserted = await this.jobsRepo.create({
        data: {
          tenantId,
          connectionId: connectionId !== tenantId ? connectionId : undefined,
          syncStatus: needsSync ? 'pending' : null,
          ...insertBase,
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

        // Keep claim↔contact join in sync when seeding from a claim
        if (claimId) {
          await this.claimContactsRepo.upsert({
            data: {
              tenantId,
              claimId,
              contactId: contact.contactId,
              sortIndex: i,
              sourcePayload: contact.snapshot,
            },
            tx,
          });
        }
      }

      let createOutboundPayload: Record<string, unknown> | null = null;
      if (needsSync) {
        createOutboundPayload = await this.buildOutboundCreatePayload({
          tenantId,
          body,
          claim,
          claimApiPayload,
        });
      }

      return { job: inserted, outboundPayload: createOutboundPayload };
    });

    this.logger.debug(
      `JobsService.create — id=${job.id} assignedToUserId=${job.assignedToUserId ?? 'none'}`,
    );

    if (needsSync && outboundPayload) {
      try {
        await this.outboundSync.enqueue({
          tenantId,
          connectionId,
          entityType: 'job',
          entityId: job.id,
          action: 'create',
          payload: outboundPayload,
          sourceEvent: 'api:create',
          idempotencyKey: `job:${job.id}:create`,
          tx: this.db,
        });
      } catch (err) {
        this.logger.warn(
          `JobsService.create — failed to enqueue outbound sync for job ${job.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

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

    if (this.outboundEvents) {
      const jobTypeLookupId = (params.body.jobTypeLookupId as string) ??
        (params.body.jobType as { id?: string } | undefined)?.id ?? '';

      this.outboundEvents.emitJobCreated({
        jobId: job.id,
        tenantId,
        jobType: jobTypeLookupId,
        claimId: (params.body.claimId as string) ?? undefined,
        parentJobId: (params.body.parentJobId as string) ?? undefined,
      }).catch(() => {});

      this.startWorkflowForJob(tenantId, job.id, jobTypeLookupId).catch(() => {});
    }

    return this.findOne({ id: job.id });
  }

  /** @deprecated Replaced by resolveWorkflowCapability() from common/job-kind-caps.ts */
  private static readonly WORKFLOW_CAP_MAP: Record<string, string> = {};

  private static readonly WORKFLOW_PHASE_STATUS_MAP: Record<string, string> = {
    'allocated': 'Allocated',
    'contacted': 'Contacted',
    'scheduled': 'Scheduled',
    'awaiting_submission': 'Awaiting Submission',
    'awaiting_review': 'Awaiting Review',
    'awaiting_resubmission': 'Awaiting Resubmission',
    'awaiting_scope': 'Awaiting Scope',
    'scope_signed': 'Scope Signed',
    'awaiting_excess': 'Awaiting Excess',
    'excess_collected': 'Excess Collected',
    'repairs_in_progress': 'Repairs In Progress',
    'repairs_complete': 'Repairs Complete',
    'certificate_uploaded': 'Repairs Complete',
    'completion_confirmed': 'Repairs Complete',
    'quote_finalized': 'Quote Finalized',
    'cancelled': 'Cancelled',
    'complete': 'Job Complete',
  };

  private async startWorkflowForJob(
    tenantId: string,
    jobId: string,
    jobTypeLookupId: string,
  ): Promise<void> {
    if (!this.outboundEvents || !jobTypeLookupId) return;

    try {
      const lookupMap = await this.lookupsRepo.findByIds({
        ids: [jobTypeLookupId],
        tenantId,
      });
      const lookup = lookupMap.get(jobTypeLookupId);
      if (!lookup || !lookup.name) return;

      const cap = resolveWorkflowCapability(lookup.name);
      if (!cap) return;

      const job = await this.jobsRepo.findOne({ id: jobId, tenantId });

      const relatedLookups = await this.lookupsRepo.findByDomainAndNames({
        tenantId,
        domain: 'job_type',
        names: ['Builder Make Safe', 'Builder - Scope of Works'],
      });

      const customData = (job?.customData ?? {}) as Record<string, unknown>;

      this.logger.log(
        `JobsService.startWorkflowForJob — jobId=${jobId} type="${lookup.name}" cap=${cap}`,
      );

      await this.outboundEvents.invokeWorkflow({
        cap,
        tenantId,
        workflowParams: {
          jobId,
          entityType: 'job',
          entityId: jobId,
          requestDate: new Date().toISOString(),
          claimId: job?.claimId ?? null,
          collectExcess: job?.collectExcess ?? false,
          excess: job?.excess ?? null,
          claimRecommendation: (customData.claimRecommendation as string) ?? null,
          lookups: {
            makeSafeJobType: relatedLookups.get('Builder Make Safe') ?? null,
            worksJobType: relatedLookups.get('Builder - Scope of Works') ?? null,
          },
        },
      });
    } catch (err) {
      this.logger.warn(
        `JobsService.startWorkflowForJob — failed for jobId=${jobId}: ${(err as Error).message}`,
      );
    }
  }

  async calculateWorkflowDates(params: {
    id: string;
    contactDate?: string;
    attendanceDate?: string;
  }): Promise<{ attendanceDueDate: string | null; submissionDueDate: string | null }> {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.jobsRepo.findOne({ id: params.id, tenantId });
    if (!job) throw new BadRequestException('Job not found');

    const ATTENDANCE_SLA_DAYS = 5;
    const SUBMISSION_SLA_DAYS = 10;

    let attendanceDueDate: string | null = null;
    let submissionDueDate: string | null = null;

    const customData = (job.customData ?? {}) as Record<string, unknown>;
    const contactDate = params.contactDate
      ?? (customData.contactDate as string | undefined);
    const attendanceDate = params.attendanceDate
      ?? (customData.attendanceDate as string | undefined);

    if (contactDate) {
      attendanceDueDate = JobsService.addBusinessDays(new Date(contactDate), ATTENDANCE_SLA_DAYS).toISOString();
    }
    if (attendanceDate) {
      submissionDueDate = JobsService.addBusinessDays(new Date(attendanceDate), SUBMISSION_SLA_DAYS).toISOString();
    }

    this.logger.debug(
      `JobsService.calculateWorkflowDates — jobId=${params.id} contactDate=${contactDate ?? 'none'} attendanceDate=${attendanceDate ?? 'none'} => attendanceDue=${attendanceDueDate ?? 'none'} submissionDue=${submissionDueDate ?? 'none'}`,
    );

    return { attendanceDueDate, submissionDueDate };
  }

  private static addBusinessDays(start: Date, days: number): Date {
    const result = new Date(start);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const dow = result.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return result;
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
        const existingApi = (existing.apiPayload as Record<string, unknown> | null) ?? {};
        const existingCwCustom =
          existingApi.customData &&
          typeof existingApi.customData === 'object' &&
          !Array.isArray(existingApi.customData)
            ? (existingApi.customData as Record<string, unknown>)
            : undefined;
        await this.outboundSync.enqueue({
          tenantId,
          connectionId,
          entityType: 'job',
          entityId: params.id,
          action: 'update',
          payload: {
            ...params.body,
            externalId: existing.externalReference,
            ...(existingCwCustom ? { cwCustomData: existingCwCustom } : {}),
          },
          idempotencyKey: `update:job:${params.id}:${Date.now()}`,
          tx,
        });
      }

      return updated;
    });

    const emittedFields = new Set<string>();

    if (this.outboundEvents && params.body.customData) {
      const custom = params.body.customData as Record<string, unknown>;
      const trackedFields = [
        'makeSafeRequired', 'scopeSignedDate', 'excessPaymentCollected',
        'workflowPhase', 'estimatedDatesSet', 'dateCustomerConfirmedCompletion',
        'dateMakeSafeCompleted',
      ];
      for (const field of trackedFields) {
        if (custom[field] !== undefined) {
          emittedFields.add(field);
          this.outboundEvents.emitFieldUpdated({
            entityType: 'job',
            entityId: params.id,
            tenantId,
            field,
            value: custom[field],
          }).catch(() => {});
        }
      }

      if (custom.workflowPhase !== undefined) {
        const statusName = JobsService.WORKFLOW_PHASE_STATUS_MAP[custom.workflowPhase as string];
        if (statusName) {
          const statusId = await this.lookupResolver.resolveByName({
            tenantId,
            domain: 'job_status',
            name: statusName,
          });
          if (statusId) {
            await this.jobsRepo.update({
              id: params.id,
              data: { statusLookupId: statusId },
            });
          }
        }
      }
    }

    if (
      this.outboundEvents &&
      params.body.makeSafeRequired !== undefined &&
      !emittedFields.has('makeSafeRequired')
    ) {
      const oldValue = (existing as Record<string, unknown>).makeSafeRequired;
      const newValue = params.body.makeSafeRequired as boolean;
      if (oldValue !== newValue) {
        this.outboundEvents.emitFieldUpdated({
          entityType: 'job',
          entityId: params.id,
          tenantId,
          field: 'makeSafeRequired',
          value: newValue,
          previousValue: oldValue,
        }).catch(() => {});
      }
    }

    if (
      this.outboundEvents &&
      params.body.customData &&
      !emittedFields.has('estimatedDatesSet')
    ) {
      const custom = params.body.customData as Record<string, unknown>;
      if (custom.estimatedStartDate || custom.estimatedCompletionDate) {
        const refreshed = await this.jobsRepo.findOne({ id: params.id, tenantId });
        const merged = (refreshed?.customData ?? {}) as Record<string, unknown>;
        if (merged.estimatedStartDate && merged.estimatedCompletionDate && !merged.estimatedDatesSet) {
          await this.jobsRepo.update({
            id: params.id,
            data: {
              customData: { ...merged, estimatedDatesSet: true },
            },
          });
          this.outboundEvents.emit({
            eventType: 'field.updated',
            entityType: 'job',
            entityId: params.id,
            tenantId,
            payload: {
              field: 'estimatedDatesSet',
              value: true,
              estimatedStartDate: merged.estimatedStartDate,
              estimatedCompletionDate: merged.estimatedCompletionDate,
              scheduledAt: new Date().toISOString(),
            },
          }).catch(() => {});
        }
      }
    }

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

  private async applyMakeSafeRequiredDefault(params: {
    tenantId: string;
    body: Record<string, unknown>;
  }): Promise<void> {
    const nestedJobType = params.body.jobType as { id?: string } | undefined;
    const jobTypeLookupId =
      (params.body.jobTypeLookupId as string | undefined) ?? nestedJobType?.id;
    if (!jobTypeLookupId) return;

    const jobTypeLookup = await this.lookupsRepo.findOne({
      id: jobTypeLookupId,
      tenantId: params.tenantId,
    });
    const name = (jobTypeLookup?.name ?? '').trim().toLowerCase();
    if (name !== 'builder make safe') return;

    if (params.body.makeSafeRequired !== true) {
      this.logger.debug(
        'JobsService.applyMakeSafeRequiredDefault — forcing makeSafeRequired=true for Builder Make Safe',
      );
      params.body.makeSafeRequired = true;
    }
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

  private async resolveTypeLookupId(params: {
    tenantId: string;
    typeExternalReference?: string;
    typeName?: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    const ext = params.typeExternalReference?.trim();
    if (!ext) return null;
    return (
      (await this.lookupResolver.resolve({
        tenantId: params.tenantId,
        domain: 'contact_type',
        externalReference: ext,
        name: params.typeName?.trim() || ext,
        autoCreate: true,
        tx: params.tx,
      })) ?? null
    );
  }

  private async buildOutboundCreatePayload(params: {
    tenantId: string;
    body: Record<string, unknown>;
    claim: Awaited<ReturnType<ClaimsRepository['findOne']>>;
    claimApiPayload: Record<string, unknown> | null;
  }): Promise<Record<string, unknown>> {
    const nestedJobType = params.body.jobType as { id?: string } | undefined;
    const jobTypeLookupId =
      (params.body.jobTypeLookupId as string | undefined) ?? nestedJobType?.id;
    if (!jobTypeLookupId) {
      throw new BadRequestException('jobTypeLookupId is required for Crunchwork sync');
    }

    const jobTypeLookup = await this.lookupsRepo.findOne({
      id: jobTypeLookupId,
      tenantId: params.tenantId,
    });
    const jobType = lookupToCwObject(jobTypeLookup);
    if (!jobType) {
      throw new BadRequestException(
        `Job type lookup ${jobTypeLookupId} has no usable Crunchwork externalReference`,
      );
    }

    const makeSafeRequired =
      (jobTypeLookup?.name ?? '').trim().toLowerCase() === 'builder make safe'
        ? true
        : typeof params.body.makeSafeRequired === 'boolean'
          ? params.body.makeSafeRequired
          : undefined;

    const cwClaimId =
      asNonEmptyString(params.claimApiPayload?.id) ??
      asNonEmptyString(params.claim?.externalReference);
    if (!cwClaimId) {
      throw new BadRequestException(
        'Claim has no Crunchwork id/externalReference — cannot publish job to NRMA',
      );
    }

    let status: { externalReference: string; name?: string } | null = null;
    const statusLookupId = params.body.statusLookupId as string | undefined;
    if (statusLookupId) {
      const statusLookup = await this.lookupsRepo.findOne({
        id: statusLookupId,
        tenantId: params.tenantId,
      });
      status = lookupToCwObject(statusLookup);
    }

    // Do not send contacts on CW create: re-posting claim contacts returns
    // 400 (missing fields) or 500 Not Authorised. CW copies them from the claim.
    const address =
      params.body.address &&
      typeof params.body.address === 'object' &&
      !Array.isArray(params.body.address)
        ? (params.body.address as Record<string, unknown>)
        : null;

    return buildCrunchworkJobCreateBody({
      cwClaimId,
      jobType,
      status,
      address,
      makeSafeRequired,
      collectExcess:
        typeof params.body.collectExcess === 'boolean'
          ? params.body.collectExcess
          : undefined,
      excess:
        params.body.excess != null ? (params.body.excess as number | string) : null,
      jobInstructions: asNonEmptyString(params.body.jobInstructions) ?? null,
      requestDate: asNonEmptyString(params.body.requestDate) ?? null,
    });
  }

  private snapshotsToOutboundContacts(
    snapshots: Record<string, unknown>[],
  ): CwContactOutbound[] {
    const out: CwContactOutbound[] = [];
    for (const snap of snapshots) {
      const externalReference = asNonEmptyString(snap.externalReference);
      if (!externalReference || !isCwUsableLookupRef(externalReference)) continue;

      const typeObj = snap.type;
      let typeExt: string | undefined;
      let typeName: string | undefined;
      if (typeObj && typeof typeObj === 'object' && !Array.isArray(typeObj)) {
        const t = typeObj as Record<string, unknown>;
        typeExt = asNonEmptyString(t.externalReference);
        typeName = asNonEmptyString(t.name);
      }
      if (!typeExt || !isCwUsableLookupRef(typeExt)) continue;

      out.push({
        externalReference,
        firstName: asNonEmptyString(snap.firstName),
        lastName: asNonEmptyString(snap.lastName),
        email: asNonEmptyString(snap.email),
        mobilePhone: asNonEmptyString(snap.mobilePhone),
        homePhone: asNonEmptyString(snap.homePhone),
        workPhone: asNonEmptyString(snap.workPhone),
        notes: asNonEmptyString(snap.notes),
        type: {
          externalReference: typeExt,
          ...(typeName ? { name: typeName } : {}),
        },
      });
    }
    return out;
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
          externalReference: existing.externalReference ?? undefined,
          firstName: existing.firstName ?? undefined,
          lastName: existing.lastName ?? undefined,
          email: existing.email ?? undefined,
          mobilePhone: existing.mobilePhone ?? undefined,
          homePhone: existing.homePhone ?? undefined,
          workPhone: existing.workPhone ?? undefined,
          notes: existing.notes ?? undefined,
          ...(type ? { type } : {}),
        };
      } else if (input.externalReference?.trim()) {
        const externalReference = input.externalReference.trim();
        const typeLookupId =
          (await this.resolveTypeLookupId({
            tenantId: params.tenantId,
            typeExternalReference: input.typeExternalReference,
            typeName: input.typeName,
            tx: params.tx,
          })) ??
          (input.typeLookupId?.trim() || null);

        const created = await this.contactsRepo.upsertByExternalReference({
          data: {
            tenantId: params.tenantId,
            externalReference,
            firstName: input.firstName?.trim() || null,
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
        const type =
          (await this.resolveContactType(params.tenantId, created.typeLookupId)) ??
          (input.typeExternalReference
            ? {
                externalReference: input.typeExternalReference,
                name: input.typeName ?? input.typeExternalReference,
              }
            : undefined);
        snapshot = {
          id: created.id,
          externalReference,
          firstName: created.firstName ?? undefined,
          lastName: created.lastName ?? undefined,
          email: created.email ?? undefined,
          mobilePhone: created.mobilePhone ?? undefined,
          homePhone: created.homePhone ?? undefined,
          workPhone: created.workPhone ?? undefined,
          notes: created.notes ?? undefined,
          ...(type ? { type } : {}),
        };
      } else {
        const firstName = input.firstName?.trim();
        if (!firstName) {
          throw new BadRequestException('Contact firstName is required when contactId is not provided');
        }
        const typeLookupId =
          (await this.resolveTypeLookupId({
            tenantId: params.tenantId,
            typeExternalReference: input.typeExternalReference,
            typeName: input.typeName,
            tx: params.tx,
          })) ??
          (input.typeLookupId?.trim() || null);
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

  /**
   * Same allocation rules as inbound webhook ingest (`ProjectJobUseCase`):
   * reuse an existing internal number when jobs share an insurer ref
   * (`external_job_id`), otherwise assign the next sequence value.
   */
  private async resolveJobInternalNumber(params: {
    tenantId: string;
    explicitInternal?: unknown;
    parentJob?: { id?: string; internalNumber?: string | null; externalJobId?: string | null } | null;
    tx: DrizzleDbOrTx;
  }): Promise<{ internalNumber: string; externalJobId: string | null }> {
    if (!this.recordNumberService.isBlank(params.explicitInternal)) {
      const insurerRef = params.parentJob?.externalJobId?.trim() || null;
      return {
        internalNumber: String(params.explicitInternal).trim(),
        externalJobId: insurerRef,
      };
    }

    const insurerRef = params.parentJob?.externalJobId?.trim() || null;
    if (insurerRef) {
      const reusedInternalNumber = await this.jobsRepo.findInternalNumberByExternalJobId({
        tenantId: params.tenantId,
        externalJobId: insurerRef,
        tx: params.tx,
      });
      if (reusedInternalNumber) {
        this.logger.log(
          `JobsService.resolveJobInternalNumber — reused internalNumber=${reusedInternalNumber} for insurer ref ${insurerRef}`,
        );
        return { internalNumber: reusedInternalNumber, externalJobId: insurerRef };
      }
    }

    const parentInternalNumber = params.parentJob?.internalNumber?.trim() || null;
    if (parentInternalNumber) {
      if (!insurerRef) {
        throw new BadRequestException(
          'Parent job has no insurer reference yet; sync the parent job to Crunchwork before creating a related job.',
        );
      }
      this.logger.log(
        `JobsService.resolveJobInternalNumber — reused parent internalNumber=${parentInternalNumber} insurerRef=${insurerRef}`,
      );
      return { internalNumber: parentInternalNumber, externalJobId: insurerRef };
    }

    const internalNumber = await this.recordNumberService.next({
      tenantId: params.tenantId,
      entity: 'job',
      tx: params.tx,
    });
    this.logger.log(
      `JobsService.resolveJobInternalNumber — assigned internalNumber=${internalNumber}`,
    );
    return { internalNumber, externalJobId: insurerRef };
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
    if (body.externalReference !== undefined) {
      data.externalReference =
        typeof body.externalReference === 'string' && body.externalReference.trim()
          ? body.externalReference.trim()
          : null;
    }
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
    if (body.vendorSnapshot !== undefined && body.vendorSnapshot && typeof body.vendorSnapshot === 'object') {
      data.vendorSnapshot = body.vendorSnapshot as Record<string, unknown>;
    }
    if (
      body.temporaryAccommodationDetails !== undefined &&
      body.temporaryAccommodationDetails &&
      typeof body.temporaryAccommodationDetails === 'object'
    ) {
      data.temporaryAccommodationDetails =
        body.temporaryAccommodationDetails as Record<string, unknown>;
    }
    if (
      body.specialistDetails !== undefined &&
      body.specialistDetails &&
      typeof body.specialistDetails === 'object'
    ) {
      data.specialistDetails = body.specialistDetails as Record<string, unknown>;
    }
    if (
      body.rectificationDetails !== undefined &&
      body.rectificationDetails &&
      typeof body.rectificationDetails === 'object'
    ) {
      data.rectificationDetails = body.rectificationDetails as Record<string, unknown>;
    }
    if (body.auditDetails !== undefined && body.auditDetails && typeof body.auditDetails === 'object') {
      data.auditDetails = body.auditDetails as Record<string, unknown>;
    }
    if (body.mobilityConsiderations !== undefined) {
      data.mobilityConsiderations = Array.isArray(body.mobilityConsiderations)
        ? body.mobilityConsiderations
        : [];
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
