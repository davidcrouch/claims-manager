export type SkillVisibility = 'public' | 'org' | 'private';
export type SkillInvocationMode = 'inline' | 'isolated';

export interface SkillToolRef {
  integration: string;
  tool: string;
}

export interface SkillConfig {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  triggerHints: string[];
  instructionPrompt: string;
  requiredToolRefs: SkillToolRef[];
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  invocationMode: SkillInvocationMode;
  includeHistory: boolean;
  historyMessageCount?: number | null;
  modelOverride?: string | null;
  providerOverride?: string | null;
  category?: string | null;
  visibility: SkillVisibility;
  embedding?: number[] | null;
  packInstallId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSkillDto {
  name: string;
  description?: string;
  triggerHints?: string[];
  instructionPrompt: string;
  requiredToolRefs?: SkillToolRef[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  invocationMode?: SkillInvocationMode;
  includeHistory?: boolean;
  historyMessageCount?: number;
  modelOverride?: string;
  providerOverride?: string;
  category?: string;
  visibility?: SkillVisibility;
}

export interface UpdateSkillDto extends Partial<CreateSkillDto> {
  id: string;
}

export interface SkillMatchResult {
  skill: SkillConfig;
  similarity: number;
  source: 'pinned' | 'keyword' | 'semantic';
}

export interface TestMatchRequest {
  message: string;
  agentId?: string;
  topK?: number;
}

export interface TestMatchResponse {
  matches: SkillMatchResult[];
  embeddingTimeMs: number;
  searchTimeMs: number;
}
