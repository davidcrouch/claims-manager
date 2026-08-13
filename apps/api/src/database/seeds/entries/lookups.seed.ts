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
 *   - CLI (`pnpm --filter api run db:seed`) → Ensure Construction, else first org
 *   - api-server `POST /internal/seed-tenant` → given tenant
 */
import { and, eq, isNull } from 'drizzle-orm';
import type { Seed, SeedContext, SeedLogger, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';
import { ENSURE_CONSTRUCTION_SLUG } from './ensure-construction.seed';

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
  { domain: 'job_type', name: 'Builder Assessment', ref: 'job-type-builder-assessment', providerCode: 'direct' },
  { domain: 'job_type', name: 'Builder Make Safe', ref: 'job-type-builder-make-safe', providerCode: 'direct' },
  { domain: 'job_type', name: 'Builder - Scope of Works', ref: 'job-type-builder-scope', providerCode: 'direct' },
  { domain: 'job_type', name: 'Contents', ref: 'job-type-contents', providerCode: 'direct' },
  { domain: 'job_type', name: 'Temporary Accommodation', ref: 'job-type-temporary-accommodation', providerCode: 'direct' },
  { domain: 'job_type', name: 'Specialist', ref: 'job-type-specialist', providerCode: 'direct' },
  { domain: 'job_type', name: 'Rectification Assessment', ref: 'job-type-rectification-assessment', providerCode: 'direct' },
  { domain: 'job_type', name: 'Builder Rectification Work', ref: 'job-type-builder-rectification', providerCode: 'direct' },
  { domain: 'job_type', name: 'Internal Audit', ref: 'job-type-internal-audit', providerCode: 'direct' },
  { domain: 'job_type', name: 'Inspection', ref: 'job-type-inspection', providerCode: 'direct' },
  { domain: 'job_type', name: 'Repair', ref: 'job-type-repair', providerCode: 'direct' },
  { domain: 'job_type', name: 'General', ref: 'job-type-general', providerCode: 'direct' },
  { domain: 'job_type', name: 'Inspection', ref: 'job-type-inspection' },
  { domain: 'job_type', name: 'Repair', ref: 'job-type-repair' },
  { domain: 'job_type', name: 'Make Safe', ref: 'job-type-makesafe' },
  { domain: 'job_status', name: 'Pending', ref: 'job-status-pending' },
  { domain: 'job_status', name: 'Completed', ref: 'job-status-completed' },
  { domain: 'job_status', name: 'Archived', ref: 'job-status-archived' },
  { domain: 'contact_type', name: 'Insured', ref: 'contact-type-insured' },
  { domain: 'contact_type', name: 'Broker', ref: 'contact-type-broker' },
  { domain: 'loss_type', name: 'Storm', ref: 'loss-type-storm' },
  { domain: 'loss_type', name: 'Fire', ref: 'loss-type-fire' },
  { domain: 'loss_type', name: 'Water', ref: 'loss-type-water' },
  { domain: 'quote_status', name: 'Draft', ref: 'quote-status-draft' },
  { domain: 'quote_status', name: 'Pending', ref: 'quote-status-pending' },
  { domain: 'quote_status', name: 'Approved', ref: 'quote-status-approved' },
  { domain: 'quote_status', name: 'Archived', ref: 'quote-status-archived' },
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
  { domain: 'rfq_status', name: 'Sent', ref: 'rfq-status-sent' },
  { domain: 'rfq_status', name: 'Received', ref: 'rfq-status-received' },
  { domain: 'rfq_status', name: 'Closed', ref: 'rfq-status-closed' },
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

async function seedLookups(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
}): Promise<void> {
  for (const spec of LOOKUP_SPECS) {
    const ref = `${LOOKUP_REF_PREFIX}${spec.ref}`;
    const conditions = [
      eq(schema.lookupValues.tenantId, params.tenantId),
      eq(schema.lookupValues.domain, spec.domain),
      eq(schema.lookupValues.externalReference, ref),
    ];
    if (spec.providerCode) {
      conditions.push(eq(schema.lookupValues.providerCode, spec.providerCode));
    } else {
      conditions.push(isNull(schema.lookupValues.providerCode));
    }
    const [existing] = await params.db
      .select({ id: schema.lookupValues.id })
      .from(schema.lookupValues)
      .where(and(...conditions))
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.lookupValues).values({
      tenantId: params.tenantId,
      domain: spec.domain,
      name: spec.name,
      externalReference: ref,
      providerCode: spec.providerCode ?? null,
    });
    params.stats.inserted += 1;
  }
}

async function seedCrunchworkGroupLabels(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
}): Promise<void> {
  for (const name of CW_GROUP_LABELS) {
    const [existing] = await params.db
      .select({ id: schema.lookupValues.id })
      .from(schema.lookupValues)
      .where(
        and(
          eq(schema.lookupValues.tenantId, params.tenantId),
          eq(schema.lookupValues.domain, 'group_label'),
          eq(schema.lookupValues.providerCode, 'crunchwork'),
          eq(schema.lookupValues.externalReference, name),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.lookupValues).values({
      tenantId: params.tenantId,
      domain: 'group_label',
      providerCode: 'crunchwork',
      name,
      externalReference: name,
    });
    params.stats.inserted += 1;
  }
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
  await seedLookups({ db, tenantId, stats });
  logger.info(`lookups ready (${LOOKUP_SPECS.length} specs)`);
  await seedCrunchworkGroupLabels({ db, tenantId, stats });
  logger.info(`crunchwork group labels ready (${CW_GROUP_LABELS.length})`);

  return {
    inserted: stats.inserted,
    updated: 0,
    skipped: stats.skipped,
    notes: `tenant=${tenantId}`,
  };
}

async function resolveTenantId(params: { db: SeedDb }): Promise<string | null> {
  const [named] = await params.db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, ENSURE_CONSTRUCTION_SLUG))
    .limit(1);
  if (named) {
    console.log(`${LOG} tenant=${named.name} (${named.id})`);
    return named.id;
  }
  const [org] = await params.db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .limit(1);
  if (!org) return null;
  console.log(`${LOG} tenant=${org.name} (${org.id})`);
  return org.id;
}

async function run(ctx: SeedContext): Promise<SeedResult> {
  const { db, logger } = ctx;
  const tenantId = await resolveTenantId({ db });
  if (!tenantId) {
    logger.warn('no organizations in DB — nothing to seed');
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }
  return seedLookupsForTenant({ db, tenantId, logger });
}

const seed: Seed = {
  name: 'lookups',
  description:
    'Per-tenant status/type lookups and Crunchwork group labels (idempotent).',
  run,
};

export default seed;
