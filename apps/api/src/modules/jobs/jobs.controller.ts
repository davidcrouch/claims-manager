import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { JobsService } from './jobs.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get('filter-options')
  @RequirePermission(P.jobs.read)
  async findFilterOptions() {
    return this.jobsService.findFilterOptions();
  }

  @Get()
  @RequirePermission(P.jobs.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('claimId') claimId?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
    @Query('assignedToUserIds') assignedToUserIds?: string,
    @Query('refs') refs?: string,
  ) {
    return this.jobsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      claimId,
      sort,
      search,
      status,
      jobType,
      assignedToUserId,
      assignedToUserIds,
      refs,
    });
  }

  @Get(':id')
  @RequirePermission(P.jobs.read)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.jobs.create)
  async create(
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.create({ body, providerOverride });
  }

  @Post(':id/contacts')
  @RequirePermission(P.jobs.update)
  async addContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { contacts?: Record<string, unknown>[] },
  ) {
    return this.jobsService.addContacts({ id, contacts: body.contacts ?? [] });
  }

  @Delete(':id/contacts/:contactId')
  @RequirePermission(P.jobs.update)
  async removeContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.jobsService.removeContact({ id, contactId });
  }

  @Post(':id/calculate-dates')
  @RequirePermission(P.jobs.read)
  async calculateDates(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { contactDate?: string; attendanceDate?: string },
  ) {
    return this.jobsService.calculateWorkflowDates({ id, ...body });
  }

  @Post(':id')
  @RequirePermission(P.jobs.update)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.update({ id, body, providerOverride });
  }
}
