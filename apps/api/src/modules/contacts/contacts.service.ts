import { Injectable, ConflictException } from '@nestjs/common';
import { ContactsRepository, UsersRepository } from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly jobContactsRepo: JobContactsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findOne({ id: params.id, tenantId });
  }

  async create(params: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobilePhone?: string;
    homePhone?: string;
    workPhone?: string;
    notes?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();

    if (params.email) {
      const existing = await this.contactsRepo.findByEmail({
        tenantId,
        email: params.email,
      });
      if (existing) {
        throw new ConflictException(
          `A contact with email "${params.email}" already exists`,
        );
      }
    }

    return this.contactsRepo.create({
      data: {
        tenantId,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        email: params.email ?? null,
        mobilePhone: params.mobilePhone ?? null,
        homePhone: params.homePhone ?? null,
        workPhone: params.workPhone ?? null,
        notes: params.notes ?? null,
      },
    });
  }

  async findByJob(jobId: string) {
    const links = await this.jobContactsRepo.findByJob({ jobId });
    const results = await Promise.all(
      links.map(async (link) => {
        const tenantId = this.tenantContext.getTenantId();
        const contact = await this.contactsRepo.findOne({ id: link.contactId, tenantId });
        if (!contact) return null;
        return {
          id: contact.id,
          type: 'CONTACT' as const,
          name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email || 'Unknown',
          email: contact.email ?? undefined,
        };
      }),
    );
    return results.filter(Boolean);
  }

  async searchUsers(params: {
    search?: string;
    limit?: number;
  }): Promise<{ id: string; type: 'USER'; name: string; email?: string }[]> {
    const tenantId = this.tenantContext.getTenantId();
    const users = await this.usersRepo.searchByOrganization({
      organizationId: tenantId,
      search: params.search,
      limit: params.limit,
    });
    return users.map((u) => ({
      id: u.id,
      type: 'USER' as const,
      name: u.name ?? u.email ?? 'Unknown',
      email: u.email ?? undefined,
    }));
  }
}
