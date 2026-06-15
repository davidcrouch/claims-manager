export interface OutboundAdapterPushParams {
  connectionId: string;
  entityType: string;
  entityId: string;
  action: string;
  payload: Record<string, unknown>;
}

export interface OutboundAdapter {
  push(params: OutboundAdapterPushParams): Promise<void>;
}
