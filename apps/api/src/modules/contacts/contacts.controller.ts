import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { P } from '../../auth/permission-constants';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

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
      typeLookupIds?: string[];
    },
  ) {
    return this.contactsService.create(body);
  }

  /**
   * Ensure the signed-in user has a matching contact (name + email).
   * Used when opening appointment forms so Assigned To can default to them.
   */
  @Post('ensure-me')
  @RequirePermission(P.contacts.read)
  async ensureMe(@CurrentUser() user: AuthenticatedUser) {
    const contact = await this.contactsService.ensureForCurrentUser({
      tenantId: user.tenantId,
      userId: user.sub,
      email: user.email,
    });
    return {
      id: contact.id,
      type: 'CONTACT' as const,
      name:
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
        contact.email ||
        'Unknown',
      email: contact.email ?? undefined,
    };
  }

  /** Look up the signed-in user's contact without creating one. */
  @Get('me')
  @RequirePermission(P.contacts.read)
  async findMe(@CurrentUser() user: AuthenticatedUser) {
    const contact = await this.contactsService.findForCurrentUser({
      tenantId: user.tenantId,
      userId: user.sub,
      email: user.email,
    });
    if (!contact) return null;
    return {
      id: contact.id,
      type: 'CONTACT' as const,
      name:
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
        contact.email ||
        'Unknown',
      email: contact.email ?? undefined,
    };
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

  @Get('filter-jobs')
  @RequirePermission(P.contacts.read)
  async findFilterJobs() {
    return this.contactsService.findJobsWithContacts();
  }

  @Get()
  @RequirePermission(P.contacts.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
    @Query('unlinkedOnly') unlinkedOnly?: string,
    @Query('typeLookupIds') typeLookupIds?: string,
    @Query('status') status?: string,
  ) {
    const ids = typeLookupIds
      ? typeLookupIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : undefined;
    const jobIdList = jobIds
      ? jobIds
          .split(',')
          .map((id) => id.trim())
          .filter((id) => id.length > 0)
      : undefined;
    return this.contactsService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      sort,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      unlinkedOnly: unlinkedOnly === '1' || unlinkedOnly === 'true',
      typeLookupIds: ids && ids.length > 0 ? ids : undefined,
      status: status || undefined,
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

  @Post(':id')
  @RequirePermission(P.contacts.manage)
  async update(
    @Param('id') id: string,
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
      typeLookupIds?: string[];
    },
  ) {
    return this.contactsService.update({ id, ...body });
  }
}
