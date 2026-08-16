import { Injectable, ConflictException } from '@nestjs/common';
import {
  ContactsRepository,
  UsersRepository,
  LookupsRepository,
} from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly usersRepo: UsersRepository,
    private readonly jobContactsRepo: JobContactsRepository,
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    jobId?: string;
    typeLookupIds?: string[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
      jobId: params.jobId,
      typeLookupIds: params.typeLookupIds,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findOne({ id: params.id, tenantId });
  }

  async findRelatedJobs(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const contact = await this.contactsRepo.findOne({
      id: params.id,
      tenantId,
    });

    let fallbackRole: string | null = null;
    if (contact?.typeLookupId) {
      const lookup = await this.lookupsRepo.findOne({
        id: contact.typeLookupId,
        tenantId,
      });
      fallbackRole = lookup?.name ?? lookup?.externalReference ?? null;
    }

    const rows = await this.jobContactsRepo.findJobsByContact({
      contactId: params.id,
      tenantId,
    });

    return rows.map((row) => {
      const payload = row.sourcePayload ?? {};
      const type = payload.type;
      let role: string | null = null;
      if (typeof type === 'string') {
        role = type;
      } else if (type && typeof type === 'object') {
        const t = type as { name?: string; externalReference?: string };
        role = t.name ?? t.externalReference ?? null;
      }

      return {
        id: row.jobId,
        name: row.name,
        externalReference: row.externalReference,
        addressSuburb: row.addressSuburb,
        addressState: row.addressState,
        statusName: row.statusName,
        jobTypeName: row.jobTypeName,
        role: role ?? fallbackRole,
        updatedAt: row.updatedAt,
      };
    });
  }

  async create(params: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobilePhone?: string;
    homePhone?: string;
    workPhone?: string;
    notes?: string;
    typeLookupId?: string;
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
        typeLookupId: params.typeLookupId?.trim() || null,
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
