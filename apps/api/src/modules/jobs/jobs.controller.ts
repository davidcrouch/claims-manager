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

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('claimId') claimId?: string,
    @Query('sort') sort?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('jobType') jobType?: string,
    @Query('assignedToUserId') assignedToUserId?: string,
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
    });
  }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobsService.findOne({ id });
  }

  @Post()
  async create(
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.create({ body, providerOverride });
  }

  @Post(':id/contacts')
  async addContacts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { contacts?: Record<string, unknown>[] },
  ) {
    return this.jobsService.addContacts({ id, contacts: body.contacts ?? [] });
  }

  @Delete(':id/contacts/:contactId')
  async removeContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.jobsService.removeContact({ id, contactId });
  }

  @Post(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Record<string, unknown>,
    @Query('provider') providerOverride?: string,
  ) {
    return this.jobsService.update({ id, body, providerOverride });
  }
}
