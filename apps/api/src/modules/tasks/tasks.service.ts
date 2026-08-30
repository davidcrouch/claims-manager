import { Injectable, Optional, BadRequestException, Logger } from '@nestjs/common';
import {
  TasksRepository,
  JobsRepository,
  ClaimsRepository,
  type TaskInsert,
  type TaskViewRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { OutboundEventsService } from '../outbound-events/outbound-events.service';
import { OutboundSyncService } from '../domain/outbound/outbound-sync.service';
import { CW_TASK_TYPES } from './cw-task-types';

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
    private readonly jobsRepo: JobsRepository,
    private readonly claimsRepo: ClaimsRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    private readonly outboundSync: OutboundSyncService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
    @Optional() private readonly outboundEvents?: OutboundEventsService,
  ) {}

  private resolveCwId(entity: {
    apiPayload?: unknown;
    externalReference?: string | null;
  } | null): string | null {
    if (!entity) return null;
    const payload = (entity.apiPayload ?? {}) as Record<string, unknown>;
    const fromPayload = typeof payload.id === 'string' ? payload.id.trim() : '';
    if (fromPayload) return fromPayload;
    const fromRef = typeof entity.externalReference === 'string' ? entity.externalReference.trim() : '';
    return fromRef || null;
  }

  private cwTaskTypeName(taskType: unknown): string | null {
    if (typeof taskType === 'string') {
      const trimmed = taskType.trim();
      return trimmed || null;
    }
    if (!taskType || typeof taskType !== 'object' || Array.isArray(taskType)) return null;
    const obj = taskType as Record<string, unknown>;
    for (const key of ['name', 'externalReference'] as const) {
      const raw = obj[key];
      if (typeof raw === 'string' && raw.trim()) return raw.trim();
    }
    return null;
  }

  private async buildOutboundBody(
    body: Record<string, unknown>,
    tenantId: string,
  ): Promise<Record<string, unknown> | null> {
    const outbound: Record<string, unknown> = {};
    if (typeof body.name === 'string' && body.name.trim()) outbound.name = body.name.trim();

    const internalJobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
    if (internalJobId) {
      const job = await this.jobsRepo.findOne({ id: internalJobId, tenantId });
      const cwJobId = this.resolveCwId(job);
      if (!cwJobId) {
        this.logger.warn(
          `TasksService.buildOutboundBody — job ${internalJobId} has no Crunchwork id`,
        );
        return null;
      }
      outbound.jobId = cwJobId;
    }

    const internalClaimId = typeof body.claimId === 'string' ? body.claimId.trim() : '';
    if (internalClaimId) {
      const claim = await this.claimsRepo.findOne({ id: internalClaimId, tenantId });
      const cwClaimId = this.resolveCwId(claim);
      if (cwClaimId) outbound.claimId = cwClaimId;
    }

    if (typeof body.description === 'string' && body.description.trim()) {
      outbound.description = body.description.trim();
    }
    if (typeof body.dueDate === 'string' && body.dueDate) outbound.dueDate = body.dueDate;
    if (typeof body.priority === 'string' && body.priority) outbound.priority = body.priority;

    const status = typeof body.status === 'string' ? body.status : '';
    if (status === 'Completed' || status === 'Failed' || status === 'Open') {
      outbound.status = status;
    } else if (status) {
      outbound.status = 'Open';
    }

    const typeName = this.cwTaskTypeName(body.taskType);
    if (typeName) {
      // CW create API requires taskType.externalReference — the `id` field is
      // read-only on CW responses and rejected as sole identifier on create.
      // Some CW task types (e.g. "Submission Required") come back with
      // externalReference: null on GET, so we always use the canonical name.
      this.logger.log(
        `TasksService.buildOutboundBody — sending taskType externalReference "${typeName}"`,
      );
      outbound.taskType = { externalReference: typeName };
    }

    if (!outbound.jobId && !outbound.claimId) {
      this.logger.warn(
        `TasksService.buildOutboundBody — no Crunchwork job or claim id`,
      );
      return null;
    }

    return outbound;
  }

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  /** Infer synced state for tasks created before sync_status was tracked. */
  private shapeTask<T extends TaskViewRow | TaskInsert>(task: T): T {
    if (task.syncStatus) return task;
    const payload = (task.taskPayload ?? {}) as Record<string, unknown>;
    const payloadId = typeof payload.id === 'string' ? payload.id.trim() : '';
    const externalRef = (task.externalReference ?? '').trim() || payloadId;
    if (!externalRef) return task;
    return {
      ...task,
      syncStatus: 'synced',
      externalReference: task.externalReference ?? externalRef,
    };
  }

  private shapeTasks(tasks: TaskViewRow[]): TaskViewRow[] {
    return tasks.map((task) => this.shapeTask(task));
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
    const result = await this.tasksRepo.findAll({
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
    return { ...result, data: this.shapeTasks(result.data) };
  }

  async findFilterOptions() {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findFilterOptions({ tenantId });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.tasksRepo.findOne({ id: params.id, tenantId });
    return row ? this.shapeTask(row) : null;
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.shapeTasks(
      await this.tasksRepo.findByJob({ jobId: params.jobId, tenantId }),
    );
  }

  async findByClaim(params: { claimId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.shapeTasks(
      await this.tasksRepo.findByClaim({ claimId: params.claimId, tenantId }),
    );
  }

  async findByEntity(params: { entityType: string; entityId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.shapeTasks(
      await this.tasksRepo.findByEntity({
        tenantId,
        entityType: params.entityType,
        entityId: params.entityId,
      }),
    );
  }

  async findOverdue() {
    const tenantId = this.tenantContext.getTenantId();
    return this.shapeTasks(await this.tasksRepo.findOverdue({ tenantId }));
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

    let hasConnection = false;
    try {
      await this.resolveConnectionId(tenantId);
      hasConnection = true;
    } catch {
      hasConnection = false;
    }

    if (hasConnection && !explicitType) {
      throw new BadRequestException('Task type is required to sync to Crunchwork');
    }

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
      syncStatus: hasConnection ? 'pending' : null,
      ...localFields,
    };
    insertData.taskType = explicitType ?? insertData.taskType;
    const created = await this.tasksRepo.create({ data: insertData });

    if (hasConnection) {
      try {
        const connectionId = await this.resolveConnectionId(tenantId);
        const outboundBody = await this.buildOutboundBody(params.body, tenantId);
        if (!outboundBody) {
          this.logger.warn(
            `TasksService.create — skipping outbound enqueue for task ${created.id}: missing Crunchwork parent id`,
          );
        } else {
          const queueId = await this.outboundSync.enqueue({
            tenantId,
            connectionId,
            entityType: 'task',
            entityId: created.id,
            action: 'create',
            payload: outboundBody,
            sourceEvent: 'api:create',
            idempotencyKey: `task:${created.id}:create`,
            tx: this.outboundSync['db'],
          });
          this.logger.log(
            `TasksService.create — enqueued outbound sync task:${created.id} queueId=${queueId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `TasksService.create — failed to enqueue outbound sync for task ${created.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
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

    return this.shapeTask(created);
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

    let hasConnection = false;
    try {
      await this.resolveConnectionId(tenantId);
      hasConnection = true;
    } catch {
      hasConnection = false;
    }

    if (Object.keys(localPatch).length === 0) return existing;

    if (hasConnection) {
      localPatch.syncStatus = 'pending';
    }

    const row = await this.tasksRepo.update({
      id: params.id,
      data: localPatch,
    });
    const updated = row ? { ...existing, ...row } : existing;

    if (hasConnection) {
      try {
        const connectionId = await this.resolveConnectionId(tenantId);
        const outboundBody = await this.buildOutboundBody(
          {
            ...params.body,
            jobId: params.body.jobId ?? existing.jobId,
            claimId: params.body.claimId ?? existing.claimId,
            taskType: params.body.taskType ?? existing.taskType,
          },
          tenantId,
        );
        if (!outboundBody) {
          this.logger.warn(
            `TasksService.update — skipping outbound enqueue for task ${params.id}: missing Crunchwork parent id`,
          );
        } else {
          const externalRef =
            typeof existing.externalReference === 'string' ? existing.externalReference.trim() : '';
          const action = externalRef ? 'update' : 'create';
          const payload: Record<string, unknown> = { ...outboundBody };
          if (externalRef) {
            payload.externalId = externalRef;
            // Existing CW tasks already have a type. Sending the display name
            // as externalReference 500s on IAG (mapping key is often null).
            delete payload.taskType;
          }
          await this.outboundSync.cancelPending({
            tenantId,
            entityType: 'task',
            entityId: params.id,
          });
          const queueId = await this.outboundSync.enqueue({
            tenantId,
            connectionId,
            entityType: 'task',
            entityId: params.id,
            action,
            payload,
            sourceEvent: 'api:update',
            idempotencyKey: `task:${params.id}:${action}:${Date.now()}`,
            tx: this.outboundSync['db'],
          });
          this.logger.log(
            `TasksService.update — enqueued outbound sync task:${params.id} action=${action} queueId=${queueId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `TasksService.update — failed to enqueue outbound sync for task ${params.id}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    this.emitStatusChange(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    );
    return this.shapeTask(updated);
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
