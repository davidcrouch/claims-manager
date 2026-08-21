/**
 * Hard-delete ALL catalogues and their items/BOMs so fresh catalogues can be imported.
 *
 * Clears: catalog_assembly_components, catalog_items, catalogs
 * Keeps: catalog_categories, catalog_item_types (seeded basics)
 * Unlinks: quote/PO/WO item+combo catalog_*_id FKs (set NULL)
 *
 * Usage (from apps/api): node scripts/wipe-all-catalogs.mjs
 */
import pg from 'pg';

const pool = new pg.Pool({
  host: 'localhost',
  port: 3210,
  user: 'more0ai',
  password: 'password',
  database: 'claims_manager',
});

const PREFIX = 'wipe-all-catalogs';

async function count(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS n FROM ${table}`);
  return rows[0].n;
}

async function main() {
  const client = await pool.connect();
  try {
    const before = {
      catalogs: await count(client, 'catalogs'),
      items: await count(client, 'catalog_items'),
      bom: await count(client, 'catalog_assembly_components'),
      categories: await count(client, 'catalog_categories'),
      types: await count(client, 'catalog_item_types'),
    };
    console.log(`[${PREFIX}] before:`, before);

    await client.query('BEGIN');

    const unlinkTables = [
      ['quote_items', 'catalog_item_id'],
      ['quote_combos', 'catalog_combo_id'],
      ['purchase_order_items', 'catalog_item_id'],
      ['purchase_order_combos', 'catalog_combo_id'],
      ['work_order_items', 'catalog_item_id'],
      ['work_order_combos', 'catalog_combo_id'],
    ];
    for (const [table, col] of unlinkTables) {
      const r = await client.query(
        `UPDATE ${table} SET ${col} = NULL WHERE ${col} IS NOT NULL`,
      );
      console.log(`[${PREFIX}] unlinked ${r.rowCount} rows in ${table}.${col}`);
    }

    // FK-safe order — do NOT touch categories or item types
    const delBom = await client.query('DELETE FROM catalog_assembly_components');
    console.log(`[${PREFIX}] deleted ${delBom.rowCount} BOM rows`);

    const delItems = await client.query('DELETE FROM catalog_items');
    console.log(`[${PREFIX}] deleted ${delItems.rowCount} catalog items`);

    const delCatalogs = await client.query('DELETE FROM catalogs');
    console.log(`[${PREFIX}] deleted ${delCatalogs.rowCount} catalogs`);

    await client.query('COMMIT');

    const after = {
      catalogs: await count(client, 'catalogs'),
      items: await count(client, 'catalog_items'),
      bom: await count(client, 'catalog_assembly_components'),
      categories: await count(client, 'catalog_categories'),
      types: await count(client, 'catalog_item_types'),
    };
    console.log(`[${PREFIX}] after:`, after);
    console.log(`[${PREFIX}] done (categories=${after.categories}, types=${after.types} kept)`);
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`[${PREFIX}] FAILED:`, e.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
