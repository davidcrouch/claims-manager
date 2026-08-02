import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { aiSettings } from '../schema';

export type AiSettingsRow = typeof aiSettings.$inferSelect;
export type AiSettingsInsert = typeof aiSettings.$inferInsert;

@Injectable()
export class AiSettingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByTenant(tenantId: string): Promise<AiSettingsRow | null> {
    const [row] = await this.db
      .select()
      .from(aiSettings)
      .where(eq(aiSettings.tenantId, tenantId))
      .limit(1);
    return row ?? null;
  }

  async upsert(data: AiSettingsInsert): Promise<AiSettingsRow> {
    const existing = await this.findByTenant(data.tenantId);
    if (existing) {
      const [updated] = await this.db
        .update(aiSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiSettings.tenantId, data.tenantId))
        .returning();
      return updated!;
    }

    const [inserted] = await this.db.insert(aiSettings).values(data).returning();
    return inserted!;
  }
}
