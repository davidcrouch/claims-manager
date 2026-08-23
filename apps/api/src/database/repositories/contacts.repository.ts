import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, desc, sql, inArray, notExists } from 'drizzle-orm';
import { buildContactFillBlanksUpdate, normalizePhoneDigits } from '../../common/contact-identity';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { contacts, jobContacts } from '../schema';

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;

export { normalizePhoneDigits } from '../../common/contact-identity';

function buildContactsOrderBy(sort?: string) {
  switch (sort) {
    case 'name_desc':
      return [desc(contacts.lastName), desc(contacts.firstName)];
    case 'email_asc':
      return [asc(contacts.email)];
    case 'email_desc':
      return [desc(contacts.email)];
    case 'phone_asc':
      return [asc(contacts.mobilePhone)];
    case 'phone_desc':
      return [desc(contacts.mobilePhone)];
    case 'created_at_asc':
      return [asc(contacts.createdAt)];
    case 'created_at_desc':
      return [desc(contacts.createdAt)];
    case 'name_asc':
    default:
      return [asc(contacts.lastName), asc(contacts.firstName)];
  }
}

@Injectable()
export class ContactsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findAll(params: {
    tenantId: string;
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    jobId?: string;
    /** OR filter: contact linked to any of these jobs */
    jobIds?: string[];
    /** Contacts with no job_contacts rows */
    unlinkedOnly?: boolean;
    typeLookupIds?: string[];
    /** Comma-separated status values to match against contact_payload->>'status' */
    status?: string;
  }): Promise<{ data: ContactRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const searchPattern = params.search ? `%${params.search}%` : null;
    let whereClause = searchPattern
      ? and(
          eq(contacts.tenantId, params.tenantId),
          or(
            ilike(contacts.firstName, searchPattern),
            ilike(contacts.lastName, searchPattern),
            ilike(contacts.email, searchPattern),
            ilike(contacts.mobilePhone, searchPattern),
          ),
        )
      : eq(contacts.tenantId, params.tenantId);

    if (params.typeLookupIds && params.typeLookupIds.length > 0) {
      const filterIds = params.typeLookupIds;
      whereClause = and(
        whereClause,
        or(
          inArray(contacts.typeLookupId, filterIds),
          sql`EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(
              CASE jsonb_typeof(${contacts.contactPayload}->'typeLookupIds')
                WHEN 'array' THEN ${contacts.contactPayload}->'typeLookupIds'
                ELSE '[]'::jsonb
              END
            ) AS elem(value)
            WHERE elem.value IN (${sql.join(
              filterIds.map((id) => sql`${id}`),
              sql`, `,
            )})
          )`,
        ),
      );
    }

    if (params.status) {
      const statusValues = params.status
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (statusValues.length > 0) {
        whereClause = and(
          whereClause,
          sql`lower(coalesce(${contacts.contactPayload}->>'status', 'active')) IN (${sql.join(
            statusValues.map((s) => sql`${s}`),
            sql`, `,
          )})`,
        );
      }
    }

    const jobIds =
      params.jobIds && params.jobIds.length > 0
        ? params.jobIds
        : params.jobId
          ? [params.jobId]
          : [];

    if (jobIds.includes('__none__')) {
      return { data: [], total: 0 };
    }

    if (params.unlinkedOnly) {
      whereClause = and(
        whereClause,
        notExists(
          this.db
            .select({ one: sql`1` })
            .from(jobContacts)
            .where(
              and(
                eq(jobContacts.contactId, contacts.id),
                eq(jobContacts.tenantId, params.tenantId),
              ),
            ),
        ),
      );
    } else if (jobIds.length > 0) {
      const linked = await this.db
        .select({ contactId: jobContacts.contactId })
        .from(jobContacts)
        .where(
          and(
            eq(jobContacts.tenantId, params.tenantId),
            jobIds.length === 1
              ? eq(jobContacts.jobId, jobIds[0])
              : inArray(jobContacts.jobId, jobIds),
          ),
        );
      const contactIds = [...new Set(linked.map((row) => row.contactId))];
      if (contactIds.length === 0) {
        return { data: [], total: 0 };
      }
      whereClause = and(whereClause, inArray(contacts.id, contactIds));
    }

    const orderBy = buildContactsOrderBy(params.sort);

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(contacts)
        .where(whereClause)
        .orderBy(...orderBy)
        .limit(limit)
        .offset(skip),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(contacts)
        .where(whereClause),
    ]);

    const total = countResult[0]?.count ?? 0;
    return { data, total };
  }

  async findOne(params: {
    id: string;
    tenantId: string;
  }): Promise<ContactRow | null> {
    const [row] = await this.db
      .select()
      .from(contacts)
      .where(
        and(eq(contacts.id, params.id), eq(contacts.tenantId, params.tenantId)),
      )
      .limit(1);
    return row ?? null;
  }

  async findByExternalReference(params: {
    tenantId: string;
    externalReference: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, params.tenantId),
          eq(contacts.externalReference, params.externalReference),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByEmail(params: {
    tenantId: string;
    email: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, params.tenantId),
          ilike(contacts.email, params.email),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Match any of mobile/home/work where digits-only form equals the inbound phone.
   */
  async findByPhone(params: {
    tenantId: string;
    phone: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow | null> {
    const digits = normalizePhoneDigits(params.phone);
    if (!digits) return null;
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, params.tenantId),
          or(
            sql`regexp_replace(coalesce(${contacts.mobilePhone}, ''), '[^0-9]', '', 'g') = ${digits}`,
            sql`regexp_replace(coalesce(${contacts.homePhone}, ''), '[^0-9]', '', 'g') = ${digits}`,
            sql`regexp_replace(coalesce(${contacts.workPhone}, ''), '[^0-9]', '', 'g') = ${digits}`,
          ),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async findByName(params: {
    tenantId: string;
    firstName: string;
    lastName: string;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow | null> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.tenantId, params.tenantId),
          ilike(contacts.firstName, params.firstName.trim()),
          ilike(contacts.lastName, params.lastName.trim()),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /**
   * Cascaded identity match (first hit wins):
   * externalReference → email → any phone → first+last name.
   */
  async findMatchingContact(params: {
    tenantId: string;
    externalReference?: string | null;
    email?: string | null;
    mobilePhone?: string | null;
    homePhone?: string | null;
    workPhone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow | null> {
    const tx = params.tx;

    if (params.externalReference?.trim()) {
      const byExt = await this.findByExternalReference({
        tenantId: params.tenantId,
        externalReference: params.externalReference.trim(),
        tx,
      });
      if (byExt) return byExt;
    }

    if (params.email?.trim()) {
      const byEmail = await this.findByEmail({
        tenantId: params.tenantId,
        email: params.email.trim(),
        tx,
      });
      if (byEmail) return byEmail;
    }

    for (const phone of [params.mobilePhone, params.homePhone, params.workPhone]) {
      if (!phone?.trim()) continue;
      const byPhone = await this.findByPhone({
        tenantId: params.tenantId,
        phone,
        tx,
      });
      if (byPhone) return byPhone;
    }

    if (params.firstName?.trim() && params.lastName?.trim()) {
      const byName = await this.findByName({
        tenantId: params.tenantId,
        firstName: params.firstName,
        lastName: params.lastName,
        tx,
      });
      if (byName) return byName;
    }

    return null;
  }

  async create(params: {
    data: ContactInsert;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .insert(contacts)
      .values(params.data)
      .returning();
    return row;
  }

  async update(params: {
    id: string;
    tenantId: string;
    data: Partial<ContactInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow> {
    const db = params.tx ?? this.db;
    const [row] = await db
      .update(contacts)
      .set({ ...params.data, updatedAt: new Date() })
      .where(
        and(eq(contacts.id, params.id), eq(contacts.tenantId, params.tenantId)),
      )
      .returning();
    return row;
  }

  /**
   * Fill empty scalar fields from inbound; always set externalReference and
   * contactPayload when inbound provides them. Returns the existing row unchanged
   * when there is nothing to apply.
   */
  async mergeFillBlanks(params: {
    existing: ContactRow;
    data: Partial<ContactInsert>;
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow> {
    const patch = buildContactFillBlanksUpdate({
      existing: params.existing as unknown as Record<string, unknown>,
      inbound: params.data as unknown as Record<string, unknown>,
    }) as Partial<ContactInsert>;

    if (Object.keys(patch).length === 0) {
      return params.existing;
    }

    return this.update({
      id: params.existing.id,
      tenantId: params.existing.tenantId,
      data: patch,
      tx: params.tx,
    });
  }

  /**
   * Idempotent upsert keyed on `(tenant_id, external_reference)` — matches the
   * `UQ_contacts_tenant_extref` unique index. Prefer `findMatchingContact` +
   * create/mergeFillBlanks for claim/job projection sync.
   */
  async upsertByExternalReference(params: {
    data: ContactInsert & { externalReference: string };
    tx?: DrizzleDbOrTx;
  }): Promise<ContactRow> {
    const db = params.tx ?? this.db;
    const updateSet: Partial<ContactInsert> = { ...params.data };
    delete updateSet.externalReference;
    delete updateSet.tenantId;
    const [row] = await db
      .insert(contacts)
      .values(params.data)
      .onConflictDoUpdate({
        target: [contacts.tenantId, contacts.externalReference],
        set: { ...updateSet, updatedAt: new Date() },
      })
      .returning();
    return row;
  }
}
