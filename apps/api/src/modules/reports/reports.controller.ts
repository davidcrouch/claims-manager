import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('claimId') claimId?: string,
    @Query('reportTypeId') reportTypeId?: string,
  ) {
    return this.reportsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      claimId,
      reportTypeId,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.reportsService.findByJob({ jobId });
  }

  @Get('claim/:claimId')
  async findByClaim(@Param('claimId') claimId: string) {
    return this.reportsService.findByClaim({ claimId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.reportsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.reportsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.reportsService.update({ id, body });
  }
}
