import { AgentRole } from './agent-roles';
import type { SystemAgentDefinition } from './providers/types';

const DEFAULT_MODEL = process.env.VERTEX_GEMINI_MODEL || 'gemini-2.5-flash';

export const SYSTEM_AGENTS: Record<string, SystemAgentDefinition> = {
  [AgentRole.DOCUMENT_CLASSIFIER]: {
    id: AgentRole.DOCUMENT_CLASSIFIER,
    role: AgentRole.DOCUMENT_CLASSIFIER,
    name: 'Document Classifier',
    systemPrompt:
      'You classify uploaded construction/insurance claims documents into a filesystem category tree. ' +
      'Always call get_document_info and list_filesystem_categories first. ' +
      'Then call assign_document_category with the best matching slug and a confidence score. ' +
      'Use category descriptions carefully — respect "Do NOT file" guidance. ' +
      'If no category fits well, assign to OTHER with low confidence.',
    model: DEFAULT_MODEL,
    temperature: 0.1,
    maxTokens: 2048,
    maxSteps: 6,
  },
  [AgentRole.CATEGORY_DESCRIPTION_GEN]: {
    id: AgentRole.CATEGORY_DESCRIPTION_GEN,
    role: AgentRole.CATEGORY_DESCRIPTION_GEN,
    name: 'Category Description Generator',
    systemPrompt:
      'You write clear filing descriptions for document categories in a construction/insurance claims document filesystem. ' +
      'Include what belongs in the category and what should NOT be filed there (pointing to sibling categories when relevant). ' +
      'Return only the description text, no markdown headings.',
    model: DEFAULT_MODEL,
    temperature: 0.4,
    maxTokens: 1024,
    maxSteps: 1,
  },
};

export function resolveSystemAgent(roleOrId: string): SystemAgentDefinition | null {
  return SYSTEM_AGENTS[roleOrId] ?? null;
}
