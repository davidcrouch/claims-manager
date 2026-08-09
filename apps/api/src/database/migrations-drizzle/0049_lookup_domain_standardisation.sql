-- 0049: Consolidate lookup domains
-- po_status → purchase_order_status
-- wo_status → work_order_status
-- Greenfield app: safe to delete old domain rows outright after remapping FKs.

-- Step 1: Remap po_status → purchase_order_status
-- For each po_status lookup, find or create the equivalent purchase_order_status row,
-- then point any entities still referencing the old lookup ID to the new one.

DO $$
DECLARE
  r RECORD;
  target_id UUID;
BEGIN
  FOR r IN
    SELECT id, tenant_id, name, external_reference
    FROM lookup_values
    WHERE domain = 'po_status'
  LOOP
    -- Try to find an existing purchase_order_status row with same external_reference in same tenant
    SELECT id INTO target_id
    FROM lookup_values
    WHERE tenant_id = r.tenant_id
      AND domain = 'purchase_order_status'
      AND external_reference = r.external_reference
    LIMIT 1;

    IF target_id IS NULL THEN
      -- Create the purchase_order_status equivalent
      INSERT INTO lookup_values (tenant_id, domain, name, external_reference)
      VALUES (r.tenant_id, 'purchase_order_status', r.name, r.external_reference)
      RETURNING id INTO target_id;
    END IF;

    -- Remap any purchase_orders referencing the old lookup
    UPDATE purchase_orders
    SET status_lookup_id = target_id
    WHERE status_lookup_id = r.id;
  END LOOP;

  -- Remove old po_status rows
  DELETE FROM lookup_values WHERE domain = 'po_status';
END $$;

-- Step 2: Remap wo_status → work_order_status (same pattern)

DO $$
DECLARE
  r RECORD;
  target_id UUID;
BEGIN
  FOR r IN
    SELECT id, tenant_id, name, external_reference
    FROM lookup_values
    WHERE domain = 'wo_status'
  LOOP
    SELECT id INTO target_id
    FROM lookup_values
    WHERE tenant_id = r.tenant_id
      AND domain = 'work_order_status'
      AND external_reference = r.external_reference
    LIMIT 1;

    IF target_id IS NULL THEN
      INSERT INTO lookup_values (tenant_id, domain, name, external_reference)
      VALUES (r.tenant_id, 'work_order_status', r.name, r.external_reference)
      RETURNING id INTO target_id;
    END IF;

    UPDATE work_orders
    SET status_lookup_id = target_id
    WHERE status_lookup_id = r.id;
  END LOOP;

  DELETE FROM lookup_values WHERE domain = 'wo_status';
END $$;
