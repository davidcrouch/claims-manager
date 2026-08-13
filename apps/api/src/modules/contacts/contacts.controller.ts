import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @RequirePermission(P.contacts.manage)
  async create(
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      mobilePhone?: string;
      homePhone?: string;
      workPhone?: string;
      notes?: string;
      typeLookupId?: string;
    },
  ) {
    return this.contactsService.create(body);
  }

  @Get('job/:jobId')
  @RequirePermission(P.contacts.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.contactsService.findByJob(jobId);
  }

  @Get('search-users')
  @RequirePermission(P.contacts.read)
  async searchUsers(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.contactsService.searchUsers({
      search,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get()
  @RequirePermission(P.contacts.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('jobId') jobId?: string,
  ) {
    return this.contactsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      sort,
      jobId,
    });
  }

  @Get(':id/jobs')
  @RequirePermission(P.contacts.read)
  async findRelatedJobs(@Param('id') id: string) {
    return this.contactsService.findRelatedJobs({ id });
  }

  @Get(':id')
  @RequirePermission(P.contacts.read)
  async findOne(@Param('id') id: string) {
    return this.contactsService.findOne({ id });
  }
}
