import { Injectable, Logger } from '@nestjs/common';
import { AiUserMemoryRepository } from '../../database/repositories/ai-user-memory.repository';
import type { AiUserMemoryRow } from '../../database/repositories/ai-user-memory.repository';

@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name);

  constructor(private readonly memoryRepo: AiUserMemoryRepository) {}

  async listAll(tenantId: string, userId: string): Promise<AiUserMemoryRow[]> {
    this.logger.log(`[AiMemoryService.listAll] tenant=${tenantId} user=${userId}`);
    return this.memoryRepo.findByTenantAndUser({ tenantId, userId });
  }

  async remember(params: {
    tenantId: string;
    userId: string;
    key: string;
    value: string;
    scope?: string;
    scopeId?: string;
  }): Promise<AiUserMemoryRow> {
    this.logger.log(
      `[AiMemoryService.remember] tenant=${params.tenantId} user=${params.userId} key=${params.key}`,
    );
    return this.memoryRepo.upsert({
      tenantId: params.tenantId,
      userId: params.userId,
      key: params.key,
      value: params.value,
      scope: params.scope ?? 'global',
      scopeId: params.scopeId ?? null,
    });
  }

  async forget(tenantId: string, userId: string, key: string): Promise<void> {
    this.logger.log(
      `[AiMemoryService.forget] tenant=${tenantId} user=${userId} key=${key}`,
    );
    await this.memoryRepo.deleteByKey({ tenantId, userId, key });
  }

  async deleteById(tenantId: string, memoryId: string): Promise<void> {
    this.logger.log(
      `[AiMemoryService.deleteById] tenant=${tenantId} id=${memoryId}`,
    );
    await this.memoryRepo.deleteById({ tenantId, id: memoryId });
  }

  async getMemories(
    tenantId: string,
    userId: string,
    scope?: string,
    scopeId?: string,
    limit?: number,
  ): Promise<AiUserMemoryRow[]> {
    this.logger.log(
      `[AiMemoryService.getMemories] tenant=${tenantId} user=${userId} scope=${scope ?? 'all'}`,
    );
    return this.memoryRepo.findByTenantAndUser({
      tenantId,
      userId,
      scope,
      scopeId,
      limit,
    });
  }
}
