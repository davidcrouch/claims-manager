import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import { tasks } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
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

    // For new tasks, every parent referenced in the payload must be resolved
    // so we don't silently drop the job (or claim) link.
    if (!existingLink) {
      const missingParents: Array<{
        internalEntityType: string;
        providerEntityType: string;
        providerEntityId: string | undefined;
      }> = [];
      if (cwJobId && !jobId) {
        missingParents.push({ internalEntityType: 'job', providerEntityType: 'job', providerEntityId: cwJobId });
      }
      if (cwClaimId && !claimId) {
        missingParents.push({ internalEntityType: 'claim', providerEntityType: 'claim', providerEntityId: cwClaimId });
      }
      if (missingParents.length > 0) {
        throw new ParentNotProjectedError(
          'task',
          externalObjectId,
          missingParents,
          `CrunchworkTaskMapper.map — cannot create task ${externalObjectId}: ` +
            `unresolved parents: ${missingParents.map((p) => `${p.providerEntityType}:${p.providerEntityId ?? 'missing'}`).join(', ')}. ` +
            `The parent claim/job may not yet have been projected.`,
        );
      }
      if (!claimId && !jobId) {
        throw new ParentNotProjectedError(
          'task',
          externalObjectId,
          [],
          `CrunchworkTaskMapper.map — cannot create task ${externalObjectId}: ` +
            `no parent references in payload.`,
        );
      }
    } else if (!claimId && !jobId) {
      this.logger.warn(
        `CrunchworkTaskMapper.map — updating task ${externalObjectId} but neither parent resolved`,
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

    const relatedEntityType = jobId ? 'Job' : 'Claim';
    const relatedEntityId = (jobId ?? claimId)!;

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
      ...(jobId || claimId
        ? { relatedEntityType, relatedEntityId }
        : {}),
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

    // New tasks always have a resolved parent (enforced above).
    const [created] = await db
      .insert(tasks)
      .values({
        tenantId: params.tenantId,
        name: (payload.name as string) ?? 'Untitled Task',
        description: (payload.description as string) ?? undefined,
        claimId: claimId ?? undefined,
        jobId: jobId ?? undefined,
        relatedEntityType,
        relatedEntityId,
        dueDate: payload.dueDate
          ? new Date(payload.dueDate as string)
          : undefined,
        priority: priorityMap[rawPriority] ?? 'Low',
        status: statusMap[rawStatus] ?? 'Open',
        assignedToExternalReference:
          (payload.assignedTo as string) ?? undefined,
        taskPayload: payload,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
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
