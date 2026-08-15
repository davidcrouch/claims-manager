import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { documents, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

@Injectable()
export class DocumentMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [doc] = await this.db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, params.entityId),
          eq(documents.tenantId, params.tenantId),
        ),
      );
    if (!doc) throw new NotFoundException('Document not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      file_name: doc.fileName,
      mime_type: doc.mimeType,
      file_size: formatFileSize(doc.fileSizeBytes),
      upload_status: doc.uploadStatus,
      related_record_type: doc.relatedRecordType ?? '',
      related_record_id: doc.relatedRecordId ?? '',
      source_system: doc.sourceSystem,
      pipeline_status: doc.pipelineStatus ?? '',
      created_at: formatDate(doc.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
