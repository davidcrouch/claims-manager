import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Subset of claims_manager tables used by provider-server ingest.
 * Migrations remain owned by apps/api. FK targets are uuid columns only
 * (no drizzle .references) so this package stays self-contained.
 */

export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    providerCode: text('provider_code').notNull(),
    name: text('name').notNull().default(''),
    environment: text('environment').notNull(),
    authType: text('auth_type').notNull().default('client_credentials'),
    baseUrl: text('base_url').notNull(),
    clientIdentifier: text('client_identifier'),
    providerTenantId: text('provider_tenant_id'),
    credentials: jsonb('credentials').notNull().default({}),
    webhookSecret: text('webhook_secret'),
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_connections_provider_code').on(t.providerCode),
  ],
);

export const inboundWebhookEvents = pgTable(
  'inbound_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalEventId: text('external_event_id').notNull().unique(),
    tenantId: uuid('tenant_id'),
    eventType: text('event_type').notNull(),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    payloadEntityId: text('payload_entity_id'),
    payloadTeamIds: jsonb('payload_team_ids').notNull().default([]),
    payloadTenantId: text('payload_tenant_id'),
    payloadClient: text('payload_client'),
    payloadProjectExternalReference: text('payload_project_external_reference'),
    signatureHeader: text('signature_header'),
    hmacVerified: boolean('hmac_verified'),
    rawHeaders: jsonb('raw_headers').notNull().default({}),
    rawBodyText: text('raw_body_text').notNull(),
    rawBodyJson: jsonb('raw_body_json'),
    processingStatus: text('processing_status').notNull().default('pending'),
    processingError: text('processing_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    connectionId: uuid('connection_id'),
    providerCode: text('provider_code'),
    providerEntityType: text('provider_entity_type'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_webhooks_status').on(t.processingStatus, t.createdAt),
    uniqueIndex('inbound_webhook_events_external_event_id_key').on(t.externalEventId),
  ],
);

export const externalProcessingLog = pgTable(
  'external_processing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    connectionId: uuid('connection_id'),
    eventId: uuid('event_id'),
    workflowRunId: text('workflow_run_id'),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull().default('pending'),
    externalObjectId: uuid('external_object_id'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_processing_log_status').on(t.status, t.createdAt)],
);
