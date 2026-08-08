-- 0029: Add channel discriminator to outbound_sync_queue for Pub/Sub support
-- Makes connectionId nullable (Pub/Sub rows don't need an integration connection)

ALTER TABLE outbound_sync_queue ALTER COLUMN connection_id DROP NOT NULL;
--> statement-breakpoint

ALTER TABLE outbound_sync_queue ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'integration';
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE outbound_sync_queue ADD CONSTRAINT chk_outbound_channel
    CHECK (channel IN ('integration', 'pubsub'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS idx_outbound_channel_poll
  ON outbound_sync_queue (channel, status, scheduled_at)
  WHERE status = 'pending';
