import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { TenantContext } from '../../tenant/tenant-context';
import {
  TaskTypeMappingsRepository,
  TasksRepository,
  type TaskTypeMappingInsert,
} from '../../database/repositories';
import { Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { tasks } from '../../database/schema';
import { seedTaskTypeMappingsForTenant } from '../../database/seeds/entries/task-type-mappings.seed';
import {
  CANONICAL_TASK_TYPES,
  resolveTaskTypeFromTitle,
  type TaskTypeMatchMode,
} from './task-type-from-title';

const MATCH_MODES: TaskTypeMatchMode[] = ['exact', 'normalized', 'prefix', 'contains'];

@Injectable()
export class TaskTypeMappingsService {
  private readonly logger = new Logger(TaskTypeMappingsService.name);

  constructor(
    private readonly mappingsRepo: TaskTypeMappingsRepository,
    private readonly tasksRepo: TasksRepository,
    private readonly tenantContext: TenantContext,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async list(params?: { includeInactive?: boolean }) {
    const tenantId = this.tenantContext.getTenantId();
    await this.ensureDefaults(tenantId);
    return this.mappingsRepo.findAll({
      tenantId,
      includeInactive: params?.includeInactive ?? true,
    });
  }

  async listCanonicalTypes() {
    const tenantId = this.tenantContext.getTenantId();
    await this.ensureDefaults(tenantId);
    const fromMappings = await this.mappingsRepo.distinctTaskTypes({ tenantId });
    const set = new Set<string>([...CANONICAL_TASK_TYPES, ...fromMappings]);
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  async create(params: {
    titlePattern: string;
    taskType: string;
    matchMode?: string;
    priority?: number;
    isActive?: boolean;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const titlePattern = params.titlePattern?.trim();
    const taskType = params.taskType?.trim();
    if (!titlePattern) {
      throw new BadRequestException('titlePattern is required');
    }
    if (!taskType) {
      throw new BadRequestException('taskType is required');
    }
    const matchMode = this.parseMatchMode(params.matchMode);

    try {
      return await this.mappingsRepo.create({
        data: {
          tenantId,
          titlePattern,
          matchMode,
          taskType,
          priority: params.priority ?? 100,
          isActive: params.isActive ?? true,
        },
      });
    } catch (err) {
      this.logger.warn(
        `TaskTypeMappingsService.create — conflict or error tenantId=${tenantId} pattern=${titlePattern}`,
      );
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Failed to create mapping',
      );
    }
  }

  async update(params: {
    id: string;
    titlePattern?: string;
    taskType?: string;
    matchMode?: string;
    priority?: number;
    isActive?: boolean;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.mappingsRepo.findOne({ id: params.id, tenantId });
    if (!existing) throw new NotFoundException('Mapping not found');

    const data: Partial<TaskTypeMappingInsert> = {};
    if (params.titlePattern !== undefined) {
      const titlePattern = params.titlePattern.trim();
      if (!titlePattern) throw new BadRequestException('titlePattern cannot be empty');
      data.titlePattern = titlePattern;
    }
    if (params.taskType !== undefined) {
      const taskType = params.taskType.trim();
      if (!taskType) throw new BadRequestException('taskType cannot be empty');
      data.taskType = taskType;
    }
    if (params.matchMode !== undefined) {
      data.matchMode = this.parseMatchMode(params.matchMode);
    }
    if (params.priority !== undefined) {
      data.priority = params.priority;
    }
    if (params.isActive !== undefined) {
      data.isActive = params.isActive;
    }

    return this.mappingsRepo.update({ id: params.id, tenantId, data });
  }

  async remove(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const ok = await this.mappingsRepo.delete({ id: params.id, tenantId });
    if (!ok) throw new NotFoundException('Mapping not found');
    return { success: true };
  }

  /**
   * Resolve task type from title using tenant mappings.
   * Returns null when no rule matches.
   */
  async resolveFromTitle(params: {
    tenantId: string;
    title: string | null | undefined;
  }): Promise<string | null> {
    await this.ensureDefaults(params.tenantId);
    const rules = await this.mappingsRepo.findAll({
      tenantId: params.tenantId,
      includeInactive: false,
    });
    return resolveTaskTypeFromTitle({ title: params.title, rules });
  }

  /**
   * Apply mappings to tasks that have no task_type set.
   */
  async backfillUntypedTasks(): Promise<{ updated: number; scanned: number }> {
    const tenantId = this.tenantContext.getTenantId();
    await this.ensureDefaults(tenantId);
    const rules = await this.mappingsRepo.findAll({
      tenantId,
      includeInactive: false,
    });

    const untyped = await this.db
      .select({ id: tasks.id, name: tasks.name })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, tenantId),
          or(isNull(tasks.taskType), sql`btrim(${tasks.taskType}) = ''`),
        ),
      );

    let updated = 0;
    for (const row of untyped) {
      const resolved = resolveTaskTypeFromTitle({ title: row.name, rules });
      if (!resolved) continue;
      await this.tasksRepo.update({
        id: row.id,
        data: { taskType: resolved },
      });
      updated += 1;
    }

    this.logger.log(
      `TaskTypeMappingsService.backfillUntypedTasks — tenantId=${tenantId} scanned=${untyped.length} updated=${updated}`,
    );
    return { updated, scanned: untyped.length };
  }

  async ensureDefaults(tenantId: string): Promise<void> {
    const count = await this.mappingsRepo.countForTenant({ tenantId });
    if (count > 0) return;

    this.logger.log(
      `TaskTypeMappingsService.ensureDefaults — seeding defaults for tenantId=${tenantId}`,
    );
    await seedTaskTypeMappingsForTenant({
      db: this.db,
      tenantId,
      logger: {
        info: (msg) => this.logger.log(msg),
        warn: (msg) => this.logger.warn(msg),
        error: (msg) => this.logger.error(msg),
      },
    });
  }

  private parseMatchMode(value: string | undefined): TaskTypeMatchMode {
    const mode = (value ?? 'normalized').toLowerCase() as TaskTypeMatchMode;
    if (!MATCH_MODES.includes(mode)) {
      throw new BadRequestException(
        `matchMode must be one of: ${MATCH_MODES.join(', ')}`,
      );
    }
    return mode;
  }
}
