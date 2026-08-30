import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkillRepository } from '../../database/repositories/skill.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { EmbeddingService } from '../ai-chat/embedding.service';
import { injectSkillInline } from '../ai-chat/stream/skill-inline-injector';
import { runSkillIsolated } from '../ai-chat/stream/skill-isolated-runner';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { SkillMatcherService } from './skill-matcher.service';
import { resolveInvocationMode } from './skill-router';
import type {
  CreateSkillDto,
  SkillConfig,
  TestMatchRequest,
  TestMatchResponse,
  UpdateSkillDto,
} from './skill.types';

const LOG_PREFIX = 'SkillService';

@Injectable()
export class SkillService {
  private readonly logger = new Logger(SkillService.name);

  constructor(
    private readonly repo: SkillRepository,
    private readonly matcher: SkillMatcherService,
    private readonly tenantContext: TenantContext,
    private readonly embeddingService: EmbeddingService,
    private readonly configService: ConfigService,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async create(dto: CreateSkillDto, _user: AuthenticatedUser): Promise<SkillConfig> {
    const tenantId = this.getTenantId();
    const skill = await this.repo.insert({
      tenantId,
      name: dto.name.trim(),
      description: dto.description?.trim() ?? null,
      triggerHints: dto.triggerHints ?? [],
      instructionPrompt: dto.instructionPrompt,
      requiredToolRefs: dto.requiredToolRefs ?? [],
      inputSchema: dto.inputSchema ?? null,
      outputSchema: dto.outputSchema ?? null,
      invocationMode: dto.invocationMode ?? 'inline',
      includeHistory: dto.includeHistory ?? false,
      historyMessageCount: dto.historyMessageCount ?? 5,
      modelOverride: dto.modelOverride ?? null,
      providerOverride: dto.providerOverride ?? null,
      category: dto.category ?? 'general',
      visibility: dto.visibility ?? 'org',
      embedding: null,
    });

    this.logger.log(`[${LOG_PREFIX}.create] created skill ${skill.id}`);

    void this.generateAndStoreEmbedding(skill).catch((err) =>
      this.logger.warn(`[${LOG_PREFIX}.create] embedding generation failed: ${String(err)}`),
    );

    return skill;
  }

  async update(
    dto: UpdateSkillDto,
    _user: AuthenticatedUser,
  ): Promise<SkillConfig | null> {
    const tenantId = this.getTenantId();
    const { id, ...updateFields } = dto;

    const result = await this.repo.update(id, tenantId, {
      ...(updateFields.name !== undefined && { name: updateFields.name.trim() }),
      ...(updateFields.description !== undefined && {
        description: updateFields.description?.trim() ?? null,
      }),
      ...(updateFields.triggerHints !== undefined && { triggerHints: updateFields.triggerHints }),
      ...(updateFields.instructionPrompt !== undefined && {
        instructionPrompt: updateFields.instructionPrompt,
      }),
      ...(updateFields.requiredToolRefs !== undefined && {
        requiredToolRefs: updateFields.requiredToolRefs,
      }),
      ...(updateFields.inputSchema !== undefined && { inputSchema: updateFields.inputSchema }),
      ...(updateFields.outputSchema !== undefined && { outputSchema: updateFields.outputSchema }),
      ...(updateFields.invocationMode !== undefined && { invocationMode: updateFields.invocationMode }),
      ...(updateFields.includeHistory !== undefined && { includeHistory: updateFields.includeHistory }),
      ...(updateFields.historyMessageCount !== undefined && {
        historyMessageCount: updateFields.historyMessageCount,
      }),
      ...(updateFields.modelOverride !== undefined && { modelOverride: updateFields.modelOverride }),
      ...(updateFields.providerOverride !== undefined && {
        providerOverride: updateFields.providerOverride,
      }),
      ...(updateFields.category !== undefined && { category: updateFields.category }),
      ...(updateFields.visibility !== undefined && { visibility: updateFields.visibility }),
    });

    if (result) {
      const embeddingRelevantFieldChanged =
        updateFields.name !== undefined ||
        updateFields.description !== undefined ||
        updateFields.triggerHints !== undefined ||
        updateFields.instructionPrompt !== undefined ||
        updateFields.category !== undefined;

      if (embeddingRelevantFieldChanged) {
        void this.generateAndStoreEmbedding(result).catch((err) =>
          this.logger.warn(`[${LOG_PREFIX}.update] embedding regeneration failed: ${String(err)}`),
        );
      }
    }

    return result;
  }

  async delete(id: string): Promise<boolean> {
    const tenantId = this.getTenantId();
    return this.repo.delete(id, tenantId);
  }

  async findById(id: string): Promise<SkillConfig | null> {
    return this.repo.findById(id, this.getTenantId());
  }

  async listVisible(_user: AuthenticatedUser): Promise<SkillConfig[]> {
    return this.repo.findVisible(this.getTenantId());
  }

  async testMatch(body: TestMatchRequest): Promise<TestMatchResponse> {
    const startTime = Date.now();
    const matches = await this.matcher.searchSkills(
      body.message,
      body.topK ?? 5,
      body.agentId,
    );
    const searchTimeMs = Date.now() - startTime;

    return {
      matches,
      embeddingTimeMs: 0,
      searchTimeMs,
    };
  }

  async testInvoke(
    skillId: string,
    message: string,
  ): Promise<{ result: string; timeMs: number; mode?: string }> {
    const skill = await this.findById(skillId);
    if (!skill) {
      return { result: 'Skill not found', timeMs: 0 };
    }

    const startTime = Date.now();
    const mode = resolveInvocationMode(skill);

    if (mode === 'isolated') {
      const aiConfig = this.configService.get('ai', { infer: true });
      const project = aiConfig?.vertexProject ?? '';
      const location = aiConfig?.vertexLocation ?? 'global';
      const parentModel = skill.modelOverride ?? 'gemini-2.5-flash';

      const isolated = await runSkillIsolated(
        skill,
        { message, reason: 'test-invoke' },
        {
          gcpProjectId: project,
          vertexLocation: location,
          parentModel,
          parentProvider: parentModel.startsWith('claude')
            ? 'vertex-anthropic'
            : 'vertex-gemini',
          tools: {},
        },
      );

      return {
        result:
          typeof isolated.result === 'string'
            ? isolated.result
            : JSON.stringify(isolated.result, null, 2),
        timeMs: isolated.timeMs,
        mode: 'isolated',
      };
    }

    const { result } = injectSkillInline(skill, 'You are a test harness.');
    const timeMs = Date.now() - startTime;
    return {
      result: `[Inline] Skill "${skill.name}" activated. Instructions would be injected (${result.injectedInstructions}). Sample user message length: ${message.length}.`,
      timeMs,
      mode: 'inline',
    };
  }

  private async generateAndStoreEmbedding(skill: SkillConfig): Promise<void> {
    const textForEmbedding = [
      skill.name,
      skill.description ?? '',
      skill.category ?? '',
      ...(skill.triggerHints ?? []),
      skill.instructionPrompt.slice(0, 500),
    ]
      .filter(Boolean)
      .join(' | ');

    const embedding = await this.embeddingService.embed(textForEmbedding);
    if (embedding.length > 0) {
      await this.repo.updateEmbedding(skill.id, embedding);
      this.logger.log(`[${LOG_PREFIX}.generateAndStoreEmbedding] stored embedding for skill ${skill.id}`);
    }
  }
}
