ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_quote_group_id_quote_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_items" DROP CONSTRAINT "quote_items_quote_combo_id_quote_combos_id_fk";
--> statement-breakpoint
ALTER TABLE "quote_combos" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "external_reference" text;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "quote_combos" ADD CONSTRAINT "quote_combos_line_scope_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("line_scope_status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_groups" ADD CONSTRAINT "quote_groups_group_label_lookup_id_lookup_values_id_fk" FOREIGN KEY ("group_label_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_line_scope_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("line_scope_status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_unit_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("unit_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_group_id_quote_groups_id_fk" FOREIGN KEY ("quote_group_id") REFERENCES "public"."quote_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_combo_id_quote_combos_id_fk" FOREIGN KEY ("quote_combo_id") REFERENCES "public"."quote_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_status_lookup_id_lookup_values_id_fk" FOREIGN KEY ("status_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_quote_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("quote_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_quote_combos_parent_extref" ON "quote_combos" USING btree ("quote_group_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_quote_combos_group" ON "quote_combos" USING btree ("tenant_id","quote_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_quote_groups_parent_extref" ON "quote_groups" USING btree ("quote_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_quote_groups_quote" ON "quote_groups" USING btree ("tenant_id","quote_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_quote_items_group_extref" ON "quote_items" USING btree ("quote_group_id","external_reference");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_quote_items_combo_extref" ON "quote_items" USING btree ("quote_combo_id","external_reference");--> statement-breakpoint
CREATE INDEX "idx_quote_items_group" ON "quote_items" USING btree ("tenant_id","quote_group_id");--> statement-breakpoint
CREATE INDEX "idx_quote_items_combo" ON "quote_items" USING btree ("tenant_id","quote_combo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_quotes_tenant_extref" ON "quotes" USING btree ("tenant_id","external_reference");