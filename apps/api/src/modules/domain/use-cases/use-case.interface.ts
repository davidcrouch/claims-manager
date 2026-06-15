import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

export interface ProjectionResult {
  status: 'completed' | 'skipped';
  internalEntityId: string;
  internalEntityType: string;
  reason?: string;
}

/**
 * A projection use case handles inbound entity materialisation.
 * Called by InProcessProjectionService when a webhook delivers an external object.
 */
export interface ProjectionUseCase {
  execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult>;
}

/**
 * A command use case handles user-initiated domain operations
 * (e.g. issue document, create entity, allocate items).
 */
export interface CommandUseCase<TInput, TOutput> {
  execute(params: {
    input: TInput;
    tenantId: string;
    userId: string;
    tx: DrizzleDbOrTx;
  }): Promise<TOutput>;
}
