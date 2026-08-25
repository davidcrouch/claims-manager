-- Backfill tasks.task_type from stored Crunchwork payload (taskType.name).
UPDATE "tasks"
SET "task_type" = btrim("task_payload"->'taskType'->>'name')
WHERE ("task_type" IS NULL OR btrim("task_type") = '')
  AND "task_payload" ? 'taskType'
  AND jsonb_typeof("task_payload"->'taskType') = 'object'
  AND btrim(coalesce("task_payload"->'taskType'->>'name', '')) <> '';
--> statement-breakpoint
DROP TABLE IF EXISTS "task_type_mappings";
