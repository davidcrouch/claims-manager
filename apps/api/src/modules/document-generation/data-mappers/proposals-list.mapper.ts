import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { proposals, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatCurrency } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ProposalsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(proposals)
      .where(and(eq(proposals.tenantId, params.tenantId)))
      .orderBy(desc(proposals.createdAt))
      .limit(500);

    const items = rows.map((p) => ({
      proposal_number: p.proposalNumber ?? '',
      name: p.name ?? '',
      date: formatDate(p.proposalDate),
      total_amount: formatCurrency(p.totalAmount),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Proposals Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
