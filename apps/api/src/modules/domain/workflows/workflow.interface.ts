import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export interface WorkflowGuard {
  name: string;
  evaluate(context: WorkflowContext): Promise<boolean>;
}

export interface OnEnterHook {
  name: string;
  execute(context: WorkflowContext): Promise<void>;
}

export interface WorkflowTransition {
  to: string;
  action: string;
  guards?: string[];
  onEnter?: string[];
}

export interface WorkflowStep {
  id: string;
  label?: string;
  transitions: WorkflowTransition[];
  isFinal?: boolean;
}

export interface WorkflowDefinition {
  entity: string;
  name: string;
  description?: string;
  initialStep: string;
  steps: WorkflowStep[];
}

export interface WorkflowContext {
  tenantId: string;
  userId: string;
  entityType: string;
  entityId: string;
  currentStep: string;
  targetStep: string;
  action: string;
  entity: Record<string, unknown>;
  tx: DrizzleDbOrTx;
}

export interface TransitionResult {
  success: boolean;
  previousStep: string;
  currentStep: string;
  failedGuards?: string[];
  error?: string;
}
