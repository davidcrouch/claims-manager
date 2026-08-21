CREATE TABLE "entity_activities" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id"             uuid NOT NULL REFERENCES "organizations"("id")
                          ON DELETE RESTRICT ON UPDATE CASCADE,
  "entity_type"           text NOT NULL,
  "entity_id"             uuid NOT NULL,
  "action"                text NOT NULL,
  "actor_type"            text NOT NULL DEFAULT 'user',
  "actor_id"              text,
  "actor_name"            text,
  "summary"               text NOT NULL,
  "detail"                jsonb NOT NULL DEFAULT '{}',
  "related_entity_type"   text,
  "related_entity_id"     uuid,
  "source"                text DEFAULT 'internal',
  "source_event_id"       uuid,
  "created_at"            timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint

CREATE INDEX "idx_entity_activities_tenant_entity"
  ON "entity_activities" ("tenant_id", "entity_type", "entity_id", "created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_entity_activities_entity_action"
  ON "entity_activities" ("entity_id", "action");--> statement-breakpoint
CREATE INDEX "idx_entity_activities_actor"
  ON "entity_activities" ("tenant_id", "actor_type", "actor_id");
