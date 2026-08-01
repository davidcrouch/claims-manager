CREATE TABLE "catalog_item_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_category_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"type_id" uuid NOT NULL,
	"category_id" uuid,
	"sub_category_id" uuid,
	"unit_type_lookup_id" uuid,
	"unit_cost" numeric(14, 4),
	"buy_cost" numeric(14, 4),
	"markup_type" text,
	"markup_value" numeric(14, 4),
	"tax_rate" numeric(14, 4),
	"pricing_mode" text,
	"fixed_unit_cost" numeric(14, 4),
	"computed_unit_cost" numeric(14, 4),
	"computed_cost_at" timestamp with time zone,
	"external_reference" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_catalog_items_kind" CHECK (kind IN ('primitive', 'assembly')),
	CONSTRAINT "chk_catalog_items_primitive_unit" CHECK (kind = 'assembly' OR unit_type_lookup_id IS NOT NULL),
	CONSTRAINT "chk_catalog_items_assembly_pricing" CHECK (kind = 'primitive' OR pricing_mode IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "catalog_assembly_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"assembly_id" uuid NOT NULL,
	"component_id" uuid NOT NULL,
	"quantity" numeric(14, 4) DEFAULT '1' NOT NULL,
	"waste_factor" numeric(8, 4) DEFAULT '1' NOT NULL,
	"sort_index" integer DEFAULT 0 NOT NULL,
	"is_optional" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_bom_no_self_ref" CHECK (assembly_id != component_id)
);
--> statement-breakpoint
ALTER TABLE "catalog_item_types" ADD CONSTRAINT "catalog_item_types_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_parent_category_id_catalog_categories_id_fk" FOREIGN KEY ("parent_category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_type_id_catalog_item_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."catalog_item_types"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_category_id_catalog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_sub_category_id_catalog_categories_id_fk" FOREIGN KEY ("sub_category_id") REFERENCES "public"."catalog_categories"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_unit_type_lookup_id_lookup_values_id_fk" FOREIGN KEY ("unit_type_lookup_id") REFERENCES "public"."lookup_values"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_assembly_components" ADD CONSTRAINT "catalog_assembly_components_tenant_id_organizations_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE cascade;
--> statement-breakpoint
ALTER TABLE "catalog_assembly_components" ADD CONSTRAINT "catalog_assembly_components_assembly_id_catalog_items_id_fk" FOREIGN KEY ("assembly_id") REFERENCES "public"."catalog_items"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_assembly_components" ADD CONSTRAINT "catalog_assembly_components_component_id_catalog_items_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."catalog_items"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_catalog_item_types_tenant_code" ON "catalog_item_types" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX "idx_catalog_item_types_tenant" ON "catalog_item_types" USING btree ("tenant_id","is_active");
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_catalog_categories_tenant_parent_code" ON "catalog_categories" USING btree ("tenant_id","parent_category_id","code");
--> statement-breakpoint
CREATE INDEX "idx_catalog_categories_tenant" ON "catalog_categories" USING btree ("tenant_id","is_active");
--> statement-breakpoint
CREATE INDEX "idx_catalog_categories_parent" ON "catalog_categories" USING btree ("tenant_id","parent_category_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_catalog_items_tenant_code" ON "catalog_items" USING btree ("tenant_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_catalog_items_tenant_extref" ON "catalog_items" USING btree ("tenant_id","external_reference") WHERE external_reference IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_catalog_items_tenant" ON "catalog_items" USING btree ("tenant_id","is_active","deleted_at");
--> statement-breakpoint
CREATE INDEX "idx_catalog_items_type" ON "catalog_items" USING btree ("tenant_id","type_id");
--> statement-breakpoint
CREATE INDEX "idx_catalog_items_category" ON "catalog_items" USING btree ("tenant_id","category_id");
--> statement-breakpoint
CREATE INDEX "idx_catalog_items_kind" ON "catalog_items" USING btree ("tenant_id","kind");
--> statement-breakpoint
CREATE INDEX "idx_catalog_bom_assembly" ON "catalog_assembly_components" USING btree ("tenant_id","assembly_id");
--> statement-breakpoint
CREATE INDEX "idx_catalog_bom_component" ON "catalog_assembly_components" USING btree ("tenant_id","component_id");
--> statement-breakpoint
ALTER TABLE "quote_combos" ADD CONSTRAINT "quote_combos_catalog_combo_id_catalog_items_id_fk" FOREIGN KEY ("catalog_combo_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ADD CONSTRAINT "purchase_order_combos_catalog_combo_id_catalog_items_id_fk" FOREIGN KEY ("catalog_combo_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_order_combos" ADD CONSTRAINT "work_order_combos_catalog_combo_id_catalog_items_id_fk" FOREIGN KEY ("catalog_combo_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "work_order_items" ADD CONSTRAINT "work_order_items_catalog_item_id_catalog_items_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "public"."catalog_items"("id") ON DELETE set null ON UPDATE no action;
