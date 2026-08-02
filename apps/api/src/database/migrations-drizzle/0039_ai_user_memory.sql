-- 0036: AI User Memory enhancements (add scope_id, change default scope)
ALTER TABLE "ai_user_memory" ADD COLUMN IF NOT EXISTS "scope_id" text;
ALTER TABLE "ai_user_memory" ALTER COLUMN "scope" SET DEFAULT 'global';
