-- 0037: AI Scheduled Tasks
CREATE TABLE IF NOT EXISTS "ai_scheduled_task" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "schedule_type" text NOT NULL DEFAULT 'cron',
  "cron_expression" text,
  "run_at" timestamptz,
  "agent_id" uuid REFERENCES "agent"("id"),
  "conversation_id" uuid REFERENCES "chat_conversation"("id"),
  "prompt" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamptz,
  "next_run_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_scheduled_task_tenant_user_idx" ON "ai_scheduled_task" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "ai_scheduled_task_next_run_idx" ON "ai_scheduled_task" ("enabled", "next_run_at");
