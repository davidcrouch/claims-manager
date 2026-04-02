import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.module';
import type { DrizzleDB } from '../../../database/drizzle.module';
import { tasks } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';
import { LookupResolver } from '../lookup-resolver.service';

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
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;

    this.logger.log(`CrunchworkTaskMapper.map — externalObjectId=${externalObjectId}`);

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'task');

    const claimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: (payload.claim as Record<string, unknown>)?.id as string,
      internalEntityType: 'claim',
    });

    const jobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: (payload.job as Record<string, unknown>)?.id as string,
      internalEntityType: 'job',
    });

    const priorityMap: Record<string, string> = {
      low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical',
    };
    const statusMap: Record<string, string> = {
      open: 'Open', completed: 'Completed', failed: 'Failed',
    };

    const rawPriority = ((payload.priority as string) ?? 'low').toLowerCase();
    const rawStatus = ((payload.status as string) ?? 'open').toLowerCase();

    const taskData = {
      tenantId: params.tenantId,
      name: (payload.name as string) ?? 'Untitled Task',
      description: payload.description as string ?? undefined,
      claimId: claimId ?? undefined,
      jobId: jobId ?? undefined,
      dueDate: payload.dueDate ? new Date(payload.dueDate as string) : undefined,
      priority: priorityMap[rawPriority] ?? 'Low',
      status: statusMap[rawStatus] ?? 'Open',
      assignedToExternalReference: payload.assignedTo as string ?? undefined,
      taskPayload: payload,
      updatedAt: new Date(),
    };

    if (existingLink) {
      await this.db
        .update(tasks)
        .set(taskData)
        .where(eq(tasks.id, existingLink.internalEntityId));
      return { internalEntityId: existingLink.internalEntityId, internalEntityType: 'task' };
    }

    const [created] = await this.db
      .insert(tasks)
      .values({ ...taskData, createdAt: new Date() })
      .returning();

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'task',
        internalEntityId: created!.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });

    return { internalEntityId: created!.id, internalEntityType: 'task' };
  }

  private async resolveFK(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string | undefined;
    internalEntityType: string;
  }): Promise<string | null> {
    if (!params.providerEntityId) return null;
    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      internalEntityType: params.internalEntityType,
    });
  }
}
