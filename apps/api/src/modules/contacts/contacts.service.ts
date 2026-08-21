import { Injectable, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import {
  ContactsRepository,
  UsersRepository,
  LookupsRepository,
} from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { TenantContext } from '../../tenant/tenant-context';

function normalizePersonName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function splitPersonName(params: {
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
}): { firstName: string; lastName: string } {
  const first = (params.firstName ?? '').trim();
  const last = (params.lastName ?? '').trim();
  if (first || last) return { firstName: first, lastName: last };

  const full = (params.name ?? '').trim();
  if (!full) return { firstName: '', lastName: '' };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0]!, lastName: '' };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(' ') };
}

@Injectable()
export class ContactsService {
  private readonly logger = new Logger('ContactsService');

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
    jobIds?: string[];
    unlinkedOnly?: boolean;
    typeLookupIds?: string[];
    archived?: boolean;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.contactsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
      sort: params.sort,
      jobId: params.jobId,
      jobIds: params.jobIds,
      unlinkedOnly: params.unlinkedOnly,
      typeLookupIds: params.typeLookupIds,
      archived: params.archived,
    });

    const jobsByContact = await this.jobContactsRepo.findJobsForContactIds({
      tenantId,
      contactIds: result.data.map((c) => c.id),
    });

    return {
      data: result.data.map((contact) => ({
        ...contact,
        relatedJobs: (jobsByContact[contact.id] ?? []).map((j) => ({
          id: j.id,
          name: j.name,
          externalReference: j.externalReference,
          label:
            j.name?.trim() ||
            j.externalReference?.trim() ||
            j.id,
        })),
      })),
      total: result.total,
    };
  }

  async findJobsWithContacts() {
    const tenantId = this.tenantContext.getTenantId();
    const [jobs, unlinkedCount] = await Promise.all([
      this.jobContactsRepo.findJobsWithContacts({ tenantId }),
      this.jobContactsRepo.countUnlinkedContacts({ tenantId }),
    ]);
    return { jobs, hasUnlinked: unlinkedCount > 0 };
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

  /**
   * Ensure a contact exists for a person (signup / invite / current user).
   * Match on email + display name; create when no match.
   * If email matches but name differs, reuse the email contact (no duplicate).
   */
  async ensureFromPerson(params: {
    tenantId: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    name?: string | null;
  }) {
    const email = params.email.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException(
        'ContactsService.ensureFromPerson — email is required',
      );
    }

    const { firstName, lastName } = splitPersonName({
      firstName: params.firstName,
      lastName: params.lastName,
      name: params.name,
    });
    const targetName = normalizePersonName(
      [firstName, lastName].filter(Boolean).join(' '),
    );

    const byEmail = await this.contactsRepo.findByEmail({
      tenantId: params.tenantId,
      email,
    });
    if (byEmail) {
      const existingName = normalizePersonName(
        [byEmail.firstName, byEmail.lastName].filter(Boolean).join(' '),
      );
      if (targetName && existingName && existingName !== targetName) {
        this.logger.debug(
          `ContactsService.ensureFromPerson — email match with different name; reusing contact id=${byEmail.id}`,
        );
      }
      return byEmail;
    }

    this.logger.log(
      `ContactsService.ensureFromPerson — creating contact email=${email} tenantId=${params.tenantId}`,
    );
    return this.contactsRepo.create({
      data: {
        tenantId: params.tenantId,
        firstName: firstName || null,
        lastName: lastName || null,
        email,
        notes: 'Created automatically for organisation user',
        contactPayload: { source: 'user_provision' },
      },
    });
  }

  /** Ensure a contact for the authenticated org user (JWT sub → users row). */
  async ensureForCurrentUser(params: {
    tenantId: string;
    userId: string;
    email?: string;
  }) {
    const resolved = await this.resolveCurrentUserIdentity(params);
    if (!resolved.email) {
      throw new BadRequestException(
        'ContactsService.ensureForCurrentUser — user has no email',
      );
    }

    return this.ensureFromPerson({
      tenantId: params.tenantId,
      email: resolved.email,
      name: resolved.name,
    });
  }

  /** Find contact for the signed-in user; does not create. */
  async findForCurrentUser(params: {
    tenantId: string;
    userId: string;
    email?: string;
  }) {
    const resolved = await this.resolveCurrentUserIdentity(params);
    if (!resolved.email) return null;
    return this.contactsRepo.findByEmail({
      tenantId: params.tenantId,
      email: resolved.email,
    });
  }

  private async resolveCurrentUserIdentity(params: {
    tenantId: string;
    userId: string;
    email?: string;
  }): Promise<{ email: string; name: string | null }> {
    const user = await this.usersRepo.findById({ id: params.userId });
    let email = params.email?.trim().toLowerCase() || '';
    let name: string | null = null;

    if (user) {
      email = (user.email ?? email).trim().toLowerCase();
      name = user.name ?? null;
    }

    return { email, name };
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
