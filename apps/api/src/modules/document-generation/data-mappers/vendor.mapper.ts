import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { vendors, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class VendorMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [vendor] = await this.db
      .select()
      .from(vendors)
      .where(and(eq(vendors.id, params.entityId), eq(vendors.tenantId, params.tenantId)));
    if (!vendor) throw new NotFoundException('Vendor not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      vendor_name: vendor.name,
      external_reference: vendor.externalReference ?? '',
      phone: vendor.phone ?? '',
      after_hours_phone: vendor.afterHoursPhone ?? '',
      postcode: vendor.postcode ?? '',
      state: vendor.state ?? '',
      city: vendor.city ?? '',
      country: vendor.country ?? '',
      is_active: vendor.isActive ? 'Yes' : 'No',
      report_date: formatDate(new Date()),
    };
  }
}
