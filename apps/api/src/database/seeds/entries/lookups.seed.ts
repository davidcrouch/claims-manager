/**
 * Reference lookups seed.
 *
 * Per-tenant status / type / group-label rows the UI and job-create
 * flow depend on. Extracted from the former sample-data seed so demo
 * claims/jobs can go away without dropping required catalogue values.
 *
 * Idempotent via (tenant, domain, provider_code, external_reference).
 *
 * Callers:
 *   - CLI (`pnpm --filter api run db:seed`) → every organisation
 *   - Cloud Run job `seed-api-lookups` (`node dist/database/run-seed-lookups.js`) → every organisation
 *   - api-server `POST /internal/seed-tenant` → given tenant
 *   - first-login provisioning (`seed_lookups` step) → given tenant
 */
import { eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

export const LOOKUP_REF_PREFIX = 'seed-';

const LOG = '[seeds/lookups]';

interface LookupSpec {
  domain: string;
  name: string;
  ref: string;
  providerCode?: string;
}

const LOOKUP_SPECS: readonly LookupSpec[] = [
  { domain: 'claim_status', name: 'Open', ref: 'claim-status-open' },
  { domain: 'claim_status', name: 'In Progress', ref: 'claim-status-inprogress' },
  { domain: 'claim_status', name: 'Closed', ref: 'claim-status-closed' },
  { domain: 'claim_status', name: 'Archived', ref: 'claim-status-archived' },
  // Internal (direct) — Create Job Internal catalog
  { domain: 'job_type', name: 'General', ref: 'job-type-general', providerCode: 'direct' },
  { domain: 'job_type', name: 'Repair', ref: 'job-type-repair', providerCode: 'direct' },
  { domain: 'job_type', name: 'Remodel', ref: 'job-type-remodel', providerCode: 'direct' },
  { domain: 'job_type', name: 'New Construction', ref: 'job-type-new-construction', providerCode: 'direct' },
  // Crunchwork — users may only create Builder Make Safe; CW may sync more types later
  { domain: 'job_type', name: 'Builder Assessment', ref: 'job-type-ba', providerCode: 'crunchwork' },
  { domain: 'job_type', name: 'Builder Make Safe', ref: 'job-type-ms', providerCode: 'crunchwork' },
  { domain: 'job_type', name: 'Builder Works', ref: 'job-type-bw', providerCode: 'crunchwork' },
  { domain: 'job_status', name: 'Pending', ref: 'job-status-pending' },
  { domain: 'job_status', name: 'Completed', ref: 'job-status-completed' },
  { domain: 'job_status', name: 'Archived', ref: 'job-status-archived' },
  { domain: 'contact_type', name: 'Customer', ref: 'contact-type-insured' },
  { domain: 'contact_type', name: 'Broker', ref: 'contact-type-broker' },
  { domain: 'contact_type', name: 'Insurer', ref: 'contact-type-insurer' },
  { domain: 'contact_type', name: 'Vendor', ref: 'contact-type-vendor' },
  { domain: 'contact_type', name: 'Other', ref: 'contact-type-other' },
  { domain: 'loss_type', name: 'Storm', ref: 'loss-type-storm' },
  { domain: 'loss_type', name: 'Fire', ref: 'loss-type-fire' },
  { domain: 'loss_type', name: 'Water', ref: 'loss-type-water' },
  { domain: 'quote_status', name: 'Draft', ref: 'quote-status-draft' },
  { domain: 'quote_status', name: 'Pending', ref: 'quote-status-pending' },
  { domain: 'quote_status', name: 'Approved', ref: 'quote-status-approved' },
  { domain: 'quote_status', name: 'Archived', ref: 'quote-status-archived' },
  { domain: 'line_scope_status', name: 'Pending', ref: 'line-scope-pending' },
  { domain: 'line_scope_status', name: 'Accepted', ref: 'line-scope-accepted' },
  { domain: 'line_scope_status', name: 'Rejected', ref: 'line-scope-rejected' },
  { domain: 'line_scope_status', name: 'Amended', ref: 'line-scope-amended' },
  { domain: 'line_scope_status', name: 'Referred', ref: 'line-scope-referred' },
  { domain: 'purchase_order_status', name: 'Issued', ref: 'po-status-issued' },
  { domain: 'purchase_order_status', name: 'Archived', ref: 'purchase-order-status-archived' },
  { domain: 'invoice_status', name: 'Received', ref: 'invoice-status-received' },
  { domain: 'invoice_status', name: 'Archived', ref: 'invoice-status-archived' },
  { domain: 'report_status', name: 'Draft', ref: 'report-status-draft' },
  { domain: 'report_status', name: 'Archived', ref: 'report-status-archived' },
  { domain: 'report_type', name: 'Inspection Report', ref: 'report-type-inspection' },
  { domain: 'appointment_type', name: 'Site Visit', ref: 'appt-type-site' },
  { domain: 'document_type', name: 'Photo', ref: 'doc-type-photo' },
  { domain: 'work_order_status', name: 'Draft', ref: 'wo-status-draft' },
  { domain: 'work_order_status', name: 'Active', ref: 'wo-status-active' },
  { domain: 'work_order_status', name: 'Completed', ref: 'wo-status-completed' },
  { domain: 'work_order_status', name: 'Archived', ref: 'wo-status-archived' },
  { domain: 'wo_type', name: 'Standard', ref: 'wo-type-standard' },
  { domain: 'rfq_status', name: 'Draft', ref: 'rfq-status-draft' },
  { domain: 'rfq_status', name: 'Sent', ref: 'rfq-status-sent' },
  { domain: 'rfq_status', name: 'Responded', ref: 'rfq-status-responded' },
  { domain: 'rfq_status', name: 'Received', ref: 'rfq-status-received' },
  { domain: 'rfq_status', name: 'Closed', ref: 'rfq-status-closed' },
  { domain: 'rfq_status', name: 'Cancelled', ref: 'rfq-status-cancelled' },
  { domain: 'rfq_status', name: 'Expired', ref: 'rfq-status-expired' },
  { domain: 'rfq_status', name: 'Archived', ref: 'rfq-status-archived' },
  { domain: 'proposal_status', name: 'Received', ref: 'proposal-status-received' },
  { domain: 'proposal_status', name: 'Under Review', ref: 'proposal-status-review' },
  { domain: 'proposal_status', name: 'Accepted', ref: 'proposal-status-accepted' },
  { domain: 'proposal_status', name: 'Archived', ref: 'proposal-status-archived' },
  { domain: 'proposal_type', name: 'Standard', ref: 'proposal-type-standard' },
  { domain: 'bill_status', name: 'Received', ref: 'bill-status-received' },
  { domain: 'bill_status', name: 'Approved', ref: 'bill-status-approved' },
  { domain: 'bill_status', name: 'Archived', ref: 'bill-status-archived' },
  { domain: 'bill_payment_status', name: 'Unpaid', ref: 'bill-pay-unpaid' },
  { domain: 'bill_payment_status', name: 'Paid', ref: 'bill-pay-paid' },
  { domain: 'bill_payment_status', name: 'Partial', ref: 'bill-pay-partial' },
];

/**
 * Crunchwork Insurance REST lookup codes observed on inbound claim payloads.
 * `externalReference` is the CW code (not the seed- prefixed internal catalogue).
 * Kept separate so LOOKUP_SPECS can stay prefixed for direct/manual flows.
 */
/** Vendor-set line scope statuses sent to Crunchwork via lineScopeStatus.externalReference. */
const CW_LINE_SCOPE_STATUSES: ReadonlyArray<{
  domain: string;
  name: string;
  externalReference: string;
}> = [
  { domain: 'line_scope_status', name: 'Draft', externalReference: 'Draft' },
  { domain: 'line_scope_status', name: 'Cash Settled', externalReference: 'Cash Settled' },
];

const CW_CLAIM_LOOKUPS: ReadonlyArray<{
  domain: string;
  name: string;
  externalReference: string;
}> = [
  { domain: 'claim_status', name: 'Open', externalReference: 'open' },
  { domain: 'claim_status', name: 'Closed Complete', externalReference: 'closedComplete' },
  { domain: 'claim_status', name: 'Closed Cancelled', externalReference: 'closedCancelled' },
  { domain: 'loss_type', name: 'Fire', externalReference: 'Fire' },
  { domain: 'loss_type', name: 'Storm/ Flood/ Earthquake', externalReference: 'Storm' },
  { domain: 'loss_type', name: 'Glass', externalReference: 'Glass Breakage' },
  { domain: 'loss_type', name: 'Accidental Damage/ Loss', externalReference: 'Accidental Damage' },
  { domain: 'loss_type', name: 'Water Damage - Non Storm', externalReference: 'Water/Liquid Damage' },
  { domain: 'loss_type', name: 'Fusion', externalReference: 'Lightning' },
  { domain: 'loss_type', name: 'Impact', externalReference: 'Impact' },
];

const CW_GROUP_LABELS: readonly string[] = [
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

interface Stats {
  inserted: number;
  skipped: number;
}

function lookupKey(params: {
  domain: string;
  providerCode: string | null;
  externalReference: string | null;
}): string {
  return `${params.domain}\0${params.providerCode ?? ''}\0${params.externalReference ?? ''}`;
}

async function loadExistingKeys(params: {
  db: SeedDb;
  tenantId: string;
}): Promise<Set<string>> {
  const rows = await params.db
    .select({
      domain: schema.lookupValues.domain,
      providerCode: schema.lookupValues.providerCode,
      externalReference: schema.lookupValues.externalReference,
    })
    .from(schema.lookupValues)
    .where(eq(schema.lookupValues.tenantId, params.tenantId));
  return new Set(
    rows.map((row) =>
      lookupKey({
        domain: row.domain,
        providerCode: row.providerCode,
        externalReference: row.externalReference,
      }),
    ),
  );
}

async function insertMissing(
  params: {
    db: SeedDb;
    tenantId: string;
    stats: Stats;
    existing: Set<string>;
  },
  rows: Array<{
    domain: string;
    name: string;
    externalReference: string;
    providerCode: string | null;
  }>,
): Promise<void> {
  const toInsert = rows.filter((row) => {
    const key = lookupKey(row);
    if (params.existing.has(key)) {
      params.stats.skipped += 1;
      return false;
    }
    params.existing.add(key);
    return true;
  });
  if (toInsert.length === 0) return;
  await params.db
    .insert(schema.lookupValues)
    .values(
      toInsert.map((row) => ({
        tenantId: params.tenantId,
        domain: row.domain,
        name: row.name,
        externalReference: row.externalReference,
        providerCode: row.providerCode,
      })),
    )
    .onConflictDoNothing();
  params.stats.inserted += toInsert.length;
}

export async function seedLookupsForTenant(params: {
  db: SeedDb;
  tenantId: string;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db, tenantId } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const stats: Stats = { inserted: 0, skipped: 0 };
  const existing = await loadExistingKeys({ db, tenantId });
  await insertMissing(
    { db, tenantId, stats, existing },
    LOOKUP_SPECS.map((spec) => ({
      domain: spec.domain,
      name: spec.name,
      externalReference: `${LOOKUP_REF_PREFIX}${spec.ref}`,
      providerCode: spec.providerCode ?? null,
    })),
  );
  logger.info(`lookups ready (${LOOKUP_SPECS.length} specs)`);
  await insertMissing(
    { db, tenantId, stats, existing },
    CW_CLAIM_LOOKUPS.map((spec) => ({
      domain: spec.domain,
      name: spec.name,
      externalReference: spec.externalReference,
      providerCode: 'crunchwork',
    })),
  );
  logger.info(`crunchwork claim lookups ready (${CW_CLAIM_LOOKUPS.length})`);
  await insertMissing(
    { db, tenantId, stats, existing },
    CW_GROUP_LABELS.map((name) => ({
      domain: 'group_label',
      name,
      externalReference: name,
      providerCode: 'crunchwork',
    })),
  );
  logger.info(`crunchwork group labels ready (${CW_GROUP_LABELS.length})`);
  await insertMissing(
    { db, tenantId, stats, existing },
    CW_LINE_SCOPE_STATUSES.map((spec) => ({
      domain: spec.domain,
      name: spec.name,
      externalReference: spec.externalReference,
      providerCode: 'crunchwork',
    })),
  );
  logger.info(`crunchwork line scope statuses ready (${CW_LINE_SCOPE_STATUSES.length})`);

  return {
    inserted: stats.inserted,
    updated: 0,
    skipped: stats.skipped,
    notes: `tenant=${tenantId}`,
  };
}

export async function seedLookupsForAllTenants(params: {
  db: SeedDb;
  logger?: SeedLogger;
}): Promise<SeedResult> {
  const { db } = params;
  const logger: SeedLogger = params.logger ?? {
    info: (msg) => console.log(`${LOG} ${msg}`),
    warn: (msg) => console.warn(`${LOG} ${msg}`),
    error: (msg) => console.error(`${LOG} ${msg}`),
  };

  const orgs = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      subscriptionStatus: schema.organizations.subscriptionStatus,
    })
    .from(schema.organizations);

  const tenants = orgs.filter((org) => org.subscriptionStatus !== 'ghost');
  if (tenants.length === 0) {
    logger.warn('no organisations in DB — nothing to seed');
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }

  const totals: SeedResult = { inserted: 0, updated: 0, skipped: 0 };
  for (const org of tenants) {
    logger.info(`tenant=${org.name} (${org.id})`);
    const result = await seedLookupsForTenant({ db, tenantId: org.id, logger });
    totals.inserted += result.inserted;
    totals.updated += result.updated;
    totals.skipped += result.skipped;
  }
  totals.notes = `tenants=${tenants.length}`;
  return totals;
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  return seedLookupsForAllTenants({ db: ctx.db, logger: ctx.logger });
}

const seed: Seed = {
  name: 'lookups',
  description:
    'Per-tenant status/type lookups and Crunchwork group labels (idempotent).',
  run,
};

export default seed;
