import { Injectable, Optional, BadRequestException, Logger } from '@nestjs/common';
import { TasksRepository, type TaskInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { CW_TASK_TYPES, extractCwTaskTypeName } from './cw-task-types';

function parseOptionalUserId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__unassigned__') return null;
  return trimmed;
}

function parseOptionalText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || null;
}

function parseOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed;
}

function parseOptionalNumeric(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return String(n);
}

function parseTags(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function completedAtForStatus(
  status: string | undefined,
  previousCompletedAt?: Date | string | null,
): Date | null | undefined {
  if (!status) return undefined;
  if (status === 'Completed') {
    if (previousCompletedAt) return undefined;
    return new Date();
  }
  if (status === 'Open' || status === 'In Progress' || status === 'On Hold') {
    return null;
  }
  return undefined;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly tasksRepo: TasksRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  listCanonicalTaskTypes(): string[] {
    return [...CW_TASK_TYPES];
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    claimId?: string;
    status?: string | string[];
    priority?: string | string[];
    entityType?: string;
    entityId?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    search?: string;
    names?: string;
    taskTypes?: string;
    overdue?: boolean;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      claimId: params.claimId,
      status: params.status,
      priority: params.priority,
      entityType: params.entityType,
      entityId: params.entityId,
      assignedToUserId: params.assignedToUserId,
      assignedToUserIds: params.assignedToUserIds,
      search: params.search,
      names: params.names,
      taskTypes: params.taskTypes,
      overdue: params.overdue,
      sort: params.sort,
    });
  }

  async findFilterOptions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findFilterOptions({ tenantId });
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

  async create(params: { body: Record<string, unknown>; userId?: string }) {
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
    const status = (parseOptionalText(params.body.status) ?? 'Open') as string;
    const explicitType = parseOptionalText(params.body.taskType) ?? undefined;

    this.logger.debug(
      `TasksService.create — tenantId=${tenantId} assignedToUserId=${assignedToUserId ?? 'none'}`,
    );

    const localFields: Partial<TaskInsert> = {
      taskType: explicitType ?? undefined,
      startDate: parseOptionalDate(params.body.startDate) ?? undefined,
      reminderAt: parseOptionalDate(params.body.reminderAt) ?? undefined,
      estimatedHours: parseOptionalNumeric(params.body.estimatedHours) ?? undefined,
      notes: parseOptionalText(params.body.notes) ?? undefined,
      tags: parseTags(params.body.tags) ?? [],
      completedAt: completedAtForStatus(status) ?? undefined,
    };

    let created: Awaited<ReturnType<typeof this.tasksRepo.create>>;
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
        description: (apiObj.description ?? params.body.description) as string,
        dueDate: apiObj.dueDate
          ? new Date(apiObj.dueDate as string)
          : parseOptionalDate(params.body.dueDate) ?? undefined,
        priority: (apiObj.priority ?? params.body?.priority ?? 'Low') as string,
        status: (apiObj.status ?? status) as string,
        assignedToUserId,
        createdByUserId: params.userId ?? null,
        taskPayload: apiTask as Record<string, unknown>,
        ...localFields,
      };
      insertData.taskType =
        explicitType ?? extractCwTaskTypeName(apiObj) ?? insertData.taskType;
      created = await this.tasksRepo.create({ data: insertData });
    } catch {
      const insertData: TaskInsert = {
        tenantId,
        relatedEntityType,
        relatedEntityId,
        claimId: claimId as string,
        jobId: jobId as string,
        name: params.body.name as string,
        description: params.body.description as string,
        dueDate: parseOptionalDate(params.body.dueDate) ?? undefined,
        priority: (params.body.priority as string) ?? 'Low',
        status,
        assignedToUserId,
        createdByUserId: params.userId ?? null,
        taskPayload: {},
        ...localFields,
      };
      created = await this.tasksRepo.create({ data: insertData });
    }

    if (this.outboundEvents && created && jobId) {
      this.outboundEvents.emitTaskCreated({
        taskId: (created as Record<string, unknown>).id as string,
        taskName: (created as Record<string, unknown>).name as string,
        jobId,
        tenantId,
        originType: (params.body.originType as string) ?? 'user',
      }).catch(() => {});
    }

    return created;
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
      localPatch.description = parseOptionalText(params.body.description) ?? null;
    }
    if (params.body.priority !== undefined) {
      localPatch.priority = params.body.priority as string;
    }
    if (params.body.dueDate !== undefined) {
      localPatch.dueDate = parseOptionalDate(params.body.dueDate) ?? null;
    }
    if (params.body.startDate !== undefined) {
      localPatch.startDate = parseOptionalDate(params.body.startDate) ?? null;
    }
    if (params.body.reminderAt !== undefined) {
      localPatch.reminderAt = parseOptionalDate(params.body.reminderAt) ?? null;
    }
    if (params.body.estimatedHours !== undefined) {
      localPatch.estimatedHours = parseOptionalNumeric(params.body.estimatedHours) ?? null;
    }
    if (params.body.notes !== undefined) {
      localPatch.notes = parseOptionalText(params.body.notes) ?? null;
    }
    if (params.body.tags !== undefined) {
      localPatch.tags = parseTags(params.body.tags) ?? [];
    }
    if (params.body.taskType !== undefined) {
      localPatch.taskType = parseOptionalText(params.body.taskType) ?? null;
    }
    if (params.body.status !== undefined) {
      localPatch.status = params.body.status as string;
      const completedAt = completedAtForStatus(
        localPatch.status,
        existing.completedAt as Date | string | null,
      );
      if (completedAt !== undefined) {
        localPatch.completedAt = completedAt;
      }
    }
    if (params.body.jobId !== undefined) {
      const nextJobId = parseOptionalText(params.body.jobId);
      localPatch.jobId = nextJobId;
      if (nextJobId) {
        localPatch.relatedEntityType = 'Job';
        localPatch.relatedEntityId = nextJobId;
      }
    }
    if (params.body.claimId !== undefined) {
      localPatch.claimId = parseOptionalText(params.body.claimId);
    }

    this.logger.debug(
      `TasksService.update — id=${params.id} assignedToUserId=${assignedToUserId === undefined ? 'unchanged' : assignedToUserId ?? 'none'}`,
    );

    let updated = existing;
    try {
      const connectionId = await this.resolveConnectionId(tenantId);
      const apiTask = await this.crunchworkService.updateTask({
        connectionId,
        taskId: params.id,
        body: params.body,
      });

      const apiObj = apiTask as Record<string, unknown>;
      const cwType = extractCwTaskTypeName(apiObj);
      const row = await this.tasksRepo.update({
        id: params.id,
        data: {
          ...localPatch,
          taskPayload: apiTask as Record<string, unknown>,
          status: (apiObj.status as string) ?? localPatch.status ?? existing.status,
          ...(localPatch.taskType === undefined && cwType ? { taskType: cwType } : {}),
        },
      });
      if (row) updated = { ...existing, ...row };
    } catch {
      if (Object.keys(localPatch).length === 0) return existing;
      const row = await this.tasksRepo.update({
        id: params.id,
        data: localPatch,
      });
      if (row) updated = { ...existing, ...row };
    }

    this.emitStatusChange(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    return updated;
  }

  private emitStatusChange(
    previous: Record<string, unknown>,
    current: Record<string, unknown> | null,
  ): void {
    if (!this.outboundEvents || !current) return;
    const prevStatus = previous.status as string;
    const newStatus = current.status as string;
    if (prevStatus === newStatus) return;

    const tenantId = this.tenantContext.getTenantId();
    const jobId = (current.jobId ?? '') as string;

    if (newStatus === 'Completed' || newStatus === 'Complete') {
      this.outboundEvents.emitTaskCompleted({
        taskId: current.id as string,
        taskName: current.name as string,
        jobId,
        entityType: 'job',
        entityId: jobId,
        tenantId,
      }).catch(() => {});
    } else if (newStatus === 'Failed' || newStatus === 'Cancelled') {
      this.outboundEvents.emitTaskFailed({
        taskId: current.id as string,
        taskName: current.name as string,
        jobId,
        tenantId,
      }).catch(() => {});
    }
  }
}
