import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { aiScheduledTask } from '../../database/schema';

export type AiScheduledTaskRow = typeof aiScheduledTask.$inferSelect;
export type AiScheduledTaskInsert = typeof aiScheduledTask.$inferInsert;

@Injectable()
export class AiScheduledTasksService {
  private readonly logger = new Logger(AiScheduledTasksService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async list(tenantId: string, userId: string): Promise<AiScheduledTaskRow[]> {
    this.logger.log(
      `[AiScheduledTasksService.list] tenant=${tenantId} user=${userId}`,
    );
    return this.db
      .select()
      .from(aiScheduledTask)
      .where(
        and(
          eq(aiScheduledTask.tenantId, tenantId),
          eq(aiScheduledTask.userId, userId),
        ),
      )
      .orderBy(desc(aiScheduledTask.createdAt));
  }

  async create(data: AiScheduledTaskInsert): Promise<AiScheduledTaskRow> {
    this.logger.log(
      `[AiScheduledTasksService.create] tenant=${data.tenantId} user=${data.userId} name=${data.name}`,
    );
    const [row] = await this.db
      .insert(aiScheduledTask)
      .values(data)
      .returning();
    return row!;
  }

  async toggle(
    tenantId: string,
    userId: string,
    id: string,
    enabled: boolean,
  ): Promise<AiScheduledTaskRow> {
    this.logger.log(
      `[AiScheduledTasksService.toggle] tenant=${tenantId} id=${id} enabled=${enabled}`,
    );
    const [updated] = await this.db
      .update(aiScheduledTask)
      .set({ enabled, updatedAt: new Date() })
      .where(
        and(
          eq(aiScheduledTask.id, id),
          eq(aiScheduledTask.tenantId, tenantId),
          eq(aiScheduledTask.userId, userId),
        ),
      )
      .returning();
    if (!updated) {
      throw new NotFoundException(`Scheduled task ${id} not found`);
    }
    return updated;
  }

  async update(
    tenantId: string,
    userId: string,
    id: string,
    data: Partial<Pick<AiScheduledTaskInsert, 'name' | 'cronExpression' | 'runAt' | 'prompt' | 'agentId' | 'enabled'>>,
  ): Promise<AiScheduledTaskRow> {
    this.logger.log(
      `[AiScheduledTasksService.update] tenant=${tenantId} id=${id}`,
    );
    const [updated] = await this.db
      .update(aiScheduledTask)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(aiScheduledTask.id, id),
          eq(aiScheduledTask.tenantId, tenantId),
          eq(aiScheduledTask.userId, userId),
        ),
      )
      .returning();
    if (!updated) {
      throw new NotFoundException(`Scheduled task ${id} not found`);
    }
    return updated;
  }

  async remove(tenantId: string, userId: string, id: string): Promise<void> {
    this.logger.log(
      `[AiScheduledTasksService.remove] tenant=${tenantId} id=${id}`,
    );
    const deleted = await this.db
      .delete(aiScheduledTask)
      .where(
        and(
          eq(aiScheduledTask.id, id),
          eq(aiScheduledTask.tenantId, tenantId),
          eq(aiScheduledTask.userId, userId),
        ),
      )
      .returning();
    if (deleted.length === 0) {
      throw new NotFoundException(`Scheduled task ${id} not found`);
    }
  }
}
