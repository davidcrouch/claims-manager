CREATE TABLE IF NOT EXISTS "tenant_record_sequences" (
  "tenant_id" uuid NOT NULL,
  "sequence_key" text NOT NULL,
  "next_value" integer NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_record_sequences_pkey" PRIMARY KEY ("tenant_id", "sequence_key")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenant_record_sequences"
    ADD CONSTRAINT "tenant_record_sequences_tenant_id_organizations_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id")
    ON DELETE cascade ON UPDATE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "tenant_record_sequences" ("tenant_id", "sequence_key", "next_value")
SELECT
  r."tenant_id",
  'rfq',
  GREATEST(
    COALESCE(
      MAX(
        CASE
          WHEN r."rfq_number" ~* '^rfq-[0-9]+$'
            THEN (substring(r."rfq_number" from '[0-9]+$'))::integer + 1
          ELSE NULL
        END
      ),
      200001
    ),
    200001
  )
FROM "rfqs" r
WHERE r."deleted_at" IS NULL
  AND r."rfq_number" IS NOT NULL
GROUP BY r."tenant_id"
ON CONFLICT ("tenant_id", "sequence_key") DO NOTHING;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_rfqs_tenant_number"
  ON "rfqs" USING btree ("tenant_id", "rfq_number")
  WHERE rfq_number IS NOT NULL AND deleted_at IS NULL;
