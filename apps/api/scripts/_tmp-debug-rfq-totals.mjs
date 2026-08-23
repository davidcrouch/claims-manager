import 'dotenv/config';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows: rfqs } = await client.query(`
  SELECT id, name, rfq_number, internal_number, include_pricing
  FROM rfqs
  WHERE deleted_at IS NULL
  ORDER BY updated_at DESC
  LIMIT 3
`);
console.log('Recent RFQs:', rfqs);

for (const rfq of rfqs) {
  const { rows: groups } = await client.query(
    'SELECT id, description, totals FROM rfq_groups WHERE rfq_id = $1',
    [rfq.id],
  );
  console.log(`\nRFQ ${rfq.internal_number ?? rfq.rfq_number} groups:`);
  for (const g of groups) {
    console.log(' ', g.description, JSON.stringify(g.totals));
  }

  const { rows: items } = await client.query(
    `SELECT i.name, i.unit_cost, i.quantity, i.tax, i.totals
     FROM rfq_items i
     JOIN rfq_groups g ON g.id = i.rfq_group_id
     WHERE g.rfq_id = $1
     LIMIT 5`,
    [rfq.id],
  );
  console.log(' sample items:', items);
}

const { rows: transforms } = await client.query(`
  SELECT version, (jsonata_rules LIKE '%_context._totals%') AS has_totals
  FROM document_template_transforms
  WHERE document_type = 'rfq'
`);
console.log('\nRFQ transform:', transforms);

await client.end();
