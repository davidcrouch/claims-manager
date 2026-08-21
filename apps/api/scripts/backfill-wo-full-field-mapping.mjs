/**
 * Backfill work_orders header fields and work_order_groups/combos/items promoted
 * columns from existing *_payload JSONB columns.
 *
 * Covers: party buckets (wo_to/wo_for/wo_from + promoted scalars), total_amount,
 * external_id, service_window, start_time, end_time, adjustment_info,
 * allocation_context, adjusted_total_adjustment_amount, group dimensions/totals/
 * sort_index, combo catalog_combo_id/quote_combo_id/totals/sort_index, item
 * catalog_item_id/quote_line_item_id/unit_type_lookup_id/item_type/markup_type/
 * markup_value/reconciliation/manual_allocation/note/tags/sort_index.
 *
 * Usage: node scripts/backfill-wo-full-field-mapping.mjs [--dry-run]
 */
import 'dotenv/config';
import pg from 'pg';

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-wo-full-field-mapping';

function asStr(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function asNum(v) {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v.toString();
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return v;
  return null;
}

function asBool(v) {
  if (typeof v === 'boolean') return v;
  return null;
}

const TO_MAP = [
  ['toName', 'name'], ['toCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['toContactName', 'contactName'], ['toInvoiceNumber', 'invoiceNumber'],
  ['toPhoneNumber', 'phoneNumber'], ['toEmail', 'email'],
  ['toUnitNumber', 'unitNumber'], ['toStreetNumber', 'streetNumber'],
  ['toStreetName', 'streetName'], ['toSuburb', 'suburb'],
  ['toPostCode', 'postCode'], ['toState', 'state'], ['toCountry', 'country'],
];
const FOR_MAP = [
  ['forName', 'name'], ['forCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['forContactName', 'contactName'], ['forInvoiceNumber', 'invoiceNumber'],
  ['forPhoneNumber', 'phoneNumber'], ['forEmail', 'email'],
  ['forUnitNumber', 'unitNumber'], ['forStreetNumber', 'streetNumber'],
  ['forStreetName', 'streetName'], ['forSuburb', 'suburb'],
  ['forPostCode', 'postCode'], ['forState', 'state'], ['forCountry', 'country'],
];
const FROM_MAP = [
  ['fromName', 'name'], ['fromCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['fromContactName', 'contactName'], ['fromPhoneNumber', 'phoneNumber'],
  ['fromEmail', 'email'], ['fromUnitNumber', 'unitNumber'],
  ['fromStreetNumber', 'streetNumber'], ['fromStreetName', 'streetName'],
  ['fromSuburb', 'suburb'], ['fromPostCode', 'postCode'],
  ['fromState', 'state'], ['fromCountry', 'country'],
];

function collectBucket(payload, mapping) {
  const bucket = {};
  for (const [cwKey, jsonbKey] of mapping) {
    const v = asStr(payload[cwKey]);
    if (v) bucket[jsonbKey] = v;
  }
  return Object.keys(bucket).length > 0 ? bucket : null;
}

async function backfillHeaders(client) {
  const { rows } = await client.query(`
    SELECT id, work_order_payload FROM work_orders WHERE deleted_at IS NULL
  `);
  console.log(`[${LOG}] work_orders candidates=${rows.length}`);
  let updated = 0;

  for (const row of rows) {
    const p = row.work_order_payload;
    if (!p || typeof p !== 'object') continue;

    const woTo = collectBucket(p, TO_MAP);
    const woFor = collectBucket(p, FOR_MAP);
    const woFrom = collectBucket(p, FROM_MAP);

    const sw = {};
    if (p.startDate) sw.startDate = p.startDate;
    if (p.endDate) sw.endDate = p.endDate;
    if (p.startTime) sw.startTime = p.startTime;
    if (p.endTime) sw.endTime = p.endTime;
    if (p.expiresInDays != null) sw.expiresInDays = p.expiresInDays;

    const adjInfo = {};
    if (asNum(p.adjustedTotal)) adjInfo.adjustedTotal = asNum(p.adjustedTotal);
    if (asNum(p.adjustedTotalAdjustmentAmount)) adjInfo.adjustedTotalAdjustmentAmount = asNum(p.adjustedTotalAdjustmentAmount);

    const allocCtx = {};
    if (p.vendorAllocationJobTypeId) allocCtx.vendorAllocationJobTypeId = p.vendorAllocationJobTypeId;
    if (p.vendorAllocationReportTypeId) allocCtx.vendorAllocationReportTypeId = p.vendorAllocationReportTypeId;
    if (p.quoteRevisionId) allocCtx.quoteRevisionId = p.quoteRevisionId;
    if (p.expiresInDays != null) allocCtx.expiresInDays = p.expiresInDays;

    const sets = [];
    const vals = [row.id];
    let idx = 2;

    const push = (col, val) => {
      if (val != null) {
        sets.push(`${col} = $${idx}`);
        vals.push(typeof val === 'object' ? JSON.stringify(val) : val);
        idx++;
      }
    };

    const correctExternalId = asStr(p.externalId) ?? asStr(p.id);
    push('external_id', correctExternalId);
    push('total_amount', asNum(p.total) ?? asNum(p.totalAmount));
    push('start_time', asStr(p.startTime));
    push('end_time', asStr(p.endTime));
    push('adjusted_total_adjustment_amount', asNum(p.adjustedTotalAdjustmentAmount));

    if (woTo) { sets.push(`wo_to = $${idx}::jsonb`); vals.push(JSON.stringify(woTo)); idx++; }
    if (woFor) { sets.push(`wo_for = $${idx}::jsonb`); vals.push(JSON.stringify(woFor)); idx++; }
    if (woFrom) { sets.push(`wo_from = $${idx}::jsonb`); vals.push(JSON.stringify(woFrom)); idx++; }
    if (woTo?.email) { sets.push(`wo_to_email = $${idx}`); vals.push(woTo.email); idx++; }
    if (woFor?.name) { sets.push(`wo_for_name = $${idx}`); vals.push(woFor.name); idx++; }
    if (Object.keys(sw).length > 0) { sets.push(`service_window = $${idx}::jsonb`); vals.push(JSON.stringify(sw)); idx++; }
    if (Object.keys(adjInfo).length > 0) { sets.push(`adjustment_info = $${idx}::jsonb`); vals.push(JSON.stringify(adjInfo)); idx++; }
    if (Object.keys(allocCtx).length > 0) { sets.push(`allocation_context = $${idx}::jsonb`); vals.push(JSON.stringify(allocCtx)); idx++; }

    if (sets.length === 0) continue;
    sets.push('updated_at = now()');

    if (!dryRun) {
      await client.query(`UPDATE work_orders SET ${sets.join(', ')} WHERE id = $1`, vals);
    }
    updated++;
  }
  console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'} ${updated} work_order headers`);
}

async function backfillGroups(client) {
  const { rows } = await client.query(`
    SELECT id, group_payload FROM work_order_groups WHERE deleted_at IS NULL
  `);
  console.log(`[${LOG}] work_order_groups candidates=${rows.length}`);
  let updated = 0;

  for (const row of rows) {
    const p = row.group_payload;
    if (!p || typeof p !== 'object') continue;

    const dims = {};
    if (p.length != null) dims.length = p.length;
    if (p.width != null) dims.width = p.width;
    if (p.height != null) dims.height = p.height;

    const tots = {};
    if (p.subTotal != null) tots.subTotal = p.subTotal;
    if (p.totalTax != null) tots.totalTax = p.totalTax;
    if (p.total != null) tots.total = p.total;

    const sortIdx = typeof p.index === 'number' ? p.index : null;

    const sets = [];
    const vals = [row.id];
    let idx = 2;

    if (Object.keys(dims).length > 0) { sets.push(`dimensions = $${idx}::jsonb`); vals.push(JSON.stringify(dims)); idx++; }
    if (Object.keys(tots).length > 0) { sets.push(`totals = $${idx}::jsonb`); vals.push(JSON.stringify(tots)); idx++; }
    if (sortIdx != null) { sets.push(`sort_index = $${idx}`); vals.push(sortIdx); idx++; }

    if (sets.length === 0) continue;
    sets.push('updated_at = now()');

    if (!dryRun) {
      await client.query(`UPDATE work_order_groups SET ${sets.join(', ')} WHERE id = $1`, vals);
    }
    updated++;
  }
  console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'} ${updated} work_order_groups`);
}

async function backfillCombos(client) {
  const { rows } = await client.query(`
    SELECT id, combo_payload FROM work_order_combos WHERE deleted_at IS NULL
  `);
  console.log(`[${LOG}] work_order_combos candidates=${rows.length}`);
  let updated = 0;

  for (const row of rows) {
    const p = row.combo_payload;
    if (!p || typeof p !== 'object') continue;

    const sets = [];
    const vals = [row.id];
    let idx = 2;

    const push = (col, val) => {
      if (val != null) { sets.push(`${col} = $${idx}`); vals.push(val); idx++; }
    };

    push('catalog_combo_id', asStr(p.catalogComboId));
    push('quote_combo_id', asStr(p.quoteComboId));
    const sortIdx = typeof p.index === 'number' ? p.index : null;
    push('sort_index', sortIdx);

    const tots = {};
    if (p.total != null) tots.total = p.total;
    if (Object.keys(tots).length > 0) { sets.push(`totals = $${idx}::jsonb`); vals.push(JSON.stringify(tots)); idx++; }

    if (sets.length === 0) continue;
    sets.push('updated_at = now()');

    if (!dryRun) {
      await client.query(`UPDATE work_order_combos SET ${sets.join(', ')} WHERE id = $1`, vals);
    }
    updated++;
  }
  console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'} ${updated} work_order_combos`);
}

async function backfillItems(client) {
  const { rows } = await client.query(`
    SELECT id, item_payload FROM work_order_items WHERE deleted_at IS NULL
  `);
  console.log(`[${LOG}] work_order_items candidates=${rows.length}`);
  let updated = 0;

  for (const row of rows) {
    const p = row.item_payload;
    if (!p || typeof p !== 'object') continue;

    const sets = [];
    const vals = [row.id];
    let idx = 2;

    const push = (col, val) => {
      if (val != null) { sets.push(`${col} = $${idx}`); vals.push(val); idx++; }
    };

    push('catalog_item_id', asStr(p.catalogItemId));
    push('quote_line_item_id', asStr(p.quoteLineItemId));
    push('item_type', asStr(p.type) ?? asStr(p.itemType));
    push('markup_type', asStr(p.markupType));
    push('markup_value', asNum(p.markupValue));
    push('reconciliation', asNum(p.reconciliation));
    push('manual_allocation', asBool(p.manualAllocation));
    push('note', asStr(p.note));

    const sortIdx = typeof p.index === 'number' ? p.index : null;
    push('sort_index', sortIdx);

    if (Array.isArray(p.tags) && p.tags.length > 0) {
      sets.push(`tags = $${idx}::jsonb`);
      vals.push(JSON.stringify(p.tags));
      idx++;
    }

    if (sets.length === 0) continue;
    sets.push('updated_at = now()');

    if (!dryRun) {
      await client.query(`UPDATE work_order_items SET ${sets.join(', ')} WHERE id = $1`, vals);
    }
    updated++;
  }
  console.log(`[${LOG}] ${dryRun ? 'would update' : 'updated'} ${updated} work_order_items`);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error(`[${LOG}] DATABASE_URL is required`);
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await backfillHeaders(client);
    await backfillGroups(client);
    await backfillCombos(client);
    await backfillItems(client);
    console.log(`[${LOG}] done (dryRun=${dryRun})`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(`[${LOG}]`, err);
  process.exit(1);
});
