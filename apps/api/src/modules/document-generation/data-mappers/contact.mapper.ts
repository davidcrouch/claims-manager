import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { contacts, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ContactMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, params.entityId), eq(contacts.tenantId, params.tenantId)));
    if (!contact) throw new NotFoundException('Contact not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      first_name: contact.firstName ?? '',
      last_name: contact.lastName ?? '',
      full_name: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
      email: contact.email ?? '',
      mobile_phone: contact.mobilePhone ?? '',
      home_phone: contact.homePhone ?? '',
      work_phone: contact.workPhone ?? '',
      notes: contact.notes ?? '',
      report_date: formatDate(new Date()),
    };
  }
}
