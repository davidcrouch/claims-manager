import { Injectable, Logger } from '@nestjs/common';
import { SkillRepository } from '../../database/repositories/skill.repository';
import { AgentRepository } from '../../database/repositories/agent.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { EmbeddingService } from '../ai-chat/embedding.service';
import type { AgentConfig } from '../agents/agent.types';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type { SkillConfig, SkillMatchResult } from './skill.types';

const LOG_PREFIX = 'SkillMatcherService';
const DEFAULT_TOP_K = 5;
const MIN_SIMILARITY_THRESHOLD = 0.45;
const MIN_KEYWORD_SCORE = 0.35;

@Injectable()
export class SkillMatcherService {
  private readonly logger = new Logger(SkillMatcherService.name);

  constructor(
    private readonly skillRepo: SkillRepository,
    private readonly agentRepo: AgentRepository,
    private readonly tenantContext: TenantContext,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async findMatches(
    userMessage: string,
    agent: AgentConfig,
    _user: AuthenticatedUser,
  ): Promise<SkillMatchResult[]> {
    const tenantId = this.tenantContext.getTenantId();
    const results: SkillMatchResult[] = [];
    const seen = new Set<string>();

    const pinnedIds = agent.pinnedSkills ?? [];
    if (pinnedIds.length > 0) {
      const pinnedSkills = await this.skillRepo.findByIds(pinnedIds, tenantId);
      for (const skill of pinnedSkills) {
        results.push({ skill, similarity: 1.0, source: 'pinned' });
        seen.add(skill.id);
      }
    }

    const semanticPool = agent.semanticSkills ?? 'all';
    if (semanticPool !== 'none' && semanticPool !== 'pinned_only') {
      try {
        const semanticResults = await this.findSemanticMatches(
          userMessage,
          tenantId,
          [...seen],
          DEFAULT_TOP_K,
        );
        for (const match of semanticResults) {
          if (!seen.has(match.skill.id)) {
            results.push(match);
            seen.add(match.skill.id);
          }
        }
      } catch (err) {
        this.logger.warn(
          `[${LOG_PREFIX}.findMatches] semantic matching failed, falling back to keywords: ${err instanceof Error ? err.message : String(err)}`,
        );
        const keywordResults = await this.findKeywordMatches(
          userMessage,
          tenantId,
          [...seen],
          DEFAULT_TOP_K,
        );
        for (const match of keywordResults) {
          if (!seen.has(match.skill.id)) {
            results.push(match);
            seen.add(match.skill.id);
          }
        }
      }
    }

    this.logger.log(
      `[${LOG_PREFIX}.findMatches] matched ${results.length} skill(s) for agent ${agent.id}`,
    );
    return results;
  }

  async searchSkills(
    message: string,
    topK: number = DEFAULT_TOP_K,
    agentId?: string,
  ): Promise<SkillMatchResult[]> {
    const tenantId = this.tenantContext.getTenantId();
    const excludeIds: string[] = [];

    if (agentId) {
      const agent = await this.agentRepo.findById(agentId, tenantId);
      if (agent?.pinnedSkills?.length) {
        excludeIds.push(...agent.pinnedSkills);
      }
    }

    return this.findSemanticMatches(message, tenantId, excludeIds, topK);
  }

  private async findSemanticMatches(
    text: string,
    tenantId: string,
    excludeIds: string[],
    topK: number,
  ): Promise<SkillMatchResult[]> {
    if (!text.trim()) return [];

    const startTime = Date.now();
    const embedding = await this.embeddingService.embed(text);
    const embedMs = Date.now() - startTime;

    if (embedding.length === 0) {
      this.logger.warn(
        `[${LOG_PREFIX}.findSemanticMatches] empty embedding returned, falling back to keywords`,
      );
      return this.findKeywordMatches(text, tenantId, excludeIds, topK);
    }

    const searchStart = Date.now();
    const matches = await this.skillRepo.vectorSearch(
      embedding,
      tenantId,
      topK,
      excludeIds,
    );
    const searchMs = Date.now() - searchStart;

    this.logger.log(
      `[${LOG_PREFIX}.findSemanticMatches] embedMs=${embedMs} searchMs=${searchMs} matchCount=${matches.length} topSimilarity=${matches[0]?.similarity ?? 0}`,
    );

    const filtered = matches.filter((m) => m.similarity >= MIN_SIMILARITY_THRESHOLD);

    if (filtered.length === 0) {
      return this.findKeywordMatches(text, tenantId, excludeIds, topK);
    }

    return filtered.map((m) => ({
      skill: m,
      similarity: m.similarity,
      source: 'semantic' as const,
    }));
  }

  private async findKeywordMatches(
    text: string,
    tenantId: string,
    excludeIds: string[],
    topK: number,
  ): Promise<SkillMatchResult[]> {
    if (!text.trim()) return [];

    const startTime = Date.now();
    const normalizedMessage = normalizeText(text);
    const messageTokens = tokenize(normalizedMessage);
    const skills = await this.skillRepo.findVisible(tenantId);

    const scored = skills
      .filter((skill) => !excludeIds.includes(skill.id))
      .map((skill) => ({
        skill,
        similarity: scoreSkillMatch(skill, normalizedMessage, messageTokens),
        source: 'keyword' as const,
      }))
      .filter((match) => match.similarity >= MIN_KEYWORD_SCORE)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    const searchTimeMs = Date.now() - startTime;
    this.logger.debug(
      `[${LOG_PREFIX}.findKeywordMatches] searchTimeMs=${searchTimeMs} matches=${scored.length}`,
    );

    return scored;
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string): Set<string> {
  return new Set(
    value
      .split(/[^a-z0-9]+/i)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function scoreSkillMatch(
  skill: SkillConfig,
  normalizedMessage: string,
  messageTokens: Set<string>,
): number {
  let best = 0;

  const candidates = [
    skill.name,
    skill.description ?? '',
    skill.category ?? '',
    ...skill.triggerHints,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeText(candidate);
    if (!normalizedCandidate) continue;

    if (normalizedMessage.includes(normalizedCandidate)) {
      best = Math.max(best, normalizedCandidate.length >= 8 ? 0.95 : 0.8);
      continue;
    }

    const candidateTokens = tokenize(normalizedCandidate);
    if (candidateTokens.size === 0) continue;

    let overlap = 0;
    for (const token of candidateTokens) {
      if (messageTokens.has(token)) overlap += 1;
    }

    if (overlap > 0) {
      best = Math.max(best, overlap / candidateTokens.size);
    }
  }

  return best;
}
