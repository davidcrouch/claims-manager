import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { reports, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ReportMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [report] = await this.db
      .select()
      .from(reports)
      .where(and(eq(reports.id, params.entityId), eq(reports.tenantId, params.tenantId)));
    if (!report) throw new NotFoundException('Report not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const reportData = report.reportData as Record<string, unknown>;
    const reportMeta = report.reportMeta as Record<string, unknown>;

    return {
      company_name: org?.name ?? '',
      report_title: report.title ?? '',
      report_reference: report.reference ?? '',
      report_date: formatDate(report.createdAt),
      report_data: reportData,
      report_meta: reportMeta,
      ...this.flattenReportData(reportData),
    };
  }

  private flattenReportData(
    data: Record<string, unknown>,
    prefix = 'data_',
  ): Record<string, unknown> {
    const flat: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(
          flat,
          this.flattenReportData(value as Record<string, unknown>, `${prefix}${key}_`),
        );
      } else {
        flat[`${prefix}${key}`] = value;
      }
    }
    return flat;
  }
}
