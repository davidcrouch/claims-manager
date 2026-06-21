import { Injectable, Inject, Optional, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { JobsRepository, type JobInsert, type JobViewRow } from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly tenantContext: TenantContext,
    private readonly outboundSync: OutboundSyncService,
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
  }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(`JobsService.findAll — tenantId=${tenantId} claimId=${params.claimId ?? 'all'}`);
    const result = await this.jobsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      claimId: params.claimId,
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
    const { statusName, statusExternalReference, jobTypeName, jobTypeExternalReference, vendorName, vendorExternalReference, ...rest } = row;
    return {
      ...rest,
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

    this.logger.debug(
      `JobsService.create — tenantId=${tenantId} provider=${providerCode} connectionId=${connectionId} needsSync=${needsSync}`,
    );

    const job = await this.db.transaction(async (tx) => {
      const inserted = await this.jobsRepo.create({
        data: {
          tenantId,
          connectionId: connectionId !== tenantId ? connectionId : undefined,
          syncStatus: needsSync ? 'pending' : null,
          ...this.buildInsertFromBody(params.body),
        },
        tx,
      });

      if (needsSync) {
        await this.outboundSync.enqueue({
          tenantId,
          connectionId,
          entityType: 'job',
          entityId: inserted.id,
          action: 'create',
          payload: params.body,
          idempotencyKey: `create:job:${inserted.id}`,
          tx,
        });
      }

      return inserted;
    });

    return job;
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

    return job;
  }

  private buildInsertFromBody(body: Record<string, unknown>): Omit<JobInsert, 'tenantId' | 'connectionId' | 'syncStatus'> {
    return {
      claimId: body.claimId as string,
      jobTypeLookupId: body.jobTypeLookupId as string,
      externalReference: null,
      vendorId: (body.vendorId as string) ?? undefined,
      statusLookupId: (body.statusLookupId as string) ?? undefined,
      parentJobId: (body.parentJobId as string) ?? undefined,
      address: (body.address as Record<string, unknown>) ?? {},
      requestDate: (body.requestDate as string) ?? undefined,
      collectExcess: (body.collectExcess as boolean) ?? undefined,
      excess: body.excess != null ? String(body.excess) : undefined,
      makeSafeRequired: (body.makeSafeRequired as boolean) ?? undefined,
      jobInstructions: (body.jobInstructions as string) ?? undefined,
      apiPayload: {},
    };
  }

  private buildUpdateFromBody(body: Record<string, unknown>): Partial<JobInsert> {
    const data: Partial<JobInsert> = {};
    if (body.vendorId !== undefined) data.vendorId = body.vendorId as string;
    if (body.statusLookupId !== undefined) data.statusLookupId = body.statusLookupId as string;
    if (body.address !== undefined) data.address = body.address as Record<string, unknown>;
    if (body.requestDate !== undefined) data.requestDate = body.requestDate as string;
    if (body.collectExcess !== undefined) data.collectExcess = body.collectExcess as boolean;
    if (body.excess !== undefined) data.excess = body.excess != null ? String(body.excess) : undefined;
    if (body.makeSafeRequired !== undefined) data.makeSafeRequired = body.makeSafeRequired as boolean;
    if (body.jobInstructions !== undefined) data.jobInstructions = body.jobInstructions as string;
    if (body.jobTypeLookupId !== undefined) data.jobTypeLookupId = body.jobTypeLookupId as string;
    if (body.parentJobId !== undefined) data.parentJobId = body.parentJobId as string;
    return data;
  }
}
