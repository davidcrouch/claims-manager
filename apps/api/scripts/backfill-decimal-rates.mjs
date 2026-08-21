/**
 * Convert percentage-point tax/markup values to decimal rates.
 *   10  → 0.10   (GST)
 *   19  → 0.19   (percent markup)
 * Values already <= 1 are left unchanged.
 *
 * Usage (from apps/api): node scripts/backfill-decimal-rates.mjs
 * Safe to re-run (idempotent).
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
const PREFIX = 'backfill-decimal-rates';

if (!DATABASE_URL) {
  console.error(`[${PREFIX}] DATABASE_URL is required`);
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

const LINE_TABLES = [
  'quote_items',
  'purchase_order_items',
  'work_order_items',
  'rfq_items',
  'proposal_items',
];

try {
  // Catalog items: tax_rate + percent markup_value
  const catTax = await pool.query(`
    UPDATE catalog_items
    SET tax_rate = tax_rate / 100, updated_at = NOW()
    WHERE deleted_at IS NULL
      AND tax_rate IS NOT NULL
      AND tax_rate > 1
  `);
  console.log(`[${PREFIX}] catalog_items.tax_rate: ${catTax.rowCount}`);

  const catMk = await pool.query(`
    UPDATE catalog_items
    SET markup_value = markup_value / 100, updated_at = NOW()
    WHERE deleted_at IS NULL
      AND markup_value IS NOT NULL
      AND markup_value > 1
      AND lower(coalesce(markup_type, 'percent')) IN ('percent', 'percentage')
  `);
  console.log(`[${PREFIX}] catalog_items.markup_value: ${catMk.rowCount}`);

  for (const table of LINE_TABLES) {
    const hasDeletedAt = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'deleted_at'`,
      [table],
    );
    const deletedClause = hasDeletedAt.rowCount ? 'deleted_at IS NULL AND' : '';

    const tax = await pool.query(`
      UPDATE ${table}
      SET tax = tax / 100, updated_at = NOW()
      WHERE ${deletedClause}
        tax IS NOT NULL
        AND tax > 1
    `);
    console.log(`[${PREFIX}] ${table}.tax: ${tax.rowCount}`);

    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = $1 AND column_name IN ('markup_value', 'markup_type')`,
      [table],
    );
    const names = new Set(cols.rows.map((r) => r.column_name));
    if (names.has('markup_value') && names.has('markup_type')) {
      const mk = await pool.query(`
        UPDATE ${table}
        SET markup_value = markup_value / 100, updated_at = NOW()
        WHERE ${deletedClause}
          markup_value IS NOT NULL
          AND markup_value > 1
          AND lower(coalesce(markup_type, 'percent')) IN ('percent', 'percentage')
      `);
      console.log(`[${PREFIX}] ${table}.markup_value: ${mk.rowCount}`);
    }
  }

  const verify = await pool.query(`
    SELECT 'catalog' AS src, tax_rate::text AS tax, markup_value::text AS mk, COUNT(*)::int AS n
    FROM catalog_items WHERE deleted_at IS NULL
    GROUP BY 2, 3
    ORDER BY n DESC LIMIT 5
  `);
  console.log(`[${PREFIX}] catalog sample:`, verify.rows);

  const q = await pool.query(`
    SELECT tax::text, COUNT(*)::int AS n
    FROM quote_items WHERE deleted_at IS NULL
    GROUP BY 1 ORDER BY n DESC LIMIT 5
  `);
  console.log(`[${PREFIX}] quote_items.tax:`, q.rows);
} finally {
  await pool.end();
}
