import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import { tasks } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';
import { LookupResolver } from '../lookup-resolver.service';
import { ParentNotProjectedError } from '../errors/parent-not-projected.error';

@Injectable()
export class CrunchworkTaskMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkTaskMapper');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
    private readonly lookupResolver: LookupResolver,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const db = params.tx ?? this.db;

    this.logger.log(
      `CrunchworkTaskMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx: params.tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'task',
    );

    const cwClaimId = this.extractProviderId({
      flat: payload.claimId,
      nested: payload.claim,
    });
    const cwJobId = this.extractProviderId({
      flat: payload.jobId,
      nested: payload.job,
    });

    const claimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: cwClaimId,
      internalEntityType: 'claim',
      tx: params.tx,
    });

    const jobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: cwJobId,
      internalEntityType: 'job',
      tx: params.tx,
    });

    if (!claimId && !jobId) {
      throw new ParentNotProjectedError(
        'task',
        externalObjectId,
        [
          {
            internalEntityType: 'job',
            providerEntityType: 'job',
            providerEntityId: cwJobId,
          },
          {
            internalEntityType: 'claim',
            providerEntityType: 'claim',
            providerEntityId: cwClaimId,
          },
        ],
        `CrunchworkTaskMapper.map — cannot create task ${externalObjectId}: ` +
          `neither claimId (${cwClaimId ?? 'missing'}) nor jobId (${cwJobId ?? 'missing'}) ` +
          `resolved to an internal entity. Task rows require at least one parent ` +
          `(chk_task_parent). The parent claim/job may not yet have been projected.`,
      );
    }

    const priorityMap: Record<string, string> = {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      critical: 'Critical',
    };
    const statusMap: Record<string, string> = {
      open: 'Open',
      completed: 'Completed',
      failed: 'Failed',
    };

    const rawPriority = ((payload.priority as string) ?? 'low').toLowerCase();
    const rawStatus = ((payload.status as string) ?? 'open').toLowerCase();

    const taskData = {
      tenantId: params.tenantId,
      name: (payload.name as string) ?? 'Untitled Task',
      description: (payload.description as string) ?? undefined,
      claimId: claimId ?? undefined,
      jobId: jobId ?? undefined,
      dueDate: payload.dueDate
        ? new Date(payload.dueDate as string)
        : undefined,
      priority: priorityMap[rawPriority] ?? 'Low',
      status: statusMap[rawStatus] ?? 'Open',
      assignedToExternalReference: (payload.assignedTo as string) ?? undefined,
      taskPayload: payload,
      updatedAt: new Date(),
    };

    if (existingLink) {
      await db
        .update(tasks)
        .set(taskData)
        .where(eq(tasks.id, existingLink.internalEntityId));
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'task',
      };
    }

    const [created] = await db
      .insert(tasks)
      .values({ ...taskData, createdAt: new Date() })
      .returning();

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'task',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx: params.tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'task' };
  }

  private async resolveFK(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string | undefined;
    internalEntityType: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.providerEntityId) return null;
    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      internalEntityType: params.internalEntityType,
      tx: params.tx,
    });
  }

  private extractProviderId(params: {
    flat: unknown;
    nested: unknown;
  }): string | undefined {
    if (typeof params.flat === 'string' && params.flat.length > 0) {
      return params.flat;
    }
    if (params.nested && typeof params.nested === 'object') {
      const nestedId = (params.nested as Record<string, unknown>).id;
      if (typeof nestedId === 'string' && nestedId.length > 0) {
        return nestedId;
      }
    }
    return undefined;
  }
}
