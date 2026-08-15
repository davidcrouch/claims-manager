export type AgentVisibility = 'private' | 'org' | 'public';

export interface AgentToolRefGroup {
  integration: string;
  tools: string[];
}

export interface AgentConfig {
  id: string;
  slug?: string;
  name: string;
  type?: 'chat' | 'system';
  chatEnabled?: boolean;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault?: boolean;
  /** Namespaced MCP tool IDs this agent may call. Empty = all tools from selected connections. */
  enabledTools?: string[];
  enabledToolRefs?: AgentToolRefGroup[];
  connectionIds?: string[];
  visibility?: AgentVisibility;
  avatarUrl?: string;
  avatarColor?: string;
  supportsVision?: boolean;
  maxSteps?: number;
  pinnedSkills?: string[];
  semanticSkills?: 'all' | 'none' | 'pinned_only';
}

export interface CreateAgentDto {
  name: string;
  type?: 'chat' | 'system';
  chatEnabled?: boolean;
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  isDefault?: boolean;
  enabledTools?: string[];
  connectionIds?: string[];
  visibility?: AgentVisibility;
  avatarUrl?: string;
  supportsVision?: boolean;
  maxSteps?: number;
  pinnedSkills?: string[];
  semanticSkills?: 'all' | 'none' | 'pinned_only';
  /** Set when materializing from a capability pack install. */
  packInstallId?: string;
  slug?: string;
}

export interface UpdateAgentDto extends Partial<CreateAgentDto> {
  id: string;
}

export const DEFAULT_SYSTEM_PROMPT =
  'You are a helpful insurance claims management assistant for the Claims Manager platform. ' +
  'You can help users look up claims, jobs, tasks, contacts, quotes, documents, and more. ' +
  'Always be professional, concise, and accurate. When referencing data, cite specific entities.';

export const DEFAULT_AGENT_CONFIG: Omit<AgentConfig, 'id'> = {
  slug: 'claims-assistant',
  name: 'Claims Assistant',
  type: 'chat',
  chatEnabled: true,
  provider: 'vertex-gemini',
  model: 'gemini-2.5-flash',
  temperature: 0.7,
  maxTokens: 8192,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  isDefault: true,
  visibility: 'org',
};
