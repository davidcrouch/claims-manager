/**
 * Copy all quote scope/line items onto an RFQ that was created without them.
 * Usage: node scripts/backfill-rfq-scope-from-quote.mjs <rfqId>
 */
import 'dotenv/config';
import pg from 'pg';

const LOG = 'backfill-rfq-scope-from-quote';
const rfqId = process.argv[2];

if (!rfqId) {
  console.error(`[${LOG}] usage: node scripts/backfill-rfq-scope-from-quote.mjs <rfqId>`);
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const { rows: rfqs } = await client.query(
      `SELECT id, tenant_id, quote_id FROM rfqs WHERE id = $1 AND deleted_at IS NULL`,
      [rfqId],
    );
    const rfq = rfqs[0];
    if (!rfq) throw new Error(`RFQ ${rfqId} not found`);
    if (!rfq.quote_id) throw new Error(`RFQ ${rfqId} has no quote_id`);

    const existing = await client.query(
      `SELECT count(*)::int AS n FROM rfq_groups WHERE rfq_id = $1`,
      [rfqId],
    );
    if (existing.rows[0].n > 0) {
      console.log(`[${LOG}] RFQ already has ${existing.rows[0].n} groups — aborting`);
      return;
    }

    const { rows: groups } = await client.query(
      `SELECT * FROM quote_groups WHERE quote_id = $1 AND tenant_id = $2 ORDER BY sort_index`,
      [rfq.quote_id, rfq.tenant_id],
    );
    const groupIds = groups.map((g) => g.id);
    const { rows: combos } = await client.query(
      `SELECT * FROM quote_combos
       WHERE tenant_id = $1 AND quote_group_id = ANY($2::uuid[]) AND deleted_at IS NULL
       ORDER BY sort_index`,
      [rfq.tenant_id, groupIds],
    );
    const comboIds = combos.map((c) => c.id);
    const { rows: items } = await client.query(
      `SELECT * FROM quote_items
       WHERE tenant_id = $1 AND deleted_at IS NULL
         AND (quote_group_id = ANY($2::uuid[]) OR quote_combo_id = ANY($3::uuid[]))
       ORDER BY sort_index`,
      [rfq.tenant_id, groupIds, comboIds],
    );

    console.log(
      `[${LOG}] copying quote=${rfq.quote_id} groups=${groups.length} combos=${combos.length} items=${items.length}`,
    );

    let groupsCreated = 0;
    let combosCreated = 0;
    let itemsCreated = 0;

    for (const group of groups) {
      const groupCombos = combos.filter((c) => c.quote_group_id === group.id);
      const groupDirectItems = items.filter((i) => i.quote_group_id === group.id);
      if (groupCombos.length === 0 && groupDirectItems.length === 0) continue;

      const { rows: insertedGroups } = await client.query(
        `INSERT INTO rfq_groups (
           tenant_id, rfq_id, source_quote_group_id, group_label_lookup_id,
           description, note, dimensions, sort_index, totals, group_payload
         ) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9)
         RETURNING id`,
        [
          rfq.tenant_id,
          rfqId,
          group.id,
          group.group_label_lookup_id,
          group.description,
          group.dimensions ?? {},
          group.sort_index,
          group.totals ?? {},
          group.group_payload ?? {},
        ],
      );
      const rfqGroupId = insertedGroups[0].id;
      groupsCreated += 1;

      for (const item of groupDirectItems) {
        await client.query(
          `INSERT INTO rfq_items (
             tenant_id, rfq_group_id, source_quote_item_id, unit_type_lookup_id,
             name, description, category, sub_category, item_type,
             quantity, tax, unit_cost, buy_cost, sort_index, note, totals, item_payload
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
          [
            rfq.tenant_id,
            rfqGroupId,
            item.id,
            item.unit_type_lookup_id,
            item.name,
            item.description,
            item.category,
            item.sub_category,
            item.item_type,
            item.quantity,
            item.tax,
            item.unit_cost,
            item.buy_cost,
            item.sort_index,
            item.note,
            item.totals ?? {},
            item.item_payload ?? {},
          ],
        );
        itemsCreated += 1;
      }

      for (const combo of groupCombos) {
        const { rows: insertedCombos } = await client.query(
          `INSERT INTO rfq_combos (
             tenant_id, rfq_group_id, source_quote_combo_id, name, description,
             note, category, sub_category, quantity, sort_index, totals, combo_payload
           ) VALUES ($1,$2,$3,$4,$5,NULL,$6,$7,$8,$9,$10,$11)
           RETURNING id`,
          [
            rfq.tenant_id,
            rfqGroupId,
            combo.id,
            combo.name,
            combo.description,
            combo.category,
            combo.sub_category,
            combo.quantity,
            combo.sort_index,
            combo.totals ?? {},
            combo.combo_payload ?? {},
          ],
        );
        const rfqComboId = insertedCombos[0].id;
        combosCreated += 1;

        const childItems = items.filter((i) => i.quote_combo_id === combo.id);
        for (const item of childItems) {
          await client.query(
            `INSERT INTO rfq_items (
               tenant_id, rfq_combo_id, source_quote_item_id, unit_type_lookup_id,
               name, description, category, sub_category, item_type,
               quantity, tax, unit_cost, buy_cost, sort_index, note, totals, item_payload
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              rfq.tenant_id,
              rfqComboId,
              item.id,
              item.unit_type_lookup_id,
              item.name,
              item.description,
              item.category,
              item.sub_category,
              item.item_type,
              item.quantity,
              item.tax,
              item.unit_cost,
              item.buy_cost,
              item.sort_index,
              item.note,
              item.totals ?? {},
              item.item_payload ?? {},
            ],
          );
          itemsCreated += 1;
        }
      }
    }

    console.log(
      `[${LOG}] done groups=${groupsCreated} combos=${combosCreated} items=${itemsCreated}`,
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}] failed:`, err);
  process.exit(1);
});
