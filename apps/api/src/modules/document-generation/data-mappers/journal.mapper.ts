import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { journals, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class JournalMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [journal] = await this.db
      .select()
      .from(journals)
      .where(
        and(
          eq(journals.id, params.entityId),
          eq(journals.tenantId, params.tenantId),
          isNull(journals.deletedAt),
        ),
      );
    if (!journal) throw new NotFoundException('Journal not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      journal_name: journal.name,
      description: journal.description ?? '',
      status: journal.status,
      address_suburb: journal.addressSuburb ?? '',
      address_state: journal.addressState ?? '',
      address_postcode: journal.addressPostcode ?? '',
      created_at: formatDate(journal.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
