import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('filter-locations')
  @RequirePermission(P.workflows.read)
  async findFilterLocations() {
    return this.appointmentsService.findFilterLocations();
  }

  @Get('filter-types')
  @RequirePermission(P.workflows.read)
  async findFilterTypes() {
    return this.appointmentsService.findFilterTypes();
  }

  @Get()
  @RequirePermission(P.workflows.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('location') location?: string,
    @Query('appointmentTypeLookupIds') appointmentTypeLookupIds?: string,
    @Query('sort') sort?: string,
    @Query('order') order?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.appointmentsService.findAll({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      search: search || undefined,
      status: status || undefined,
      location: location || undefined,
      appointmentTypeLookupIds: appointmentTypeLookupIds || undefined,
      sort: sort || undefined,
      order: order === 'desc' ? 'desc' : 'asc',
      jobId: jobId || undefined,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.workflows.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.appointmentsService.findByJob({ jobId });
  }

  @Get(':id')
  @RequirePermission(P.workflows.read)
  async findOne(@Param('id') id: string) {
    return this.appointmentsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.workflows.manage)
  async create(@Body() body: Record<string, unknown>) {
    return this.appointmentsService.create({ body });
  }

  @Post(':id')
  @RequirePermission(P.workflows.manage)
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.appointmentsService.update({ id, body });
  }

  @Post(':id/cancel')
  @RequirePermission(P.workflows.manage)
  async cancel(@Param('id') id: string, @Body() body: { reason: string }) {
    return this.appointmentsService.cancel({ id, body });
  }
}
