export type AIProvider = 'google' | 'anthropic';

export type AgentType = 'chat' | 'system';

export type AgentVisibility = 'private' | 'org' | 'public';

export const AGENT_VISIBILITY_LABELS: Record<AgentVisibility, string> = {
  private: 'Private',
  org: 'Organisation',
  public: 'Public',
};

export const AGENT_VISIBILITY_DESCRIPTIONS: Record<AgentVisibility, string> = {
  private: 'Only you can see and use this agent',
  org: 'All members of your organisation can see and use this agent',
  public: 'Anyone can see and use this agent',
};

export type ApiProvider = 'vertex-gemini' | 'vertex-anthropic';

export function apiProviderToUi(provider: string): AIProvider {
  if (provider === 'vertex-anthropic' || provider === 'anthropic') return 'anthropic';
  return 'google';
}

export function uiProviderToApi(provider: AIProvider): ApiProvider {
  return provider === 'anthropic' ? 'vertex-anthropic' : 'vertex-gemini';
}

export function normalizeAgent(agent: Agent & { provider?: string }): Agent {
  return {
    ...agent,
    provider: apiProviderToUi(agent.provider ?? 'vertex-gemini'),
    enabledTools:
      agent.enabledTools && agent.enabledTools.length > 0
        ? agent.enabledTools
        : undefined,
  };
}

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  google: 'Google Gemini',
  anthropic: 'Anthropic Claude',
};

export interface AISettings {
  provider: AIProvider;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface Agent extends AISettings {
  id: string;
  name: string;
  slug?: string;
  type?: AgentType;
  chatEnabled?: boolean;
  isDefault?: boolean;
  enabledTools?: string[];
  connectionIds?: string[];
  visibility?: AgentVisibility;
  createdBy?: string;
  ownerOrganisationId?: string;
  ownerOrganisationName?: string;
  avatarColor?: string;
  avatarUrl?: string;
  supportsVision?: boolean;
  maxSteps?: number;
  pinnedSkills?: string[];
  semanticSkills?: 'all' | 'none' | 'pinned_only';
}

export const DEFAULT_AGENT_ID = 'default';

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'google',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 4096,
  systemPrompt:
    'You are a helpful claims management assistant with access to the claims platform. ' +
    'You can look up claims, jobs, invoices, contacts, and more. ' +
    'Always be professional, concise, and accurate. When referencing data, cite the specific entities.',
};

export const DEFAULT_AGENT: Agent = {
  id: DEFAULT_AGENT_ID,
  name: 'Claims Assistant',
  isDefault: true,
  ...DEFAULT_AI_SETTINGS,
};

export interface McpToolGroupResponse {
  integrationId: string;
  integrationName: string;
  connectionId: string;
  connectionVisibility: 'org' | 'private';
  tools: Array<{
    namespacedId: string;
    originalName: string;
    description: string;
    inputSchema?: Record<string, unknown>;
  }>;
  lastDiscoveredAt: string;
  stale: boolean;
}

export type McpIntegrationVisibility = 'public' | 'org' | 'private';
export type McpIntegrationStatus = 'draft' | 'active' | 'disabled' | 'deprecated' | 'error';
export type McpConnectionStatus = 'pending' | 'connected' | 'reauth_required' | 'expired' | 'revoked' | 'error';
export type McpAuthType = 'none' | 'api_key' | 'bearer_passthrough' | 'oauth';
export type McpSharedConnectionPolicy = 'org_shared' | 'user_required';

export interface AiAuditRecord {
  id: string;
  conversationId: string | null;
  messageId: string | null;
  agentId: string | null;
  agentName: string | null;
  agentAvatarColor: string | null;
  agentAvatarUrl: string | null;
  provider: string;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  systemPrompt: string | null;
  enabledTools: string[];
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  toolsInvoked: { name: string; argsKeys: string[] }[];
  dataEntitiesAccessed: Record<string, number>;
  requestDurationMs: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  attachmentsMetadata?: AttachmentMeta[];
}

export interface AttachmentMeta {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  gcsObjectPath?: string;
  hydrationMs?: number;
  hydrationFallback?: string;
}

export type SkillVisibility = 'private' | 'org' | 'public';
export type SkillOutputFormat = 'conversational' | 'structured' | 'markdown';

export interface Skill {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  triggerHints: string[];
  instructionPrompt: string;
  requiredToolRefs?: Array<{ integration: string; tool: string }>;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  invocationMode?: 'inline' | 'isolated';
  includeHistory?: boolean;
  historyMessageCount?: number | null;
  modelOverride?: string | null;
  providerOverride?: string | null;
  category?: string | null;
  iconEmoji?: string | null;
  visibility: SkillVisibility;
  requiresConversationHistory?: boolean;
  temperature?: number | null;
  maxTokens?: number | null;
  model?: string | null;
  outputFormat?: SkillOutputFormat;
  requiredTools?: string[];
  createdAt: string;
  updatedAt: string;
}

export const SKILL_VISIBILITY_LABELS: Record<SkillVisibility, string> = {
  private: 'Private',
  org: 'Organisation',
  public: 'Public',
};

export const SKILL_VISIBILITY_DESCRIPTIONS: Record<SkillVisibility, string> = {
  private: 'Only visible within private scope',
  org: 'All members of your organisation can use this skill',
  public: 'Anyone can use this skill',
};

export const SKILL_OUTPUT_FORMAT_LABELS: Record<SkillOutputFormat, string> = {
  conversational: 'Conversational',
  structured: 'Structured JSON',
  markdown: 'Markdown',
};
