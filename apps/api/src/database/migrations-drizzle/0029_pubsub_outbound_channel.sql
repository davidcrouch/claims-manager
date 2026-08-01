-- 0029: Add channel discriminator to outbound_sync_queue for Pub/Sub support
-- Makes connectionId nullable (Pub/Sub rows don't need an integration connection)

ALTER TABLE outbound_sync_queue ALTER COLUMN connection_id DROP NOT NULL;

ALTER TABLE outbound_sync_queue ADD COLUMN channel TEXT NOT NULL DEFAULT 'integration';

ALTER TABLE outbound_sync_queue ADD CONSTRAINT chk_outbound_channel
  CHECK (channel IN ('integration', 'pubsub'));

CREATE INDEX idx_outbound_channel_poll
  ON outbound_sync_queue (channel, status, scheduled_at)
  WHERE status = 'pending';
