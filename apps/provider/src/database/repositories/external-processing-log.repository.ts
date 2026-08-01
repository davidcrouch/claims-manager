import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../drizzle.module';
import { externalProcessingLog } from '../schema';

export type ExternalProcessingLogInsert =
  typeof externalProcessingLog.$inferInsert;
export type ExternalProcessingLogRow =
  typeof externalProcessingLog.$inferSelect;

@Injectable()
export class ExternalProcessingLogRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async create(params: {
    data: ExternalProcessingLogInsert;
  }): Promise<ExternalProcessingLogRow> {
    const [inserted] = await this.db
      .insert(externalProcessingLog)
      .values(params.data)
      .returning();
    return inserted!;
  }

  async updateStatus(params: {
    id: string;
    status: string;
    errorMessage?: string;
    workflowRunId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ExternalProcessingLogRow | null> {
    const setData: Record<string, unknown> = {
      status: params.status,
      updatedAt: new Date(),
    };
    if (params.errorMessage !== undefined) setData.errorMessage = params.errorMessage;
    if (params.workflowRunId !== undefined) setData.workflowRunId = params.workflowRunId;
    if (params.metadata !== undefined) setData.metadata = params.metadata;

    const [updated] = await this.db
      .update(externalProcessingLog)
      .set(setData)
      .where(eq(externalProcessingLog.id, params.id))
      .returning();
    return updated ?? null;
  }
}
