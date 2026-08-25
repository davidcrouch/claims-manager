import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TasksService } from './tasks.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('filter-options')
  @RequirePermission(P.workflows.read)
  async findFilterOptions() {
    return this.tasksService.findFilterOptions();
  }

  @Get('task-types')
  @RequirePermission(P.workflows.read)
  async listTaskTypes() {
    return this.tasksService.listCanonicalTaskTypes();
  }

  @Get()
  @RequirePermission(P.workflows.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string | string[],
    @Query('claimId') claimId?: string,
    @Query('status') status?: string | string[],
    @Query('priority') priority?: string | string[],
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('assignedToUserIds') assignedToUserIds?: string,
    @Query('search') search?: string,
    @Query('names') names?: string,
    @Query('taskTypes') taskTypes?: string,
    @Query('overdue') overdue?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? (Array.isArray(jobIds) ? jobIds.join(',') : jobIds)
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : undefined;
    const statusParam = Array.isArray(status) ? status.join(',') : status;
    const priorityParam = Array.isArray(priority) ? priority.join(',') : priority;
    return this.tasksService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      claimId,
      status: statusParam,
      priority: priorityParam,
      entityType,
      entityId,
      assignedToUserId,
      assignedToUserIds,
      search,
      names,
      taskTypes,
      overdue: overdue === 'true' || overdue === '1',
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.workflows.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.tasksService.findByJob({ jobId });
  }

  @Get('claim/:claimId')
  @RequirePermission(P.workflows.read)
  async findByClaim(@Param('claimId') claimId: string) {
    return this.tasksService.findByClaim({ claimId });
  }

  @Get('entity/:entityType/:entityId')
  @RequirePermission(P.workflows.read)
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.tasksService.findByEntity({ entityType, entityId });
  }

  @Get('overdue')
  @RequirePermission(P.workflows.read)
  async findOverdue() {
    return this.tasksService.findOverdue();
  }

  @Get(':id')
  @RequirePermission(P.workflows.read)
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.workflows.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.tasksService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.workflows.manage)
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.tasksService.update({ id, body });
  }
}
