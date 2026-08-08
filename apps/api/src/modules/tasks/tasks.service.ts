import { Injectable, Optional, BadRequestException, Logger } from '@nestjs/common';
import { TasksRepository, type TaskInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

function parseOptionalUserId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__unassigned__') return null;
  return trimmed;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly tasksRepo: TasksRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    claimId?: string;
    status?: string;
    priority?: string;
    entityType?: string;
    entityId?: string;
    assignedToUserId?: string;
    overdue?: boolean;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      claimId: params.claimId,
      status: params.status,
      priority: params.priority,
      entityType: params.entityType,
      entityId: params.entityId,
      assignedToUserId: params.assignedToUserId,
      overdue: params.overdue,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findByJob({ jobId: params.jobId, tenantId });
  }

  async findByClaim(params: { claimId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findByClaim({ claimId: params.claimId, tenantId });
  }

  async findByEntity(params: { entityType: string; entityId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findByEntity({
      tenantId,
      entityType: params.entityType,
      entityId: params.entityId,
    });
  }

  async findOverdue() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findOverdue({ tenantId });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();

    const relatedEntityType = (params.body.relatedEntityType as string) ?? 'Job';
    const relatedEntityId = (params.body.relatedEntityId as string) ??
      (params.body.jobId as string) ?? (params.body.claimId as string);

    let claimId = params.body.claimId as string | undefined;
    let jobId = params.body.jobId as string | undefined;

    if (relatedEntityType === 'Job') {
      jobId = relatedEntityId;
    } else if (relatedEntityType === 'Claim') {
      claimId = relatedEntityId;
    }

    const assignedToUserId = parseOptionalUserId(params.body.assignedToUserId) ?? undefined;
    this.logger.debug(
      `TasksService.create — tenantId=${tenantId} assignedToUserId=${assignedToUserId ?? 'none'}`,
    );

    try {
      const connectionId = await this.resolveConnectionId(tenantId);
      const apiTask = await this.crunchworkService.createTask({
        connectionId,
        body: params.body,
      });

      const apiObj = apiTask as Record<string, unknown>;
      const insertData: TaskInsert = {
        tenantId,
        relatedEntityType,
        relatedEntityId,
        claimId: (apiObj.claimId ?? claimId) as string,
        jobId: (apiObj.jobId ?? jobId) as string,
        name: (apiObj.name ?? params.body?.name) as string,
        description: apiObj.description as string,
        dueDate: apiObj.dueDate ? new Date(apiObj.dueDate as string) : undefined,
        priority: (apiObj.priority ?? params.body?.priority ?? 'Low') as string,
        status: (apiObj.status ?? 'Open') as string,
        assignedToUserId,
        taskPayload: apiTask as Record<string, unknown>,
      };
      return this.tasksRepo.create({ data: insertData });
    } catch {
      const insertData: TaskInsert = {
        tenantId,
        relatedEntityType,
        relatedEntityId,
        claimId: claimId as string,
        jobId: jobId as string,
        name: params.body.name as string,
        description: params.body.description as string,
        dueDate: params.body.dueDate ? new Date(params.body.dueDate as string) : undefined,
        priority: (params.body.priority as string) ?? 'Low',
        status: 'Open',
        assignedToUserId,
        taskPayload: {},
      };
      return this.tasksRepo.create({ data: insertData });
    }
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const assignedToUserId = parseOptionalUserId(params.body.assignedToUserId);
    const localPatch: Partial<TaskInsert> = {};
    if (assignedToUserId !== undefined) {
      localPatch.assignedToUserId = assignedToUserId;
    }
    if (params.body.name !== undefined) {
      localPatch.name = params.body.name as string;
    }
    if (params.body.description !== undefined) {
      localPatch.description = (params.body.description as string) || null;
    }
    if (params.body.priority !== undefined) {
      localPatch.priority = params.body.priority as string;
    }
    if (params.body.dueDate !== undefined) {
      localPatch.dueDate = params.body.dueDate
        ? new Date(params.body.dueDate as string)
        : null;
    }
    if (params.body.status !== undefined) {
      localPatch.status = params.body.status as string;
    }

    this.logger.debug(
      `TasksService.update — id=${params.id} assignedToUserId=${assignedToUserId === undefined ? 'unchanged' : assignedToUserId ?? 'none'}`,
    );

    try {
      const connectionId = await this.resolveConnectionId(tenantId);
      const apiTask = await this.crunchworkService.updateTask({
        connectionId,
        taskId: params.id,
        body: params.body,
      });

      const apiObj = apiTask as Record<string, unknown>;
      return this.tasksRepo.update({
        id: params.id,
        data: {
          ...localPatch,
          taskPayload: apiTask as Record<string, unknown>,
          status: (apiObj.status as string) ?? localPatch.status ?? existing.status,
        },
      });
    } catch {
      if (Object.keys(localPatch).length === 0) return existing;
      return this.tasksRepo.update({
        id: params.id,
        data: localPatch,
      });
    }
  }
}
