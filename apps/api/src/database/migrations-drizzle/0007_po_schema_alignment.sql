ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_purchase_order_group_id_purchase_order_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_items" DROP CONSTRAINT "purchase_order_items_purchase_order_combo_id_purchase_order_combos_id_fk";
--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_combos" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_groups" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_group_id_purchase_order_groups_id_fk" FOREIGN KEY ("purchase_order_group_id") REFERENCES "public"."purchase_order_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_combo_id_purchase_order_combos_id_fk" FOREIGN KEY ("purchase_order_combo_id") REFERENCES "public"."purchase_order_combos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_po_combos_group" ON "purchase_order_combos" USING btree ("tenant_id","purchase_order_group_id");--> statement-breakpoint
CREATE INDEX "idx_po_groups_po" ON "purchase_order_groups" USING btree ("tenant_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "idx_po_items_group" ON "purchase_order_items" USING btree ("tenant_id","purchase_order_group_id");--> statement-breakpoint
CREATE INDEX "idx_po_items_combo" ON "purchase_order_items" USING btree ("tenant_id","purchase_order_combo_id");--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_purchase_orders_tenant_external_id" ON "purchase_orders" USING btree ("tenant_id","external_id") WHERE external_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "UQ_purchase_orders_tenant_po_number" ON "purchase_orders" USING btree ("tenant_id","purchase_order_number") WHERE purchase_order_number IS NOT NULL;