/**
 * Set markup=19% and GST/tax=10% on every catalogue item.
 *
 * Usage (from apps/api): node scripts/backfill-catalog-markup-gst.mjs
 * Safe to re-run (idempotent).
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const PREFIX = 'backfill-catalog-markup-gst';

if (!DATABASE_URL) {
  console.error(`[${PREFIX}] DATABASE_URL is required`);
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

try {
  const before = await pool.query(`
    SELECT COUNT(*)::int AS total
    FROM catalog_items
    WHERE deleted_at IS NULL
      AND (
        markup_type IS DISTINCT FROM 'percent'
        OR markup_value::numeric IS DISTINCT FROM 19
        OR tax_rate::numeric IS DISTINCT FROM 10
      )
  `);
  console.log(`[${PREFIX}] items needing update: ${before.rows[0].total}`);

  const result = await pool.query(`
    UPDATE catalog_items
    SET
      markup_type = 'percent',
      markup_value = 19,
      tax_rate = 10,
      updated_at = NOW()
    WHERE deleted_at IS NULL
      AND (
        markup_type IS DISTINCT FROM 'percent'
        OR markup_value::numeric IS DISTINCT FROM 19
        OR tax_rate::numeric IS DISTINCT FROM 10
      )
  `);
  console.log(`[${PREFIX}] updated rows: ${result.rowCount}`);

  const byCatalog = await pool.query(`
    SELECT c.name, c.type, COUNT(i.id)::int AS items
    FROM catalogs c
    LEFT JOIN catalog_items i
      ON i.catalog_id = c.id AND i.deleted_at IS NULL
    GROUP BY c.id, c.name, c.type
    ORDER BY c.name, c.type
  `);
  console.log(`[${PREFIX}] per-catalogue counts:`, byCatalog.rows);

  const verify = await pool.query(`
    SELECT markup_type, markup_value, tax_rate, COUNT(*)::int AS n
    FROM catalog_items
    WHERE deleted_at IS NULL
    GROUP BY 1, 2, 3
    ORDER BY n DESC
  `);
  console.log(`[${PREFIX}] distribution after:`, verify.rows);
} finally {
  await pool.end();
}
