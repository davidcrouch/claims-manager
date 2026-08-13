import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ReportsService } from './reports.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequirePermission(P.reports.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('claimId') claimId?: string,
    @Query('status') status?: string,
    @Query('reportTypeId') reportTypeId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.reportsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      claimId,
      status,
      reportTypeId,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.reports.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.reportsService.findByJob({ jobId });
  }

  @Get('claim/:claimId')
  @RequirePermission(P.reports.read)
  async findByClaim(@Param('claimId') claimId: string) {
    return this.reportsService.findByClaim({ claimId });
  }

  @Get(':id')
  @RequirePermission(P.reports.read)
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.reports.read)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reportsService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.reports.read)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.reportsService.update({ id, body, userId });
  }
}
