import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
  ) {
    return this.appointmentsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search: search || undefined,
      status: status || undefined,
      sort: sort || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.appointmentsService.findByJob({ jobId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.appointmentsService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appointmentsService.update({ id, body });
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.appointmentsService.cancel({ id, body });
  }
}
