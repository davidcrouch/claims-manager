/** Display names for built-in system agent roles (mirrors API agent-roles). */
export const SYSTEM_AGENT_LABELS: Record<string, string> = {
  'document-classifier': 'Document Classifier',
  'category-description-gen': 'Category Description Generator',
};

export function agentDisplayName(agentId: string): string {
  if (SYSTEM_AGENT_LABELS[agentId]) return SYSTEM_AGENT_LABELS[agentId];
  return agentId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
