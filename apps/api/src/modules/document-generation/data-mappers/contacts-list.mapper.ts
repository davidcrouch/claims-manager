import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { contacts, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ContactsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.tenantId, params.tenantId)))
      .orderBy(desc(contacts.createdAt))
      .limit(500);

    const items = rows.map((c) => ({
      full_name: [c.firstName, c.lastName].filter(Boolean).join(' '),
      email: c.email ?? '',
      mobile_phone: c.mobilePhone ?? '',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Contacts Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
