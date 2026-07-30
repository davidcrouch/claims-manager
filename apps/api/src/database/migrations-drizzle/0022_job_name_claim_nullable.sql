-- Optional job display name, and allow internal jobs without a linked claim.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "name" text;
ALTER TABLE "jobs" ALTER COLUMN "claim_id" DROP NOT NULL;
