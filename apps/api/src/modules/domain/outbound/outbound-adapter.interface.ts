export interface OutboundProgressUpdate {
  result: OutboundPushResult;
  nextPayload: Record<string, unknown>;
}

/** Thrown when a later step fails after an earlier step already succeeded. */
export class OutboundPartialSuccessError extends Error {
  readonly progress: OutboundProgressUpdate;

  constructor(params: { message: string; progress: OutboundProgressUpdate }) {
    super(params.message);
    this.name = 'OutboundPartialSuccessError';
    this.progress = params.progress;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface OutboundAdapterPushParams {
  connectionId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
  /**
   * Persist a completed sub-step (e.g. CW quote create) before a later
   * request so retries skip work that already succeeded.
   */
  persistProgress?: (update: OutboundProgressUpdate) => Promise<void>;
}

export interface OutboundPushResult {
  externalReference?: string | null;
  responsePayload?: Record<string, unknown>;
}

export interface OutboundAdapter {
  push(params: OutboundAdapterPushParams): Promise<OutboundPushResult>;
}
