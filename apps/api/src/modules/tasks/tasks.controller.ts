import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('claimId') claimId?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
  ) {
    return this.tasksService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      claimId,
      status,
      priority,
      entityType,
      entityId,
      assignedToUserId,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.tasksService.findByJob({ jobId });
  }

  @Get('claim/:claimId')
  async findByClaim(@Param('claimId') claimId: string) {
    return this.tasksService.findByClaim({ claimId });
  }

  @Get('entity/:entityType/:entityId')
  async findByEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.tasksService.findByEntity({ entityType, entityId });
  }

  @Get('overdue')
  async findOverdue() {
    return this.tasksService.findOverdue();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tasksService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.tasksService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.tasksService.update({ id, body });
  }
}
