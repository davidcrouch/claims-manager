import { Injectable, Inject } from '@nestjs/common';
import { eq, and, desc, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { documents, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class DocumentsListMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId?: string }): Promise<TemplateData> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const rows = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.tenantId, params.tenantId),
          isNull(documents.archivedAt),
        ),
      )
      .orderBy(desc(documents.createdAt))
      .limit(500);

    const items = rows.map((d) => ({
      file_name: d.fileName,
      mime_type: d.mimeType,
      upload_status: d.uploadStatus,
      related_record_type: d.relatedRecordType ?? '',
      created_at: formatDate(d.createdAt),
    }));

    return {
      company_name: org?.name ?? '',
      report_title: 'Documents Register',
      report_date: formatDate(new Date()),
      total_count: rows.length.toString(),
      items,
    };
  }
}
