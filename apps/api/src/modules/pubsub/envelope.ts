import { randomUUID } from 'node:crypto';

export interface DomainEventEnvelope {
  schemaVersion: '1';
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  tenantId: string;
  sourceTenantId?: string;
  targetTenantId?: string;
  occurredAt: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  traceId?: string;
}

export function buildDomainEventEnvelope(params: {
  eventType: string;
  entityType: string;
  entityId: string;
  tenantId: string;
  sourceTenantId?: string;
  targetTenantId?: string;
  idempotencyKey?: string;
  payload: Record<string, unknown>;
  traceId?: string;
}): DomainEventEnvelope {
  return {
    schemaVersion: '1',
    eventId: randomUUID(),
    eventType: params.eventType,
    entityType: params.entityType,
    entityId: params.entityId,
    tenantId: params.tenantId,
    sourceTenantId: params.sourceTenantId,
    targetTenantId: params.targetTenantId,
    occurredAt: new Date().toISOString(),
    idempotencyKey: params.idempotencyKey,
    payload: params.payload,
    traceId: params.traceId ?? randomUUID(),
  };
}

export function buildEventAttributes(envelope: DomainEventEnvelope): Record<string, string> {
  const attrs: Record<string, string> = {
    schema_version: envelope.schemaVersion,
    event_type: envelope.eventType,
    entity_type: envelope.entityType,
    entity_id: envelope.entityId,
    tenant_id: envelope.tenantId,
    occurred_at: envelope.occurredAt,
    trace_id: envelope.traceId ?? '',
  };
  if (envelope.sourceTenantId) attrs.source_tenant_id = envelope.sourceTenantId;
  if (envelope.targetTenantId) attrs.target_tenant_id = envelope.targetTenantId;
  if (envelope.idempotencyKey) attrs.idempotency_key = envelope.idempotencyKey;
  return attrs;
}
