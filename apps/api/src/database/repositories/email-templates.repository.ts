import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { emailTemplates } from '../schema';

export type EmailTemplateRow = typeof emailTemplates.$inferSelect;
export type EmailTemplateInsert = typeof emailTemplates.$inferInsert;

@Injectable()
export class EmailTemplatesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByType(params: {
    tenantId: string;
    templateType: string;
  }): Promise<EmailTemplateRow | null> {
    const rows = await this.db
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.tenantId, params.tenantId),
          eq(emailTemplates.templateType, params.templateType),
        ),
      );
    return rows[0] ?? null;
  }

  async findAllByTenant(params: { tenantId: string }): Promise<EmailTemplateRow[]> {
    return this.db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.tenantId, params.tenantId));
  }

  async upsert(params: {
    tenantId: string;
    templateType: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
  }): Promise<EmailTemplateRow> {
    const existing = await this.findByType({
      tenantId: params.tenantId,
      templateType: params.templateType,
    });

    if (existing) {
      const [row] = await this.db
        .update(emailTemplates)
        .set({
          subject: params.subject,
          bodyHtml: params.bodyHtml,
          bodyText: params.bodyText,
          updatedAt: new Date(),
        })
        .where(eq(emailTemplates.id, existing.id))
        .returning();
      return row;
    }

    const [row] = await this.db
      .insert(emailTemplates)
      .values({
        tenantId: params.tenantId,
        templateType: params.templateType,
        subject: params.subject,
        bodyHtml: params.bodyHtml,
        bodyText: params.bodyText,
      })
      .returning();
    return row;
  }

  async delete(params: { tenantId: string; templateType: string }): Promise<void> {
    await this.db
      .delete(emailTemplates)
      .where(
        and(
          eq(emailTemplates.tenantId, params.tenantId),
          eq(emailTemplates.templateType, params.templateType),
        ),
      );
  }
}
