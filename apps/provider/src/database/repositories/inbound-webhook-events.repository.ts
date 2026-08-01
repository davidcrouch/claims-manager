import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { inboundWebhookEvents } from '../schema';

export type InboundWebhookEventRow = typeof inboundWebhookEvents.$inferSelect;
export type InboundWebhookEventInsert = typeof inboundWebhookEvents.$inferInsert;

@Injectable()
export class InboundWebhookEventsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByExternalEventId(params: {
    externalEventId: string;
  }): Promise<InboundWebhookEventRow | null> {
    const [row] = await this.db
      .select()
      .from(inboundWebhookEvents)
      .where(eq(inboundWebhookEvents.externalEventId, params.externalEventId))
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    data: InboundWebhookEventInsert;
  }): Promise<InboundWebhookEventRow> {
    const [inserted] = await this.db
      .insert(inboundWebhookEvents)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async updateProcessingStatus(params: {
    id: string;
    processingStatus: string;
    processingError?: string | null;
  }): Promise<InboundWebhookEventRow | null> {
    const setData: Record<string, unknown> = {
      processingStatus: params.processingStatus,
    };
    if (params.processingError !== undefined) {
      setData.processingError = params.processingError;
    }
    const [updated] = await this.db
      .update(inboundWebhookEvents)
      .set(setData)
      .where(eq(inboundWebhookEvents.id, params.id))
      .returning();
    return updated ?? null;
  }
}
