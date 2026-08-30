import { z } from 'zod';

export const packFileRefSchema = z.object({
  file: z.string().min(1),
});

export const packManifestSchema = z.object({
  id: z.string().min(1),
  version: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional().default(''),
  integrationRefs: z.array(z.string()).default([]),
  agents: z.array(packFileRefSchema).default([]),
  skills: z.array(packFileRefSchema).default([]),
  prompts: z.array(packFileRefSchema).default([]),
});

export type PackManifest = z.infer<typeof packManifestSchema>;

export const packAgentSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['chat', 'system']).default('chat'),
  chatEnabled: z.boolean().default(true),
  provider: z.string().default('vertex-gemini'),
  model: z.string().default('gemini-2.5-flash'),
  temperature: z.number().default(0.7),
  maxTokens: z.number().int().positive().default(8192),
  systemPrompt: z.string().min(1),
  visibility: z.enum(['public', 'org', 'private']).default('org'),
  integrationRefs: z.array(z.string()).default([]),
  /** Tool names or trailing globs like `search_*` relative to resolved connections. */
  enabledTools: z.array(z.string()).default([]),
  pinnedSkillSlugs: z.array(z.string()).default([]),
  semanticSkills: z.enum(['all', 'none', 'pinned_only']).default('all'),
  supportsVision: z.boolean().default(false),
  maxSteps: z.number().int().positive().default(10),
  autonomousMode: z.boolean().default(false),
  pauseAfterToolSteps: z.number().int().positive().default(4),
  maxDurationSeconds: z.number().int().positive().default(120),
  isDefault: z.boolean().default(false),
});

export type PackAgent = z.infer<typeof packAgentSchema>;

export const packSkillSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  triggerHints: z.array(z.string()).default([]),
  instructionPrompt: z.string().min(1),
  requiredToolRefs: z
    .array(
      z.object({
        integration: z.string(),
        tool: z.string(),
      }),
    )
    .default([]),
  invocationMode: z.enum(['inline', 'isolated']).default('inline'),
  includeHistory: z.boolean().default(false),
  historyMessageCount: z.number().int().positive().optional(),
  category: z.string().default('general'),
  visibility: z.enum(['public', 'org', 'private']).default('org'),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
});

export type PackSkill = z.infer<typeof packSkillSchema>;

export const packPromptSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  templateText: z.string().min(1),
  variables: z.array(z.unknown()).default([]),
  category: z.string().default('general'),
});

export type PackPrompt = z.infer<typeof packPromptSchema>;

/** In-memory resolved pack ready to install. */
export interface ResolvedPack {
  source: 'builtin' | 'upload';
  uploadId?: string;
  rootDir?: string;
  manifest: PackManifest;
  agents: Array<{ key: string; hash: string; data: PackAgent; raw: string }>;
  skills: Array<{ key: string; hash: string; data: PackSkill; raw: string }>;
  prompts: Array<{ key: string; hash: string; data: PackPrompt; raw: string }>;
}

export interface PackCatalogEntry {
  packId: string;
  version: string;
  name: string;
  description: string;
  source: 'builtin' | 'upload';
  uploadId?: string;
  integrationRefs: string[];
  agentCount: number;
  skillCount: number;
  promptCount: number;
  installed?: {
    installId: string;
    version: string;
    status: string;
  } | null;
}

export interface PackDriftItem {
  artefactType: 'agent' | 'skill' | 'prompt_template';
  artefactId: string;
  sourceKey: string | null;
  status: 'match' | 'modified' | 'missing' | 'orphan';
  expectedHash: string | null;
  actualHash: string | null;
}

export interface InstallPackDto {
  packId?: string;
  version?: string;
  uploadId?: string;
}

/** Lightweight preview for admin UI before install. */
export interface PackPreview {
  packId: string;
  version: string;
  name: string;
  description: string;
  source: 'builtin' | 'upload';
  uploadId?: string;
  integrationRefs: string[];
  agents: Array<{
    slug: string;
    name: string;
    description?: string;
    enabledTools: string[];
    pinnedSkillSlugs: string[];
    integrationRefs: string[];
  }>;
  skills: Array<{
    slug: string;
    name: string;
    description?: string;
    category: string;
    triggerHints: string[];
    requiredTools: string[];
  }>;
  prompts: Array<{
    slug: string;
    name: string;
    description?: string;
    category: string;
  }>;
}
