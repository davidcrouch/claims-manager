ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "autonomous_mode" boolean NOT NULL DEFAULT false;
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "pause_after_tool_steps" integer NOT NULL DEFAULT 4;
ALTER TABLE "agent" ADD COLUMN IF NOT EXISTS "max_duration_seconds" integer NOT NULL DEFAULT 120;
