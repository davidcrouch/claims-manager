import { Injectable, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle.module';
import type { DrizzleDB } from '../drizzle.module';
import { externalEventAttempts } from '../schema';

export type ExternalEventAttemptRow = typeof externalEventAttempts.$inferSelect;
export type ExternalEventAttemptInsert = typeof externalEventAttempts.$inferInsert;

@Injectable()
export class ExternalEventAttemptsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: ExternalEventAttemptInsert;
  }): Promise<ExternalEventAttemptRow> {
    const [inserted] = await this.db
      .insert(externalEventAttempts)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async findByEventId(params: {
    eventId: string;
  }): Promise<ExternalEventAttemptRow[]> {
    return this.db
      .select()
      .from(externalEventAttempts)
      .where(eq(externalEventAttempts.eventId, params.eventId));
  }

  async updateStatus(params: {
    id: string;
    status: string;
    completedAt?: Date;
    errorMessage?: string;
    errorStack?: string;
  }): Promise<ExternalEventAttemptRow | null> {
    const setData: Record<string, unknown> = { status: params.status };
    if (params.completedAt !== undefined) setData.completedAt = params.completedAt;
    if (params.errorMessage !== undefined) setData.errorMessage = params.errorMessage;
    if (params.errorStack !== undefined) setData.errorStack = params.errorStack;

    const [updated] = await this.db
      .update(externalEventAttempts)
      .set(setData)
      .where(eq(externalEventAttempts.id, params.id))
      .returning();
    return updated ?? null;
  }
}
