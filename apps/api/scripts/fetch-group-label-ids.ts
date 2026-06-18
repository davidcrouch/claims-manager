/**
 * Fetches Crunchwork internal IDs for group labels.
 *
 * Strategy:
 * 1. Mine existing api_payload data from quotes in our DB for groupLabel.id values
 * 2. For any labels not found in local data, fetch quotes from CW API
 * 3. Update lookup_values.metadata with { crunchworkId: "..." } for each label
 *
 * Usage: npx tsx scripts/fetch-group-label-ids.ts
 */
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const PREFIX = 'enc:';

const ALL_GROUP_LABELS = [
  'Alfresco', 'Awning', 'BBQ Area', 'Balcony', 'Bar', 'Bathroom',
  'Bathroom 2', 'Bathroom 3', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3',
  'Bedroom 4', 'Bedroom 5', 'Bedroom 6', 'Board Room', 'Built In Robe',
  'Carport', 'Cash Settlement Recommended', 'Closet', 'Deck', 'Demolition',
  'Dining', 'Ensuite', 'Entry', 'External', 'Family', 'Fees', 'Fencing',
  'Front Patio', 'Games Room', 'Garage', 'Garden Shed', 'Gazebo', 'General',
  'Granny Flat', 'Hallway', 'Internal', 'Kayak Room', 'Kitchen', 'Kitchen 2',
  'Laundry', 'Liability Item', 'Library', 'Living Area', 'Living Room 2',
  'Lounge', 'Lunch Room', 'Main Bedroom', 'Make Safe', 'Media Room', 'Office',
  'Office 2', 'Office 3', 'Office 4', 'Open Plan Room', 'Pantry', 'Passage',
  'Passage 2', 'Passage 3', 'Patio', 'Pergola Area', 'Powder Room',
  'Preliminaries', 'Prime Cost', 'Procurement Items', 'Provisional Sum',
  'Roof', 'Rumpus Room', 'Sauna', 'Shed', 'Staff Room', 'Stairwell',
  'Store Room', 'Store Room 1', 'Store Room 2', 'Store Room 3', 'Store Room 4',
  'Study', 'Sunroom', 'Swimming Pool', 'Tennis Court', 'Theatre Room',
  'Toilet', 'Unit 1', 'Unit 2', 'Unit 3', 'Unit 4', 'Unit 5', 'Unit 6',
  'Validation Items', 'Verandah', 'Waiting Room 1', 'Walk In Robe', 'Other',
];

function decryptValue(ciphertext: string, key: Buffer): string {
  if (!ciphertext.startsWith(PREFIX)) {
    throw new Error('value missing enc: prefix — DB value is not encrypted');
  }
  const raw = Buffer.from(ciphertext.slice(PREFIX.length), 'base64');
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

interface CwConnection {
  id: string;
  authUrl: string;
  baseUrl: string;
  baseApi: string;
  clientId: string;
  clientSecret: string;
  providerTenantId: string;
}

async function loadConnection(pool: Pool): Promise<CwConnection> {
  const rawKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!rawKey) throw new Error('CREDENTIALS_ENCRYPTION_KEY required');
  const key = crypto.createHash('sha256').update(rawKey).digest();

  const res = await pool.query(`
    SELECT id, auth_url, base_url, base_api, credentials, provider_tenant_id
    FROM integration_connections
    WHERE provider_code = 'crunchwork' AND is_active = true
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  if (res.rowCount === 0) throw new Error('No active Crunchwork connection found');

  const row = res.rows[0];
  let credsJson: Record<string, string>;
  if (typeof row.credentials === 'string') {
    credsJson = JSON.parse(decryptValue(row.credentials, key));
  } else {
    throw new Error('credentials not encrypted — run encrypt script first');
  }

  return {
    id: row.id,
    authUrl: row.auth_url,
    baseUrl: row.base_url,
    baseApi: row.base_api || row.base_url,
    clientId: credsJson.clientId,
    clientSecret: credsJson.clientSecret,
    providerTenantId: row.provider_tenant_id,
  };
}

async function getAccessToken(conn: CwConnection): Promise<string> {
  const credentials = Buffer.from(`${conn.clientId}:${conn.clientSecret}`).toString('base64');
  const resp = await fetch(conn.authUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Token request failed: ${resp.status} ${resp.statusText} - ${body}`);
  }
  const data = await resp.json() as { access_token: string };
  return data.access_token;
}

async function fetchQuoteFromCw(conn: CwConnection, token: string, quoteId: string): Promise<Record<string, unknown>> {
  const baseUrl = conn.baseApi.replace(/\/$/, '');
  const url = `${baseUrl}/quotes/${quoteId}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'active-tenant-id': conn.providerTenantId,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  });
  if (!resp.ok) {
    throw new Error(`GET ${url} failed: ${resp.status}`);
  }
  return resp.json() as Promise<Record<string, unknown>>;
}

interface GroupLabelMapping {
  externalReference: string;
  crunchworkId: string;
  name: string;
}

function extractGroupLabels(quotePayload: Record<string, unknown>): GroupLabelMapping[] {
  const groups = quotePayload.groups as Array<Record<string, unknown>> | undefined;
  if (!groups || !Array.isArray(groups)) return [];

  const labels: GroupLabelMapping[] = [];
  for (const group of groups) {
    const gl = group.groupLabel as Record<string, unknown> | undefined;
    if (gl && gl.id && gl.externalReference) {
      labels.push({
        externalReference: gl.externalReference as string,
        crunchworkId: gl.id as string,
        name: (gl.name as string) || (gl.externalReference as string),
      });
    }
  }
  return labels;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL required');

  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // Step 1: Check what's already in the DB
    console.log('=== Step 1: Checking existing lookup_values ===');
    const lookupRes = await pool.query(`
      SELECT id, name, external_reference, metadata
      FROM lookup_values
      WHERE domain = 'group_label' AND provider_code = 'crunchwork'
      ORDER BY name
    `);
    console.log(`Found ${lookupRes.rowCount} group labels in lookup_values`);

    const existingMap = new Map<string, { id: string; metadata: Record<string, unknown> }>();
    for (const row of lookupRes.rows) {
      existingMap.set(row.external_reference, { id: row.id, metadata: row.metadata || {} });
    }

    const alreadyHaveId = new Map<string, string>();
    for (const [extRef, data] of existingMap) {
      if (data.metadata && (data.metadata as Record<string, unknown>).crunchworkId) {
        alreadyHaveId.set(extRef, (data.metadata as Record<string, unknown>).crunchworkId as string);
      }
    }
    console.log(`Already have crunchworkId for ${alreadyHaveId.size} labels`);

    // Step 2: Mine existing api_payload from quotes for groupLabel IDs
    console.log('\n=== Step 2: Mining api_payload from existing quotes ===');
    const payloadRes = await pool.query(`
      SELECT DISTINCT ON (gl_ext_ref) 
        gl->>'id' as cw_id,
        gl->>'externalReference' as gl_ext_ref,
        gl->>'name' as gl_name
      FROM quotes q,
        jsonb_array_elements(q.api_payload->'groups') g,
        LATERAL (SELECT g->'groupLabel' as gl) sub
      WHERE q.api_payload->'groups' IS NOT NULL
        AND jsonb_typeof(q.api_payload->'groups') = 'array'
        AND gl->>'id' IS NOT NULL
        AND gl->>'externalReference' IS NOT NULL
    `);
    
    const minedMap = new Map<string, string>();
    for (const row of payloadRes.rows) {
      minedMap.set(row.gl_ext_ref, row.cw_id);
    }
    console.log(`Mined ${minedMap.size} groupLabel IDs from existing quote payloads`);
    if (minedMap.size > 0) {
      console.log('Mined labels:', [...minedMap.keys()].sort().join(', '));
    }

    // Step 3: Determine which labels still need IDs
    const needIds = ALL_GROUP_LABELS.filter(label => !alreadyHaveId.has(label) && !minedMap.has(label));
    console.log(`\nStill need IDs for ${needIds.length} labels:`, needIds.join(', '));

    // Step 4: Try CW API for missing ones
    const combinedMap = new Map<string, string>([...alreadyHaveId, ...minedMap]);
    
    if (needIds.length > 0) {
      console.log('\n=== Step 3: Fetching from CW API ===');
      const conn = await loadConnection(pool);
      console.log(`Using connection ${conn.id}, baseApi=${conn.baseApi}`);
      
      const token = await getAccessToken(conn);
      console.log('Got access token');

      const baseUrl = conn.baseApi.replace(/\/$/, '');
      const headers = {
        Authorization: `Bearer ${token}`,
        'active-tenant-id': conn.providerTenantId,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      // We need a valid jobId to create quotes
      const jobRes = await pool.query(`
        SELECT external_reference FROM jobs 
        WHERE external_reference IS NOT NULL 
        ORDER BY created_at DESC LIMIT 1
      `);
      
      if (!jobRes.rowCount || jobRes.rowCount === 0) {
        console.log('No jobs found in DB to use as quote parent');
      } else {
        const jobId = jobRes.rows[0].external_reference;
        console.log(`Using job ${jobId} to create temp quotes`);

        // Try each label individually — CW returns 500 if the label is invalid,
        // so we do one at a time to identify which are valid.
        const invalidLabels: string[] = [];
        const createdQuoteIds: string[] = [];
        
        for (const label of needIds) {
          if (combinedMap.has(label)) continue;

          const body = {
            name: `__TEMP_LOOKUP_${label}__`,
            jobId,
            groups: [{ groupLabel: { externalReference: label }, index: 0 }],
          };

          try {
            const resp = await fetch(`${baseUrl}/quotes`, {
              method: 'POST',
              headers,
              body: JSON.stringify(body),
            });

            if (resp.ok) {
              const quoteData = await resp.json() as Record<string, unknown>;
              const quoteId = quoteData.id as string;
              if (quoteId) createdQuoteIds.push(quoteId);
              
              const labels = extractGroupLabels(quoteData);
              for (const l of labels) {
                if (!combinedMap.has(l.externalReference)) {
                  combinedMap.set(l.externalReference, l.crunchworkId);
                  console.log(`  ✓ ${l.externalReference} => ${l.crunchworkId}`);
                }
              }
            } else {
              const errText = await resp.text();
              if (errText.includes('Could not find an internal value')) {
                invalidLabels.push(label);
                console.log(`  ✗ ${label} — not configured in CW`);
              } else {
                console.log(`  ? ${label} — ${resp.status}: ${errText.slice(0, 100)}`);
              }
            }
          } catch (err) {
            console.log(`  ! ${label} — network error`);
          }
        }

        if (invalidLabels.length > 0) {
          console.log(`\nLabels NOT in CW (${invalidLabels.length}): ${invalidLabels.join(', ')}`);
        }
        if (createdQuoteIds.length > 0) {
          console.log(`\nCreated ${createdQuoteIds.length} temp quotes in CW staging — cancel them manually if needed`);
        }
      }
    }

    // Step 5: Update lookup_values with found IDs
    console.log('\n=== Step 4: Updating lookup_values ===');
    let updated = 0;
    let inserted = 0;
    const tenantRes = await pool.query(`
      SELECT DISTINCT tenant_id FROM lookup_values 
      WHERE domain = 'group_label' AND provider_code = 'crunchwork' LIMIT 1
    `);
    const tenantId = tenantRes.rows[0]?.tenant_id;
    if (!tenantId) {
      console.log('ERROR: No tenant_id found for group labels');
      return;
    }

    for (const [extRef, cwId] of combinedMap) {
      const existing = existingMap.get(extRef);
      if (existing) {
        if (!(existing.metadata as Record<string, unknown>)?.crunchworkId) {
          await pool.query(`
            UPDATE lookup_values 
            SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{crunchworkId}', $1::jsonb),
                updated_at = NOW()
            WHERE id = $2
          `, [JSON.stringify(cwId), existing.id]);
          updated++;
        }
      } else {
        // Insert new lookup_values row for labels not yet in the DB
        await pool.query(`
          INSERT INTO lookup_values (tenant_id, domain, provider_code, name, external_reference, metadata)
          VALUES ($1, 'group_label', 'crunchwork', $2, $2, $3)
          ON CONFLICT (tenant_id, domain, provider_code, external_reference) DO UPDATE
          SET metadata = jsonb_set(COALESCE(lookup_values.metadata, '{}'::jsonb), '{crunchworkId}', $4::jsonb),
              updated_at = NOW()
        `, [tenantId, extRef, JSON.stringify({ crunchworkId: cwId }), JSON.stringify(cwId)]);
        inserted++;
      }
    }

    console.log(`Updated ${updated} existing rows, inserted ${inserted} new rows`);

    // Step 6: Report final status
    console.log('\n=== Final Status ===');
    const remaining = ALL_GROUP_LABELS.filter(label => !combinedMap.has(label));
    console.log(`Total labels: ${ALL_GROUP_LABELS.length}`);
    console.log(`Resolved: ${combinedMap.size}`);
    console.log(`Still missing: ${remaining.length}`);
    if (remaining.length > 0) {
      console.log('Missing labels:', remaining.join(', '));
    }

    // Print resolved map
    console.log('\n=== Resolved Mappings ===');
    for (const [extRef, cwId] of [...combinedMap].sort((a, b) => a[0].localeCompare(b[0]))) {
      console.log(`  ${extRef} => ${cwId}`);
    }

  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
