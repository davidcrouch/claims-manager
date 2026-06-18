-- Record which provider connection created a job (null for direct-to-customer)
ALTER TABLE "jobs" ADD COLUMN "connection_id" uuid REFERENCES "integration_connections"("id");
--> statement-breakpoint
CREATE INDEX "idx_jobs_connection" ON "jobs" ("connection_id");
