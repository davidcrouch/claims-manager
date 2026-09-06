/**
 * Backfill quotes.quote_to / quote_for / quote_from (+ promoted name/email)
 * from api_payload flat to/for/from keys when buckets are empty.
 *
 * For local drafts with empty api_payload parties, seeds:
 *   From = tenant organisation
 *   For  = job Customer/Insured contact
 *   To   = job Insurer/Broker contact
 *
 * Usage: node scripts/backfill-quote-parties.mjs [--dry-run]
 */
import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const dryRun = process.argv.includes('--dry-run');
const LOG = 'backfill-quote-parties';

const TO_MAP = [
  ['toName', 'name'],
  ['toCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['toContactName', 'contactName'],
  ['toClientReference', 'clientReference'],
  ['toPhoneNumber', 'phoneNumber'],
  ['toEmail', 'email'],
  ['toUnitNumber', 'unitNumber'],
  ['toStreetNumber', 'streetNumber'],
  ['toStreetName', 'streetName'],
  ['toSuburb', 'suburb'],
  ['toPostCode', 'postCode'],
  ['toState', 'state'],
  ['toCountry', 'country'],
];
const FOR_MAP = [
  ['forName', 'name'],
  ['forCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['forContactName', 'contactName'],
  ['forClientReference', 'clientReference'],
  ['forPhoneNumber', 'phoneNumber'],
  ['forEmail', 'email'],
  ['forUnitNumber', 'unitNumber'],
  ['forStreetNumber', 'streetNumber'],
  ['forStreetName', 'streetName'],
  ['forSuburb', 'suburb'],
  ['forPostCode', 'postCode'],
  ['forState', 'state'],
  ['forCountry', 'country'],
];
const FROM_MAP = [
  ['fromName', 'name'],
  ['fromCompanyRegistrationNumber', 'companyRegistrationNumber'],
  ['fromContactName', 'contactName'],
  ['fromPhoneNumber', 'phoneNumber'],
  ['fromEmail', 'email'],
  ['fromUnitNumber', 'unitNumber'],
  ['fromStreetNumber', 'streetNumber'],
  ['fromStreetName', 'streetName'],
  ['fromSuburb', 'suburb'],
  ['fromPostCode', 'postCode'],
  ['fromState', 'state'],
  ['fromCountry', 'country'],
];

function asStr(v) {
  if (v == null) return null;
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function collectBucket(payload, mapping) {
  const bucket = {};
  for (const [cwKey, jsonbKey] of mapping) {
    const v = asStr(payload?.[cwKey]);
    if (v) bucket[jsonbKey] = v;
  }
  return bucket;
}

function contactParty(row) {
  const name = [row.first_name, row.last_name]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ');
  const phone =
    asStr(row.mobile_phone) || asStr(row.work_phone) || asStr(row.home_phone);
  const party = {};
  if (name) {
    party.name = name;
    party.contactName = name;
  }
  if (asStr(row.email)) party.email = asStr(row.email);
  if (phone) party.phoneNumber = phone;
  return party;
}

function typeKey(row) {
  return `${row.type_name ?? ''} ${row.type_ext ?? ''}`.toLowerCase();
}

async function main() {
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT
      q.id,
      q.tenant_id,
      q.job_id,
      q.quote_number,
      q.api_payload,
      q.quote_to,
      q.quote_for,
      q.quote_from
    FROM quotes q
    WHERE q.deleted_at IS NULL
      AND q.quote_to = '{}'::jsonb
      AND q.quote_for = '{}'::jsonb
      AND q.quote_from = '{}'::jsonb
  `);

  console.log(`[${LOG}] candidates=${rows.length} dryRun=${dryRun}`);
  let updated = 0;

  for (const row of rows) {
    const payload =
      row.api_payload && typeof row.api_payload === 'object'
        ? row.api_payload
        : {};
    let quoteTo = collectBucket(payload, TO_MAP);
    let quoteFor = collectBucket(payload, FOR_MAP);
    let quoteFrom = collectBucket(payload, FROM_MAP);
    let source = 'api_payload';

    const empty =
      Object.keys(quoteTo).length === 0 &&
      Object.keys(quoteFor).length === 0 &&
      Object.keys(quoteFrom).length === 0;

    if (empty) {
      source = 'org+job';
      const { rows: orgs } = await client.query(
        `SELECT name, legal_name, trading_name, abn, primary_email, phone
         FROM organizations WHERE id = $1`,
        [row.tenant_id],
      );
      const org = orgs[0];
      if (org) {
        const fromName =
          asStr(org.legal_name) || asStr(org.trading_name) || asStr(org.name);
        if (fromName) {
          quoteFrom = { name: fromName, contactName: fromName };
          if (asStr(org.abn)) quoteFrom.companyRegistrationNumber = asStr(org.abn);
          if (asStr(org.primary_email)) quoteFrom.email = asStr(org.primary_email);
          if (asStr(org.phone)) quoteFrom.phoneNumber = asStr(org.phone);
        }
      }

      if (row.job_id) {
        const { rows: contacts } = await client.query(
          `SELECT c.first_name, c.last_name, c.email, c.mobile_phone, c.home_phone, c.work_phone,
                  lv.name AS type_name, lv.external_reference AS type_ext
           FROM job_contacts jc
           JOIN contacts c ON c.id = jc.contact_id
           LEFT JOIN lookup_values lv
             ON lv.id = c.type_lookup_id
            AND lv.tenant_id = jc.tenant_id
            AND lv.domain = 'contact_type'
           WHERE jc.job_id = $1 AND jc.tenant_id = $2
           ORDER BY jc.sort_index ASC, c.last_name ASC NULLS LAST, c.first_name ASC NULLS LAST`,
          [row.job_id, row.tenant_id],
        );
        const forRow = contacts.find((c) => {
          const k = typeKey(c);
          return k.includes('insured') || k.includes('customer');
        });
        const toRow = contacts.find((c) => {
          const k = typeKey(c);
          return (
            k.includes('insurer') ||
            k.includes('adjuster') ||
            k.includes('broker')
          );
        });
        if (forRow) quoteFor = contactParty(forRow);
        if (toRow) quoteTo = contactParty(toRow);
      }
    }

    if (
      Object.keys(quoteTo).length === 0 &&
      Object.keys(quoteFor).length === 0 &&
      Object.keys(quoteFrom).length === 0
    ) {
      console.log(
        `[${LOG}] skip ${row.quote_number || row.id.slice(0, 8)} — no party data`,
      );
      continue;
    }

    console.log(
      `[${LOG}] ${dryRun ? 'would update' : 'update'} ${row.quote_number || row.id.slice(0, 8)} via ${source} to=${Object.keys(quoteTo).length} for=${Object.keys(quoteFor).length} from=${Object.keys(quoteFrom).length}`,
    );

    if (!dryRun) {
      await client.query(
        `UPDATE quotes SET
           quote_to = $2::jsonb,
           quote_for = $3::jsonb,
           quote_from = $4::jsonb,
           quote_to_name = COALESCE($5, quote_to_name),
           quote_to_email = COALESCE($6, quote_to_email),
           quote_for_name = COALESCE($7, quote_for_name),
           updated_at = NOW()
         WHERE id = $1`,
        [
          row.id,
          JSON.stringify(quoteTo),
          JSON.stringify(quoteFor),
          JSON.stringify(quoteFrom),
          quoteTo.name ?? null,
          quoteTo.email ?? null,
          quoteFor.name ?? null,
        ],
      );
    }
    updated += 1;
  }

  console.log(`[${LOG}] done updated=${updated}`);
  await client.end();
}

main().catch((err) => {
  console.error(`[${LOG}] failed`, err);
  process.exit(1);
});
