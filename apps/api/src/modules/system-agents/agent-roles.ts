/** Built-in system agent role strings stored on pipeline steps. */
export const AgentRole = {
  DOCUMENT_CLASSIFIER: 'document-classifier',
  CATEGORY_DESCRIPTION_GEN: 'category-description-gen',
} as const;

export type AgentRoleValue = (typeof AgentRole)[keyof typeof AgentRole];
