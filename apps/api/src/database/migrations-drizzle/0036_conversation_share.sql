CREATE TABLE IF NOT EXISTS "conversation_share" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL REFERENCES "chat_conversation"("id") ON DELETE CASCADE,
  "created_by" uuid NOT NULL,
  "share_token" text NOT NULL,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "conversation_share_token_idx" ON "conversation_share" ("share_token");
CREATE INDEX IF NOT EXISTS "conversation_share_conversation_idx" ON "conversation_share" ("conversation_id");
