import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiSettingsRepository } from '../../database/repositories/ai-settings.repository';
import { TenantContext } from '../../tenant/tenant-context';
import type { UpsertAiSettingsDto } from './ai-chat.types';

@Injectable()
export class AiSettingsService {
  private readonly logger = new Logger(AiSettingsService.name);

  constructor(
    private readonly repo: AiSettingsRepository,
    private readonly tenantContext: TenantContext,
    private readonly configService: ConfigService,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async getSettings() {
    const tenantId = this.getTenantId();
    const row = await this.repo.findByTenant(tenantId);
    const aiConfig = this.configService.get('ai', { infer: true });

    if (!row) {
      return {
        tenantId,
        defaultProvider: aiConfig?.defaultProvider ?? 'vertex-gemini',
        defaultModel: aiConfig?.defaultModel ?? 'gemini-2.5-flash',
        defaultTemperature: 0.7,
        maxTokensPerResponse: 8192,
        enabled: false,
      };
    }

    return {
      id: row.id,
      tenantId: row.tenantId,
      defaultProvider: row.defaultProvider,
      defaultModel: row.defaultModel,
      defaultTemperature: parseFloat(row.defaultTemperature),
      maxTokensPerResponse: row.maxTokensPerResponse,
      enabled: row.enabled,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async upsertSettings(dto: UpsertAiSettingsDto) {
    const tenantId = this.getTenantId();
    const aiConfig = this.configService.get('ai', { infer: true });

    const saved = await this.repo.upsert({
      tenantId,
      defaultProvider: dto.defaultProvider ?? aiConfig?.defaultProvider ?? 'vertex-gemini',
      defaultModel: dto.defaultModel ?? aiConfig?.defaultModel ?? 'gemini-2.5-flash',
      defaultTemperature: String(dto.defaultTemperature ?? 0.7),
      maxTokensPerResponse: dto.maxTokensPerResponse ?? 8192,
      enabled: dto.enabled ?? false,
    });

    this.logger.log(
      `[AiSettingsService.upsertSettings] saved settings for tenant ${tenantId}`,
    );

    return {
      id: saved.id,
      tenantId: saved.tenantId,
      defaultProvider: saved.defaultProvider,
      defaultModel: saved.defaultModel,
      defaultTemperature: parseFloat(saved.defaultTemperature),
      maxTokensPerResponse: saved.maxTokensPerResponse,
      enabled: saved.enabled,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    };
  }
}
