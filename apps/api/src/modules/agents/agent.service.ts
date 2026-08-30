import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import {
  AgentRepository,
  type AgentRow,
} from '../../database/repositories/agent.repository';
import { TenantContext } from '../../tenant/tenant-context';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type {
  AgentConfig,
  AgentToolRefGroup,
  CreateAgentDto,
  UpdateAgentDto,
} from './agent.types';
import { DEFAULT_AGENT_CONFIG } from './agent.types';

const LOG_PREFIX = 'AgentService';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAgentUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function slugifyAgentName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'agent';
}

function parseNumeric(value: string | number | null | undefined, fallback: number): number {
  if (value == null) return fallback;
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseEnabledTools(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    if (raw.every((item) => typeof item === 'string')) {
      return raw as string[];
    }
    // Flatten AgentToolRefGroup[] → namespaced tool names (legacy)
    const names: string[] = [];
    for (const item of raw) {
      if (item && typeof item === 'object' && Array.isArray((item as AgentToolRefGroup).tools)) {
        names.push(...(item as AgentToolRefGroup).tools);
      }
    }
    return names;
  }
  return [];
}

export function rowToConfig(row: AgentRow): AgentConfig {
  const enabledTools = parseEnabledTools(row.enabledToolRefs);
  return {
    id: row.id,
    slug: row.slug ?? undefined,
    name: row.name,
    type: row.type as 'chat' | 'system',
    chatEnabled: row.chatEnabled,
    provider: row.provider,
    model: row.model,
    temperature: parseNumeric(row.temperature, 0.7),
    maxTokens: row.maxTokens ?? 8192,
    systemPrompt: row.systemPrompt ?? DEFAULT_AGENT_CONFIG.systemPrompt,
    isDefault: row.isDefault,
    enabledTools,
    enabledToolRefs: Array.isArray(row.enabledToolRefs)
      ? (row.enabledToolRefs as AgentToolRefGroup[])
      : undefined,
    connectionIds: row.connectionIds ?? [],
    visibility: row.visibility as AgentConfig['visibility'],
    avatarUrl: row.avatarUrl ?? undefined,
    supportsVision: row.supportsVision ?? undefined,
    maxSteps: row.maxSteps ?? undefined,
    autonomousMode: row.autonomousMode ?? false,
    pauseAfterToolSteps: row.pauseAfterToolSteps ?? 4,
    maxDurationSeconds: row.maxDurationSeconds ?? 120,
    pinnedSkills: row.pinnedSkills ?? [],
    semanticSkills: (row.semanticSkills as AgentConfig['semanticSkills']) ?? 'all',
  };
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly repo: AgentRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  private getTenantId(): string {
    return this.tenantContext.getTenantId();
  }

  async listVisibleAgents(
    _user: AuthenticatedUser,
    opts?: { chatEnabled?: boolean },
  ): Promise<AgentConfig[]> {
    const tenantId = this.getTenantId();
    const rows = await this.repo.findByTenant(tenantId);
    let agents = rows.map(rowToConfig);

    if (opts?.chatEnabled !== undefined) {
      agents = agents.filter((a) => this.isChatEnabled(a) === opts.chatEnabled);
    }

    return agents;
  }

  private isChatEnabled(agent: AgentConfig): boolean {
    if (agent.chatEnabled !== undefined) return agent.chatEnabled;
    return agent.type !== 'system';
  }

  async resolveAgentById(
    agentId: string | undefined,
    _user: AuthenticatedUser,
  ): Promise<AgentConfig> {
    const tenantId = this.getTenantId();

    // Frontend may send the sentinel "default" before real agents load.
    if (agentId && isAgentUuid(agentId)) {
      const row = await this.repo.findById(agentId, tenantId);
      if (row) {
        this.logger.log(
          `[${LOG_PREFIX}.resolveAgentById] resolved agent ${row.id} (${row.name})`,
        );
        return rowToConfig(row);
      }
      this.logger.warn(
        `[${LOG_PREFIX}.resolveAgentById] agent not found id=${agentId}, falling back`,
      );
    } else if (agentId) {
      this.logger.warn(
        `[${LOG_PREFIX}.resolveAgentById] ignoring non-uuid agentId=${agentId}, falling back`,
      );
    }

    const defaultRow = await this.repo.findDefaultByTenant(tenantId);
    if (defaultRow) {
      return rowToConfig(defaultRow);
    }

    const anyRow = await this.repo.findFirstChatEnabled(tenantId);
    if (anyRow) {
      return rowToConfig(anyRow);
    }

    return this.ensureDefaultAgent(tenantId);
  }

  async getAgentById(
    agentId: string,
    user: AuthenticatedUser,
  ): Promise<AgentConfig | null> {
    const visible = await this.listVisibleAgents(user);
    return visible.find((a) => a.id === agentId) ?? null;
  }

  async ensureDefaultAgent(tenantId?: string): Promise<AgentConfig> {
    const resolvedTenantId = tenantId ?? this.getTenantId();
    const existing = await this.repo.findDefaultByTenant(resolvedTenantId);
    if (existing) {
      return rowToConfig(existing);
    }

    const bySlug = await this.repo.findBySlug(
      resolvedTenantId,
      DEFAULT_AGENT_CONFIG.slug!,
    );
    if (bySlug) {
      return rowToConfig(bySlug);
    }

    const created = await this.repo.create({
      tenantId: resolvedTenantId,
      slug: DEFAULT_AGENT_CONFIG.slug,
      name: DEFAULT_AGENT_CONFIG.name,
      type: DEFAULT_AGENT_CONFIG.type ?? 'chat',
      chatEnabled: DEFAULT_AGENT_CONFIG.chatEnabled ?? true,
      provider: DEFAULT_AGENT_CONFIG.provider,
      model: DEFAULT_AGENT_CONFIG.model,
      temperature: String(DEFAULT_AGENT_CONFIG.temperature),
      maxTokens: DEFAULT_AGENT_CONFIG.maxTokens,
      systemPrompt: DEFAULT_AGENT_CONFIG.systemPrompt,
      isDefault: true,
      visibility: DEFAULT_AGENT_CONFIG.visibility ?? 'org',
      connectionIds: [],
      enabledToolRefs: [],
    });

    this.logger.log(
      `[${LOG_PREFIX}.ensureDefaultAgent] created default agent ${created.id}`,
    );
    return rowToConfig(created);
  }

  async createAgent(
    dto: CreateAgentDto,
    _user: AuthenticatedUser,
  ): Promise<AgentConfig> {
    const tenantId = this.getTenantId();
    const count = await this.repo.countByTenant(tenantId);

    const baseSlug = slugifyAgentName(dto.name);
    let slug = baseSlug;
    const slugClash = await this.repo.findBySlug(tenantId, slug);
    if (slugClash) {
      slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
    }

    const created = await this.repo.create({
      tenantId,
      slug: dto.slug?.trim() || slug,
      name: dto.name.trim(),
      type: dto.type ?? 'chat',
      chatEnabled: dto.chatEnabled ?? dto.type !== 'system',
      provider: dto.provider ?? DEFAULT_AGENT_CONFIG.provider,
      model: dto.model ?? DEFAULT_AGENT_CONFIG.model,
      temperature: String(dto.temperature),
      maxTokens: dto.maxTokens,
      systemPrompt: dto.systemPrompt,
      isDefault: dto.isDefault ?? count === 0,
      connectionIds: dto.connectionIds ?? [],
      visibility: dto.visibility ?? 'org',
      avatarUrl: dto.avatarUrl ?? null,
      supportsVision: dto.supportsVision ?? false,
      enabledToolRefs: dto.enabledTools ?? [],
      pinnedSkills: dto.pinnedSkills ?? [],
      semanticSkills: dto.semanticSkills ?? 'all',
      ...(dto.maxSteps !== undefined && { maxSteps: dto.maxSteps }),
      ...(dto.autonomousMode !== undefined && { autonomousMode: dto.autonomousMode }),
      ...(dto.pauseAfterToolSteps !== undefined && { pauseAfterToolSteps: dto.pauseAfterToolSteps }),
      ...(dto.maxDurationSeconds !== undefined && { maxDurationSeconds: dto.maxDurationSeconds }),
      ...(dto.packInstallId !== undefined && { packInstallId: dto.packInstallId }),
    });

    this.logger.log(
      `[${LOG_PREFIX}.createAgent] created agent ${created.id} for tenant ${tenantId}`,
    );
    return rowToConfig(created);
  }

  async updateAgent(
    dto: UpdateAgentDto,
    _user: AuthenticatedUser,
  ): Promise<{ ok: boolean; agent?: AgentConfig; error?: string }> {
    const tenantId = this.getTenantId();
    const existing = await this.repo.findById(dto.id, tenantId);
    if (!existing) {
      return { ok: false, error: 'Agent not found in this tenant' };
    }

    const updated = await this.repo.update(dto.id, tenantId, {
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.chatEnabled !== undefined && { chatEnabled: dto.chatEnabled }),
      ...(dto.provider !== undefined && { provider: dto.provider }),
      ...(dto.model !== undefined && { model: dto.model }),
      ...(dto.temperature !== undefined && { temperature: String(dto.temperature) }),
      ...(dto.maxTokens !== undefined && { maxTokens: dto.maxTokens }),
      ...(dto.systemPrompt !== undefined && { systemPrompt: dto.systemPrompt }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      ...(dto.connectionIds !== undefined && { connectionIds: dto.connectionIds }),
      ...(dto.visibility !== undefined && { visibility: dto.visibility }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.supportsVision !== undefined && { supportsVision: dto.supportsVision }),
      ...(dto.maxSteps !== undefined && { maxSteps: dto.maxSteps }),
      ...(dto.autonomousMode !== undefined && { autonomousMode: dto.autonomousMode }),
      ...(dto.pauseAfterToolSteps !== undefined && { pauseAfterToolSteps: dto.pauseAfterToolSteps }),
      ...(dto.maxDurationSeconds !== undefined && { maxDurationSeconds: dto.maxDurationSeconds }),
      ...(dto.enabledTools !== undefined && { enabledToolRefs: dto.enabledTools }),
      ...(dto.pinnedSkills !== undefined && { pinnedSkills: dto.pinnedSkills }),
      ...(dto.semanticSkills !== undefined && { semanticSkills: dto.semanticSkills }),
    });

    if (!updated) {
      return { ok: false, error: 'Failed to update agent' };
    }

    return { ok: true, agent: rowToConfig(updated) };
  }

  async deleteAgent(
    agentId: string,
    _user: AuthenticatedUser,
  ): Promise<{ ok: boolean; error?: string }> {
    const tenantId = this.getTenantId();
    const target = await this.repo.findById(agentId, tenantId);
    if (!target) {
      return { ok: false, error: 'Agent not found' };
    }
    if (target.isDefault) {
      return { ok: false, error: 'Cannot delete the default agent' };
    }

    await this.repo.delete(agentId, tenantId);
    this.logger.log(
      `[${LOG_PREFIX}.deleteAgent] deleted agent ${agentId}`,
    );
    return { ok: true };
  }
}
