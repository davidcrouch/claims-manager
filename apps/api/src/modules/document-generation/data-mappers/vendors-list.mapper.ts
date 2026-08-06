import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { vendors, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class VendorsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.tenantId, params.tenantId)))
      .orderBy(desc(vendors.createdAt))
      .limit(500);

    const items = rows.map((v) => ({
      name: v.name,
      external_reference: v.externalReference ?? '',
      phone: v.phone ?? '',
      state: v.state ?? '',
      is_active: v.isActive ? 'Yes' : 'No',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Vendors Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
