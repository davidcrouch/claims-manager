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
  ) {
    return this.tasksService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      claimId,
      status,
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
