import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
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
    },
  ) {
    return this.contactsService.create(body);
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.contactsService.findByJob(jobId);
  }

  @Get('search-users')
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
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.contactsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.contactsService.findOne({ id });
  }
}
