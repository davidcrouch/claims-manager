-- Replace UUID-valued catalog_items.code with slugified name.
-- Only targets rows where code equals external_reference (the CW import fallback pattern).
-- external_reference is NOT modified — the CW UUID stays intact.

DO $$
DECLARE
  r RECORD;
  base_slug TEXT;
  candidate TEXT;
  suffix INT;
  done BOOLEAN;
BEGIN
  FOR r IN
    SELECT id, tenant_id, catalog_id, name, code
    FROM catalog_items
    WHERE code ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND external_reference = code
    ORDER BY tenant_id, catalog_id, name
  LOOP
    base_slug := UPPER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM(r.name), '[^A-Za-z0-9]+', '-', 'g'),
        '^-|-$', '', 'g'
      )
    );
    IF base_slug = '' THEN
      base_slug := 'ITEM';
    END IF;
    base_slug := LEFT(base_slug, 80);

    candidate := base_slug;
    suffix := 2;
    done := FALSE;

    WHILE NOT done LOOP
      IF NOT EXISTS (
        SELECT 1 FROM catalog_items
        WHERE tenant_id = r.tenant_id
          AND catalog_id = r.catalog_id
          AND code = candidate
          AND id != r.id
          AND deleted_at IS NULL
      ) THEN
        done := TRUE;
      ELSE
        candidate := base_slug || '-' || suffix;
        suffix := suffix + 1;
        IF suffix > 1000 THEN
          candidate := base_slug || '-' || r.id;
          done := TRUE;
        END IF;
      END IF;
    END LOOP;

    UPDATE catalog_items
    SET code = candidate, updated_at = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;
