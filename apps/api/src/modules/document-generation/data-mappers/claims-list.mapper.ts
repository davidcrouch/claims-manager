import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { claims, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ClaimsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(claims)
      .where(and(eq(claims.tenantId, params.tenantId)))
      .orderBy(desc(claims.createdAt))
      .limit(500);

    const items = rows.map((c) => ({
      claim_number: c.claimNumber ?? '',
      external_reference: c.externalReference ?? '',
      lodgement_date: formatDate(c.lodgementDate),
      policy_number: c.policyNumber ?? '',
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Claims Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
