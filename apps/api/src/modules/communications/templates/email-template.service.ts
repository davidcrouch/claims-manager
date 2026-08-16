import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.module';
import type { DrizzleDB } from '../../../database/drizzle.module';
import { emailTemplates } from '../../../database/schema';
import { DEFAULT_RFQ_EMAIL_TEMPLATE } from './default-rfq-email';

export interface ResolvedEmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

export interface TemplateMergeFields {
  rfq_number?: string;
  rfq_name?: string;
  recipient_name?: string;
  sender_name?: string;
  company_name?: string;
  due_date?: string;
  reply_to_email?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async resolve(params: {
    tenantId: string;
    templateType: string;
  }): Promise<ResolvedEmailTemplate> {
    const row = await this.db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.tenantId, params.tenantId),
          eq(emailTemplates.templateType, params.templateType),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (row) {
      return {
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        bodyText: row.bodyText ?? undefined,
      };
    }

    this.logger.log(
      `communications:email-template-service:resolve - No custom template for ${params.templateType}, using default`,
    );
    return DEFAULT_RFQ_EMAIL_TEMPLATE;
  }

  renderTemplate(template: ResolvedEmailTemplate, fields: TemplateMergeFields): ResolvedEmailTemplate {
    const render = (str: string): string => {
      return str.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
        return fields[key] ?? '';
      });
    };

    return {
      subject: render(template.subject),
      bodyHtml: render(template.bodyHtml),
      bodyText: template.bodyText ? render(template.bodyText) : undefined,
    };
  }

  async upsert(params: {
    tenantId: string;
    templateType: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
  }): Promise<void> {
    const existing = await this.db
      .select({ id: emailTemplates.id })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.tenantId, params.tenantId),
          eq(emailTemplates.templateType, params.templateType),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (existing) {
      await this.db
        .update(emailTemplates)
        .set({
          subject: params.subject,
          bodyHtml: params.bodyHtml,
          bodyText: params.bodyText,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, existing.id));
    } else {
      await this.db.insert(emailTemplates).values({
        tenantId: params.tenantId,
        templateType: params.templateType,
        subject: params.subject,
        bodyHtml: params.bodyHtml,
        bodyText: params.bodyText,
      });
    }
  }

  async get(params: {
    tenantId: string;
    templateType: string;
  }): Promise<ResolvedEmailTemplate | null> {
    const row = await this.db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.tenantId, params.tenantId),
          eq(emailTemplates.templateType, params.templateType),
        ),
      )
      .then((rows) => rows[0] ?? null);

    if (!row) return null;
    return { subject: row.subject, bodyHtml: row.bodyHtml, bodyText: row.bodyText ?? undefined };
  }
}
