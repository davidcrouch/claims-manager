import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { TasksRepository, type TaskInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class TasksService {
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
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.tasksRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      claimId: params.claimId,
      status: params.status,
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

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiTask = await this.crunchworkService.createTask({
      connectionId,
      body: params.body,
    });

    const apiObj = apiTask as Record<string, unknown>;
    const insertData: TaskInsert = {
      tenantId,
      claimId: (apiObj.claimId ?? params.body?.claimId) as string,
      jobId: (apiObj.jobId ?? params.body?.jobId) as string,
      name: (apiObj.name ?? params.body?.name) as string,
      description: apiObj.description as string,
      dueDate: apiObj.dueDate ? new Date(apiObj.dueDate as string) : undefined,
      priority: (apiObj.priority ?? params.body?.priority ?? 'Low') as string,
      status: (apiObj.status ?? 'Open') as string,
      taskPayload: apiTask as Record<string, unknown>,
    };
    return this.tasksRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
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
        taskPayload: apiTask as Record<string, unknown>,
        status: (apiObj.status as string) ?? existing.status,
      },
    });
  }
}
