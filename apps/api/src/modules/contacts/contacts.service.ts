import { Injectable, ConflictException, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import {
  ContactsRepository,
  UsersRepository,
  LookupsRepository,
} from '../../database/repositories';
import { JobContactsRepository } from '../../database/repositories/job-contacts.repository';
import { TenantContext } from '../../tenant/tenant-context';
import {
  buildContactTypeFields,
  readContactTypeLookupIds,
  resolveContactTypeLookupIds,
} from '../../common/contact-types';
import type { ContactRow } from '../../database/repositories/contacts.repository';

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
    status?: string;
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
      status: params.status,
    });

    const jobsByContact = await this.jobContactsRepo.findJobsForContactIds({
      tenantId,
      contactIds: result.data.map((c) => c.id),
    });

    const enriched = await this.enrichContacts(result.data);

    return {
      data: enriched.map((contact) => ({
        ...contact,
        relatedJobs: (jobsByContact[contact.id] ?? []).map((j) => ({
          id: j.id,
          name: j.name,
          externalReference: j.externalReference,
          externalJobId: j.externalJobId,
          label:
            j.name?.trim() ||
            j.externalJobId?.trim() ||
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
    const contact = await this.contactsRepo.findOne({ id: params.id, tenantId });
    if (!contact) return null;
    const [enriched] = await this.enrichContacts([contact]);
    return enriched ?? null;
  }

  async findRelatedJobs(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const contact = await this.contactsRepo.findOne({
      id: params.id,
      tenantId,
    });

    let fallbackRole: string | null = null;
    const typeIds = contact ? readContactTypeLookupIds(contact) : [];
    if (typeIds.length > 0) {
      const lookupMap = await this.lookupsRepo.findByIds({
        ids: typeIds,
        tenantId,
      });
      const labels = typeIds
        .map((id) => {
          const lookup = lookupMap.get(id);
          return lookup?.name ?? lookup?.externalReference ?? null;
        })
        .filter((value): value is string => Boolean(value));
      fallbackRole = labels.length > 0 ? labels.join(', ') : null;
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
      if (!role && typeof payload.typeName === 'string') {
        role = payload.typeName;
      }

      return {
        id: row.jobId,
        name: row.name,
        externalReference: row.externalReference,
        externalJobId: row.externalJobId,
        addressSuburb: row.addressSuburb,
        addressState: row.addressState,
        statusName: row.statusName,
        jobTypeName: row.jobTypeName,
        role: role ?? fallbackRole,
        updatedAt: row.updatedAt,
        label:
          row.name?.trim() ||
          row.externalJobId?.trim() ||
          row.externalReference?.trim() ||
          row.jobId,
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
    typeLookupIds?: string[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const typeLookupIds = resolveContactTypeLookupIds(params);
    if (typeLookupIds.length === 0) {
      throw new BadRequestException(
        'ContactsService.create — at least one contact type is required',
      );
    }

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

    const typeFields = buildContactTypeFields({ typeLookupIds });

    const created = await this.contactsRepo.create({
      data: {
        tenantId,
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        email: params.email ?? null,
        mobilePhone: params.mobilePhone ?? null,
        homePhone: params.homePhone ?? null,
        workPhone: params.workPhone ?? null,
        notes: params.notes ?? null,
        typeLookupId: typeFields.typeLookupId,
        contactPayload: typeFields.contactPayload,
      },
    });
    const [enriched] = await this.enrichContacts([created]);
    return enriched ?? created;
  }

  async update(params: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobilePhone?: string;
    homePhone?: string;
    workPhone?: string;
    notes?: string;
    typeLookupId?: string;
    typeLookupIds?: string[];
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.contactsRepo.findOne({
      id: params.id,
      tenantId,
    });
    if (!existing) {
      throw new NotFoundException(`Contact ${params.id} not found`);
    }

    const typeLookupIds = resolveContactTypeLookupIds(params);
    if (typeLookupIds.length === 0) {
      throw new BadRequestException(
        'ContactsService.update — at least one contact type is required',
      );
    }

    if (params.email) {
      const duplicate = await this.contactsRepo.findByEmail({
        tenantId,
        email: params.email,
      });
      if (duplicate && duplicate.id !== params.id) {
        throw new ConflictException(
          `A contact with email "${params.email}" already exists`,
        );
      }
    }

    const typeFields = buildContactTypeFields({
      existingPayload: existing.contactPayload,
      typeLookupIds,
    });

    const updated = await this.contactsRepo.update({
      id: params.id,
      tenantId,
      data: {
        firstName: params.firstName ?? null,
        lastName: params.lastName ?? null,
        email: params.email ?? null,
        mobilePhone: params.mobilePhone ?? null,
        homePhone: params.homePhone ?? null,
        workPhone: params.workPhone ?? null,
        notes: params.notes ?? null,
        typeLookupId: typeFields.typeLookupId,
        contactPayload: typeFields.contactPayload,
      },
    });
    const [enriched] = await this.enrichContacts([updated]);
    return enriched ?? updated;
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

  private async enrichContacts(contacts: ContactRow[]) {
    if (contacts.length === 0) return [];

    const tenantId = this.tenantContext.getTenantId();
    const allTypeIds = [
      ...new Set(contacts.flatMap((contact) => readContactTypeLookupIds(contact))),
    ];
    const lookupMap =
      allTypeIds.length > 0
        ? await this.lookupsRepo.findByIds({ ids: allTypeIds, tenantId })
        : new Map<string, { id: string; name?: string | null; externalReference?: string | null }>();

    return contacts.map((contact) => {
      const typeLookupIds = readContactTypeLookupIds(contact);
      const contactTypes = typeLookupIds.map((id) => {
        const lookup = lookupMap.get(id);
        return {
          id,
          name: lookup?.name ?? undefined,
          externalReference: lookup?.externalReference ?? undefined,
        };
      });
      return {
        ...contact,
        typeLookupIds,
        contactTypes,
        typeLookupId: typeLookupIds[0] ?? contact.typeLookupId ?? null,
      };
    });
  }
}
