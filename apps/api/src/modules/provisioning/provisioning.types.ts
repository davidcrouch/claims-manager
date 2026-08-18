export const PROVISIONING_STATUSES = [
  'pending',
  'provisioning',
  'complete',
  'failed',
] as const;

export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];

export const PROVISIONING_STEPS = [
  'filesystem_setup',
  'upload_templates',
  'assign_document_templates',
  'seed_catalog',
  'seed_lookups',
  'seed_mcp',
] as const;

export type ProvisioningStep = (typeof PROVISIONING_STEPS)[number];

export interface ProvisioningStepStatus {
  step: ProvisioningStep;
  label: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'skipped';
  error?: string;
}

export interface ProvisioningStatusResponse {
  provisioningStatus: ProvisioningStatus;
  steps: ProvisioningStepStatus[];
  startedAt: string | null;
  completedAt: string | null;
}

export const STEP_LABELS: Record<ProvisioningStep, string> = {
  filesystem_setup: 'Setting up your document workspace',
  upload_templates: 'Installing standard templates',
  assign_document_templates: 'Configuring document generation',
  seed_catalog: 'Loading your catalogue',
  seed_lookups: 'Loading group labels',
  seed_mcp: 'Connecting AI tools',
};

export const PLATFORM_TEMPLATES_PREFIX = 'platform/templates/';
