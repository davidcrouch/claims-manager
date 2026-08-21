/**
 * Backfill contacts + claim_contacts from claims.api_payload.contacts
 * for claims that have embedded CW contacts but no claim_contacts rows.
 *
 * Usage: node scripts/backfill-claim-contacts.mjs [--dry-run] [--limit N]
 */
import 'dotenv/config';
import pg from 'pg';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 500;

function normalizePhoneDigits(phone) {
  if (phone == null) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function isBlank(v) {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function asString(v) {
  if (typeof v === 'string' && v.length > 0) return v;
  if (typeof v === 'number') return String(v);
  return null;
}

function extractContacts(payloadContacts) {
  if (!Array.isArray(payloadContacts)) return [];
  const out = [];
  for (const entry of payloadContacts) {
    if (!entry || typeof entry !== 'object') continue;
    const extRef = asString(entry.externalReference) ?? asString(entry.id);
    const firstName = asString(entry.firstName);
    const lastName = asString(entry.lastName);
    const email = asString(entry.email);
    const mobilePhone = asString(entry.mobilePhone);
    const homePhone = asString(entry.homePhone);
    const workPhone = asString(entry.workPhone);
    if (
      !extRef &&
      !email &&
      !normalizePhoneDigits(mobilePhone) &&
      !normalizePhoneDigits(homePhone) &&
      !normalizePhoneDigits(workPhone) &&
      !(firstName && lastName)
    ) {
      continue;
    }
    out.push({
      externalReference: extRef,
      firstName,
      lastName,
      email,
      mobilePhone,
      homePhone,
      workPhone,
      notes: asString(entry.notes),
      sourcePayload: entry,
      typeName:
        entry.type && typeof entry.type === 'object'
          ? asString(entry.type.name)
          : typeof entry.type === 'string'
            ? entry.type
            : null,
    });
  }
  return out;
}

async function findMatchingContact(client, tenantId, raw) {
  if (raw.externalReference) {
    const r = await client.query(
      `SELECT * FROM contacts WHERE tenant_id=$1 AND external_reference=$2 LIMIT 1`,
      [tenantId, raw.externalReference],
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (raw.email) {
    const r = await client.query(
      `SELECT * FROM contacts WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
      [tenantId, raw.email],
    );
    if (r.rows[0]) return r.rows[0];
  }
  for (const phone of [raw.mobilePhone, raw.homePhone, raw.workPhone]) {
    const digits = normalizePhoneDigits(phone);
    if (!digits) continue;
    const r = await client.query(
      `SELECT * FROM contacts
       WHERE tenant_id=$1 AND (
         regexp_replace(coalesce(mobile_phone,''), '[^0-9]', '', 'g') = $2
         OR regexp_replace(coalesce(home_phone,''), '[^0-9]', '', 'g') = $2
         OR regexp_replace(coalesce(work_phone,''), '[^0-9]', '', 'g') = $2
       )
       LIMIT 1`,
      [tenantId, digits],
    );
    if (r.rows[0]) return r.rows[0];
  }
  if (raw.firstName && raw.lastName) {
    const r = await client.query(
      `SELECT * FROM contacts
       WHERE tenant_id=$1
         AND lower(first_name)=lower($2)
         AND lower(last_name)=lower($3)
       LIMIT 1`,
      [tenantId, raw.firstName, raw.lastName],
    );
    if (r.rows[0]) return r.rows[0];
  }
  return null;
}

function fillBlanks(existing, inbound) {
  const patch = {};
  const scalars = [
    'first_name',
    'last_name',
    'email',
    'mobile_phone',
    'home_phone',
    'work_phone',
    'notes',
  ];
  const map = {
    first_name: inbound.firstName,
    last_name: inbound.lastName,
    email: inbound.email,
    mobile_phone: inbound.mobilePhone,
    home_phone: inbound.homePhone,
    work_phone: inbound.workPhone,
    notes: inbound.notes,
  };
  for (const col of scalars) {
    if (isBlank(existing[col]) && !isBlank(map[col])) patch[col] = map[col];
  }
  if (!isBlank(inbound.externalReference)) {
    patch.external_reference = inbound.externalReference;
  }
  if (inbound.sourcePayload !== undefined) {
    patch.contact_payload = inbound.sourcePayload;
  }
  return patch;
}

async function upsertContact(client, tenantId, raw) {
  let existing = await findMatchingContact(client, tenantId, raw);
  if (!existing && raw.email) {
    const r = await client.query(
      `SELECT * FROM contacts WHERE tenant_id=$1 AND lower(email)=lower($2) LIMIT 1`,
      [tenantId, raw.email],
    );
    existing = r.rows[0] ?? null;
  }

  if (existing) {
    const patch = fillBlanks(existing, raw);
    const keys = Object.keys(patch);
    if (keys.length === 0) return existing.id;
    const sets = keys.map((k, i) => `${k}=$${i + 3}`);
    sets.push('updated_at=now()');
    const values = keys.map((k) => patch[k]);
    const r = await client.query(
      `UPDATE contacts SET ${sets.join(', ')} WHERE id=$1 AND tenant_id=$2 RETURNING id`,
      [existing.id, tenantId, ...values],
    );
    return r.rows[0].id;
  }

  const r = await client.query(
    `INSERT INTO contacts (
       tenant_id, external_reference, first_name, last_name, email,
       mobile_phone, home_phone, work_phone, notes, contact_payload
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     RETURNING id`,
    [
      tenantId,
      raw.externalReference,
      raw.firstName,
      raw.lastName,
      raw.email,
      raw.mobilePhone,
      raw.homePhone,
      raw.workPhone,
      raw.notes,
      JSON.stringify(raw.sourcePayload ?? {}),
    ],
  );
  return r.rows[0].id;
}

async function linkClaimContact(client, tenantId, claimId, contactId, sortIndex, raw) {
  await client.query(
    `INSERT INTO claim_contacts (tenant_id, claim_id, contact_id, sort_index, source_payload, visibility)
     VALUES ($1,$2,$3,$4,$5::jsonb,'org')
     ON CONFLICT (claim_id, contact_id) DO UPDATE SET
       sort_index = EXCLUDED.sort_index,
       source_payload = EXCLUDED.source_payload`,
    [
      tenantId,
      claimId,
      contactId,
      sortIndex,
      JSON.stringify({
        typeName: raw.typeName,
        raw: raw.sourcePayload,
      }),
    ],
  );
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const claims = await client.query(
  `
  SELECT id, tenant_id, claim_number, api_payload->'contacts' AS contacts
  FROM claims
  WHERE deleted_at IS NULL
    AND api_payload ? 'contacts'
    AND jsonb_typeof(api_payload->'contacts') = 'array'
    AND jsonb_array_length(api_payload->'contacts') > 0
    AND NOT EXISTS (SELECT 1 FROM claim_contacts cc WHERE cc.claim_id = claims.id)
  ORDER BY created_at DESC
  LIMIT $1
`,
  [limit],
);

console.log(
  `backfill-claim-contacts — found ${claims.rows.length} orphan claim(s) (dryRun=${dryRun})`,
);

let claimsUpdated = 0;
let contactsLinked = 0;
let errors = 0;

for (const claim of claims.rows) {
  const rawContacts = extractContacts(claim.contacts);
  if (rawContacts.length === 0) continue;

  try {
    if (!dryRun) await client.query('BEGIN');
    let sortIndex = 0;
    for (const raw of rawContacts) {
      if (dryRun) {
        console.log(
          `  [dry-run] claim=${claim.claim_number} contact=${raw.firstName} ${raw.lastName} ext=${raw.externalReference}`,
        );
      } else {
        const contactId = await upsertContact(client, claim.tenant_id, raw);
        await linkClaimContact(
          client,
          claim.tenant_id,
          claim.id,
          contactId,
          sortIndex,
          raw,
        );
        contactsLinked += 1;
      }
      sortIndex += 1;
    }
    if (!dryRun) {
      await client.query('COMMIT');
      claimsUpdated += 1;
    }
  } catch (err) {
    errors += 1;
    if (!dryRun) await client.query('ROLLBACK');
    console.error(
      `backfill-claim-contacts — failed claim=${claim.claim_number}:`,
      err.message,
    );
  }
}

console.log(
  `backfill-claim-contacts — done claimsUpdated=${claimsUpdated} contactsLinked=${contactsLinked} errors=${errors}`,
);

await client.end();
