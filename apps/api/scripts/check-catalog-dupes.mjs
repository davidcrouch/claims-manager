import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { Pool } = require('pg');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env');
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^DATABASE_URL=(.*)$/);
  if (m) {
    process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
    break;
  }
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const catalogNames = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['Ensure', 'Test1'];

try {
  for (const name of catalogNames) {
    const cat = (
      await pool.query(
        `SELECT id::text, name FROM catalogs WHERE name = $1 ORDER BY created_at DESC LIMIT 1`,
        [name],
      )
    ).rows[0];
    if (!cat) {
      console.log(`\n=== ${name}: not found ===`);
      continue;
    }
    console.log(`\n=== ${name} (${cat.id}) ===`);

    console.log(
      'kinds',
      (
        await pool.query(
          `SELECT kind, count(*)::int AS n FROM catalog_items
           WHERE catalog_id = $1::uuid AND deleted_at IS NULL GROUP BY kind`,
          [cat.id],
        )
      ).rows,
    );

    console.log(
      'duplicate codes in this catalog',
      (
        await pool.query(
          `SELECT code, count(*)::int AS n, array_agg(id::text) AS ids
           FROM catalog_items WHERE catalog_id = $1::uuid AND deleted_at IS NULL
           GROUP BY code HAVING count(*) > 1`,
          [cat.id],
        )
      ).rows,
    );

    console.log(
      'bom',
      (
        await pool.query(
          `SELECT count(*)::int AS lines,
                  count(DISTINCT component_id)::int AS distinct_children,
                  count(*) FILTER (WHERE parent.kind = 'scope')::int AS under_scope
           FROM catalog_assembly_components cac
           JOIN catalog_items parent ON parent.id = cac.assembly_id
           WHERE parent.catalog_id = $1::uuid`,
          [cat.id],
        )
      ).rows[0],
    );

    console.log(
      'primitives that are BOM children (same row, linked)',
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM catalog_items i
           WHERE i.catalog_id = $1::uuid AND i.deleted_at IS NULL AND i.kind = 'primitive'
             AND EXISTS (SELECT 1 FROM catalog_assembly_components c WHERE c.component_id = i.id)`,
          [cat.id],
        )
      ).rows[0],
    );

    console.log(
      'primitives with NO parent (true root)',
      (
        await pool.query(
          `SELECT count(*)::int AS n FROM catalog_items i
           WHERE i.catalog_id = $1::uuid AND i.deleted_at IS NULL AND i.kind = 'primitive'
             AND NOT EXISTS (SELECT 1 FROM catalog_assembly_components c WHERE c.component_id = i.id)`,
          [cat.id],
        )
      ).rows[0],
    );

    console.log(
      'duplicate BOM lines (same parent+child)',
      (
        await pool.query(
          `SELECT assembly_id::text, component_id::text, count(*)::int AS n
           FROM catalog_assembly_components cac
           JOIN catalog_items parent ON parent.id = cac.assembly_id
           WHERE parent.catalog_id = $1::uuid
           GROUP BY assembly_id, component_id HAVING count(*) > 1`,
          [cat.id],
        )
      ).rows,
    );

    console.log(
      'sample nested primitives',
      (
        await pool.query(
          `SELECT i.id::text, i.code, i.name,
                  (SELECT count(*)::int FROM catalog_assembly_components c WHERE c.component_id = i.id) AS parent_links
           FROM catalog_items i
           WHERE i.catalog_id = $1::uuid AND i.deleted_at IS NULL AND i.kind = 'primitive'
             AND EXISTS (SELECT 1 FROM catalog_assembly_components c WHERE c.component_id = i.id)
           ORDER BY i.name LIMIT 5`,
          [cat.id],
        )
      ).rows,
    );
  }
} finally {
  await pool.end();
}
