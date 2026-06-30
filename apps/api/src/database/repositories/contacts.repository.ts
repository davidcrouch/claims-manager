import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { eq, and, or, ilike, asc, desc, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB, DrizzleDbOrTx } from '../drizzle.module';
import { contacts } from '../schema';

export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;

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
  }): Promise<{ data: ContactRow[]; total: number }> {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const searchPattern = params.search ? `%${params.search}%` : null;
    const whereClause = searchPattern
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
  }): Promise<ContactRow | null> {
    const [row] = await this.db
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

  /**
   * Idempotent upsert keyed on `(tenant_id, external_reference)` — matches the
   * `UQ_contacts_tenant_extref` unique index. Callers must pass a non-empty
   * `externalReference`; contacts without an external reference are not
   * projected by the webhook pipeline (see docs/mapping/claims.md §7.1).
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
