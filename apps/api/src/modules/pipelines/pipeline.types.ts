export const MAX_PIPELINE_STEPS = 10;

export interface PipelineStepInput {
  agentId: string;
  stepOrder: number;
  config?: Record<string, unknown>;
}

export interface CreatePipelineDto {
  filesystemId?: string | null;
  categoryId?: string | null;
  name: string;
  description?: string | null;
  isActive?: boolean;
  triggerOn?: string;
  sortOrder?: number;
  steps?: PipelineStepInput[];
}

export interface UpdatePipelineDto {
  name?: string;
  description?: string | null;
  isActive?: boolean;
  triggerOn?: string;
  sortOrder?: number;
  categoryId?: string | null;
}

export interface PipelineRunMessage {
  runId: string;
  pipelineId: string;
  documentId: string;
  tenantId: string;
}
