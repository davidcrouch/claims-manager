import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { messages, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class MessageMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [msg] = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.id, params.entityId), eq(messages.tenantId, params.tenantId)));
    if (!msg) throw new NotFoundException('Message not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    return {
      company_name: org?.name ?? '',
      subject: msg.subject ?? '',
      body: msg.body ?? '',
      acknowledgement_required: msg.acknowledgementRequired ? 'Yes' : 'No',
      acknowledged_at: formatDate(msg.acknowledgedAt),
      created_at: formatDate(msg.createdAt),
      report_date: formatDate(new Date()),
    };
  }
}
