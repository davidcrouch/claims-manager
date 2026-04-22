/**
 * Sample data seed.
 *
 * Populates the core business tables for the FIRST organization in the DB
 * with ~8 records each, so staging / dev environments have realistic data
 * to click through.
 *
 * Idempotent: every row is tagged with an `external_reference` of the form
 * `seed-<kind>-NN`. Re-running the seed is safe — existing rows are detected
 * and skipped; missing rows are backfilled.
 *
 * Scope (per the README table):
 *   lookup_values, contacts, vendors, claims, jobs,
 *   claim_contacts, claim_assignees, job_contacts,
 *   quotes (+ groups, combos, items),
 *   purchase_orders (+ groups, combos, items),
 *   invoices, tasks, messages, appointments, appointment_attendees,
 *   reports, attachments.
 *
 * Tables intentionally NOT touched:
 *   organizations, users, user_identities, organization_users (owned by auth-server),
 *   integration_connections, external_objects/versions/links (provider sync),
 *   inbound_webhook_events, external_processing_log, external_event_attempts (ingestion).
 */
import { and, eq } from 'drizzle-orm';
import type { Seed, SeedContext, SeedResult } from '../lib/runner';
import type { SeedDb } from '../lib/db';
import * as schema from '../../schema';

const PREFIX = 'seed-';
const COUNT = 8;

const LOG = '[seeds/sample-data]';

interface Stats {
  inserted: number;
  skipped: number;
}

function extRef(kind: string, i: number): string {
  return `${PREFIX}${kind}-${String(i).padStart(2, '0')}`;
}

function pick<T>(items: readonly T[], i: number): T {
  return items[i % items.length];
}

async function resolveTenantId(params: { db: SeedDb }): Promise<string | null> {
  const [org] = await params.db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations)
    .limit(1);
  if (!org) return null;
  console.log(`${LOG} tenant=${org.name} (${org.id})`);
  return org.id;
}

// -----------------------------------------------------------------------
// Lookup values
// -----------------------------------------------------------------------

interface LookupSpec {
  domain: string;
  name: string;
  ref: string;
}

const LOOKUP_SPECS: readonly LookupSpec[] = [
  { domain: 'claim_status', name: 'Open', ref: 'claim-status-open' },
  { domain: 'claim_status', name: 'In Progress', ref: 'claim-status-inprogress' },
  { domain: 'claim_status', name: 'Closed', ref: 'claim-status-closed' },
  { domain: 'job_type', name: 'Inspection', ref: 'job-type-inspection' },
  { domain: 'job_type', name: 'Repair', ref: 'job-type-repair' },
  { domain: 'job_type', name: 'Make Safe', ref: 'job-type-makesafe' },
  { domain: 'job_status', name: 'Pending', ref: 'job-status-pending' },
  { domain: 'job_status', name: 'Completed', ref: 'job-status-completed' },
  { domain: 'contact_type', name: 'Insured', ref: 'contact-type-insured' },
  { domain: 'contact_type', name: 'Broker', ref: 'contact-type-broker' },
  { domain: 'loss_type', name: 'Storm', ref: 'loss-type-storm' },
  { domain: 'loss_type', name: 'Fire', ref: 'loss-type-fire' },
  { domain: 'loss_type', name: 'Water', ref: 'loss-type-water' },
  { domain: 'quote_status', name: 'Draft', ref: 'quote-status-draft' },
  { domain: 'quote_status', name: 'Approved', ref: 'quote-status-approved' },
  { domain: 'po_status', name: 'Issued', ref: 'po-status-issued' },
  { domain: 'invoice_status', name: 'Received', ref: 'invoice-status-received' },
  { domain: 'report_type', name: 'Inspection Report', ref: 'report-type-inspection' },
  { domain: 'appointment_type', name: 'Site Visit', ref: 'appt-type-site' },
  { domain: 'document_type', name: 'Photo', ref: 'doc-type-photo' },
];

async function seedLookups(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
}): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const spec of LOOKUP_SPECS) {
    const ref = `${PREFIX}${spec.ref}`;
    const [existing] = await params.db
      .select({ id: schema.lookupValues.id })
      .from(schema.lookupValues)
      .where(
        and(
          eq(schema.lookupValues.tenantId, params.tenantId),
          eq(schema.lookupValues.domain, spec.domain),
          eq(schema.lookupValues.externalReference, ref),
        ),
      )
      .limit(1);
    if (existing) {
      map[spec.ref] = existing.id;
      params.stats.skipped += 1;
      continue;
    }
    const [row] = await params.db
      .insert(schema.lookupValues)
      .values({
        tenantId: params.tenantId,
        domain: spec.domain,
        name: spec.name,
        externalReference: ref,
      })
      .returning({ id: schema.lookupValues.id });
    map[spec.ref] = row.id;
    params.stats.inserted += 1;
  }
  return map;
}

// -----------------------------------------------------------------------
// Generic upsert-by-external-reference helper (typed per table below)
// -----------------------------------------------------------------------

async function findIdByExtRef(params: {
  db: SeedDb;
  tenantId: string;
  ref: string;
  table: 'contacts' | 'vendors' | 'claims' | 'jobs';
}): Promise<string | null> {
  const { db, tenantId, ref, table } = params;
  switch (table) {
    case 'contacts': {
      const [row] = await db
        .select({ id: schema.contacts.id })
        .from(schema.contacts)
        .where(
          and(
            eq(schema.contacts.tenantId, tenantId),
            eq(schema.contacts.externalReference, ref),
          ),
        )
        .limit(1);
      return row?.id ?? null;
    }
    case 'vendors': {
      const [row] = await db
        .select({ id: schema.vendors.id })
        .from(schema.vendors)
        .where(
          and(
            eq(schema.vendors.tenantId, tenantId),
            eq(schema.vendors.externalReference, ref),
          ),
        )
        .limit(1);
      return row?.id ?? null;
    }
    case 'claims': {
      const [row] = await db
        .select({ id: schema.claims.id })
        .from(schema.claims)
        .where(
          and(
            eq(schema.claims.tenantId, tenantId),
            eq(schema.claims.externalReference, ref),
          ),
        )
        .limit(1);
      return row?.id ?? null;
    }
    case 'jobs': {
      const [row] = await db
        .select({ id: schema.jobs.id })
        .from(schema.jobs)
        .where(
          and(
            eq(schema.jobs.tenantId, tenantId),
            eq(schema.jobs.externalReference, ref),
          ),
        )
        .limit(1);
      return row?.id ?? null;
    }
  }
}

// -----------------------------------------------------------------------
// Contacts
// -----------------------------------------------------------------------

const FIRST_NAMES = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Dakota'];
const LAST_NAMES = ['Brown', 'Nguyen', 'Patel', 'Smith', 'Garcia', 'Jones', 'Wong', 'Fischer'];

async function seedContacts(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
}): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('contact', i);
    const existingId = await findIdByExtRef({
      db: params.db,
      tenantId: params.tenantId,
      ref,
      table: 'contacts',
    });
    if (existingId) {
      ids.push(existingId);
      params.stats.skipped += 1;
      continue;
    }
    const firstName = pick(FIRST_NAMES, i - 1);
    const lastName = pick(LAST_NAMES, i - 1);
    const [row] = await params.db
      .insert(schema.contacts)
      .values({
        tenantId: params.tenantId,
        externalReference: ref,
        firstName,
        lastName,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        mobilePhone: `+61400${String(100_000 + i).slice(-6)}`,
        typeLookupId: params.lookups['contact-type-insured'],
        notes: `Seed contact #${i}`,
      })
      .returning({ id: schema.contacts.id });
    ids.push(row.id);
    params.stats.inserted += 1;
  }
  return ids;
}

// -----------------------------------------------------------------------
// Vendors
// -----------------------------------------------------------------------

async function seedVendors(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
}): Promise<string[]> {
  const ids: string[] = [];
  const cities = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Hobart', 'Canberra', 'Darwin'];
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  const postcodes = ['2000', '3000', '4000', '6000', '5000', '7000', '2600', '0800'];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('vendor', i);
    const existingId = await findIdByExtRef({
      db: params.db,
      tenantId: params.tenantId,
      ref,
      table: 'vendors',
    });
    if (existingId) {
      ids.push(existingId);
      params.stats.skipped += 1;
      continue;
    }
    const [row] = await params.db
      .insert(schema.vendors)
      .values({
        tenantId: params.tenantId,
        externalReference: ref,
        name: `Seed Vendor ${String(i).padStart(2, '0')}`,
        city: pick(cities, i - 1),
        state: pick(states, i - 1),
        postcode: pick(postcodes, i - 1),
        country: 'AU',
        phone: `+6180000${String(i).padStart(4, '0')}`,
      })
      .returning({ id: schema.vendors.id });
    ids.push(row.id);
    params.stats.inserted += 1;
  }
  return ids;
}

// -----------------------------------------------------------------------
// Claims
// -----------------------------------------------------------------------

async function seedClaims(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
}): Promise<string[]> {
  const ids: string[] = [];
  const statuses = ['claim-status-open', 'claim-status-inprogress', 'claim-status-closed'];
  const lossTypes = ['loss-type-storm', 'loss-type-fire', 'loss-type-water'];
  const suburbs = ['Parramatta', 'Fitzroy', 'South Bank', 'Fremantle', 'Glenelg', 'Battery Point', 'Braddon', 'Mitchell'];
  const postcodes = ['2150', '3065', '4101', '6160', '5045', '7004', '2612', '0832'];
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('claim', i);
    const existingId = await findIdByExtRef({
      db: params.db,
      tenantId: params.tenantId,
      ref,
      table: 'claims',
    });
    if (existingId) {
      ids.push(existingId);
      params.stats.skipped += 1;
      continue;
    }
    const lodgement = new Date();
    lodgement.setDate(lodgement.getDate() - i * 3);
    const dateOfLoss = new Date(lodgement);
    dateOfLoss.setDate(dateOfLoss.getDate() - 1);
    const [row] = await params.db
      .insert(schema.claims)
      .values({
        tenantId: params.tenantId,
        externalReference: ref,
        claimNumber: `CLM-SEED-${String(i).padStart(4, '0')}`,
        externalClaimId: `EXT-${ref}`,
        statusLookupId: params.lookups[pick(statuses, i - 1)],
        lossTypeLookupId: params.lookups[pick(lossTypes, i - 1)],
        lodgementDate: lodgement.toISOString().slice(0, 10),
        dateOfLoss,
        addressSuburb: pick(suburbs, i - 1),
        addressState: pick(states, i - 1),
        addressPostcode: pick(postcodes, i - 1),
        addressCountry: 'AU',
        policyNumber: `POL-${String(10_000 + i)}`,
        policyName: `Home & Contents ${i}`,
        vulnerableCustomer: i % 5 === 0,
        totalLoss: false,
        incidentDescription: `Seed claim #${i}: minor damage report for demo purposes.`,
      })
      .returning({ id: schema.claims.id });
    ids.push(row.id);
    params.stats.inserted += 1;
  }
  return ids;
}

// -----------------------------------------------------------------------
// Claim contacts + claim assignees
// -----------------------------------------------------------------------

async function seedClaimContacts(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  claimIds: string[];
  contactIds: string[];
}): Promise<void> {
  for (let i = 0; i < params.claimIds.length; i += 1) {
    const claimId = params.claimIds[i];
    const contactId = params.contactIds[i % params.contactIds.length];
    const [existing] = await params.db
      .select({ id: schema.claimContacts.id })
      .from(schema.claimContacts)
      .where(
        and(
          eq(schema.claimContacts.claimId, claimId),
          eq(schema.claimContacts.contactId, contactId),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.claimContacts).values({
      tenantId: params.tenantId,
      claimId,
      contactId,
      sortIndex: 0,
    });
    params.stats.inserted += 1;
  }
}

async function seedClaimAssignees(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  claimIds: string[];
}): Promise<void> {
  for (let i = 0; i < params.claimIds.length; i += 1) {
    const ref = extRef('assignee', i + 1);
    const [existing] = await params.db
      .select({ id: schema.claimAssignees.id })
      .from(schema.claimAssignees)
      .where(
        and(
          eq(schema.claimAssignees.tenantId, params.tenantId),
          eq(schema.claimAssignees.externalReference, ref),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.claimAssignees).values({
      tenantId: params.tenantId,
      claimId: params.claimIds[i],
      externalReference: ref,
      displayName: `Claims Officer ${i + 1}`,
      email: `officer${i + 1}@example.com`,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Jobs + job contacts
// -----------------------------------------------------------------------

async function seedJobs(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  claimIds: string[];
  vendorIds: string[];
}): Promise<string[]> {
  const ids: string[] = [];
  const jobTypes = ['job-type-inspection', 'job-type-repair', 'job-type-makesafe'];
  const suburbs = ['Parramatta', 'Fitzroy', 'South Bank', 'Fremantle', 'Glenelg', 'Battery Point', 'Braddon', 'Mitchell'];
  const postcodes = ['2150', '3065', '4101', '6160', '5045', '7004', '2612', '0832'];
  const states = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('job', i);
    const existingId = await findIdByExtRef({
      db: params.db,
      tenantId: params.tenantId,
      ref,
      table: 'jobs',
    });
    if (existingId) {
      ids.push(existingId);
      params.stats.skipped += 1;
      continue;
    }
    const requestDate = new Date();
    requestDate.setDate(requestDate.getDate() - i * 2);
    const [row] = await params.db
      .insert(schema.jobs)
      .values({
        tenantId: params.tenantId,
        externalReference: ref,
        claimId: params.claimIds[(i - 1) % params.claimIds.length],
        vendorId: params.vendorIds[(i - 1) % params.vendorIds.length],
        jobTypeLookupId: params.lookups[pick(jobTypes, i - 1)],
        statusLookupId: params.lookups['job-status-pending'],
        requestDate: requestDate.toISOString().slice(0, 10),
        collectExcess: i % 2 === 0,
        excess: i % 2 === 0 ? '500.00' : '0.00',
        makeSafeRequired: i % 3 === 0,
        addressSuburb: pick(suburbs, i - 1),
        addressState: pick(states, i - 1),
        addressPostcode: pick(postcodes, i - 1),
        addressCountry: 'AU',
        jobInstructions: `Seed job #${i}: attend site and complete work as per scope.`,
      })
      .returning({ id: schema.jobs.id });
    ids.push(row.id);
    params.stats.inserted += 1;
  }
  return ids;
}

async function seedJobContacts(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  jobIds: string[];
  contactIds: string[];
}): Promise<void> {
  for (let i = 0; i < params.jobIds.length; i += 1) {
    const jobId = params.jobIds[i];
    const contactId = params.contactIds[i % params.contactIds.length];
    const [existing] = await params.db
      .select({ id: schema.jobContacts.id })
      .from(schema.jobContacts)
      .where(
        and(eq(schema.jobContacts.jobId, jobId), eq(schema.jobContacts.contactId, contactId)),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.jobContacts).values({
      tenantId: params.tenantId,
      jobId,
      contactId,
      sortIndex: 0,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Quotes → groups → combos → items
// -----------------------------------------------------------------------

interface QuoteBundle {
  quoteId: string;
  groupId: string;
  comboId: string;
}

async function seedQuotes(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  claimIds: string[];
  jobIds: string[];
}): Promise<QuoteBundle[]> {
  const out: QuoteBundle[] = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('quote', i);

    let quoteId: string;
    const [existingQuote] = await params.db
      .select({ id: schema.quotes.id })
      .from(schema.quotes)
      .where(
        and(
          eq(schema.quotes.tenantId, params.tenantId),
          eq(schema.quotes.externalReference, ref),
        ),
      )
      .limit(1);

    if (existingQuote) {
      quoteId = existingQuote.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.quotes)
        .values({
          tenantId: params.tenantId,
          externalReference: ref,
          claimId: params.claimIds[(i - 1) % params.claimIds.length],
          jobId: params.jobIds[(i - 1) % params.jobIds.length],
          quoteNumber: `QTE-SEED-${String(i).padStart(4, '0')}`,
          name: `Seed Quote ${i}`,
          reference: ref,
          statusLookupId: params.lookups['quote-status-draft'],
          quoteDate: new Date(),
          expiresInDays: 30,
          subTotal: '1000.00',
          totalTax: '100.00',
          totalAmount: '1100.00',
          quoteToEmail: `quote${i}@example.com`,
          quoteToName: `Recipient ${i}`,
          isAutoApproved: false,
        })
        .returning({ id: schema.quotes.id });
      quoteId = inserted.id;
      params.stats.inserted += 1;
    }

    // One group per quote — idempotency via description tag.
    const groupDesc = `${PREFIX}quote-group-${String(i).padStart(2, '0')}`;
    let groupId: string;
    const [existingGroup] = await params.db
      .select({ id: schema.quoteGroups.id })
      .from(schema.quoteGroups)
      .where(
        and(
          eq(schema.quoteGroups.quoteId, quoteId),
          eq(schema.quoteGroups.description, groupDesc),
        ),
      )
      .limit(1);
    if (existingGroup) {
      groupId = existingGroup.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.quoteGroups)
        .values({
          tenantId: params.tenantId,
          quoteId,
          description: groupDesc,
          sortIndex: 0,
        })
        .returning({ id: schema.quoteGroups.id });
      groupId = inserted.id;
      params.stats.inserted += 1;
    }

    // One combo per group — idempotency via name tag.
    const comboName = `${PREFIX}quote-combo-${String(i).padStart(2, '0')}`;
    let comboId: string;
    const [existingCombo] = await params.db
      .select({ id: schema.quoteCombos.id })
      .from(schema.quoteCombos)
      .where(
        and(
          eq(schema.quoteCombos.quoteGroupId, groupId),
          eq(schema.quoteCombos.name, comboName),
        ),
      )
      .limit(1);
    if (existingCombo) {
      comboId = existingCombo.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.quoteCombos)
        .values({
          tenantId: params.tenantId,
          quoteGroupId: groupId,
          name: comboName,
          description: `Seed combo bundle ${i}`,
          category: 'Labour',
          quantity: '1',
          sortIndex: 0,
        })
        .returning({ id: schema.quoteCombos.id });
      comboId = inserted.id;
      params.stats.inserted += 1;
    }

    // One item under the combo.
    const itemName = `${PREFIX}quote-item-${String(i).padStart(2, '0')}`;
    const [existingItem] = await params.db
      .select({ id: schema.quoteItems.id })
      .from(schema.quoteItems)
      .where(
        and(
          eq(schema.quoteItems.quoteComboId, comboId),
          eq(schema.quoteItems.name, itemName),
        ),
      )
      .limit(1);
    if (existingItem) {
      params.stats.skipped += 1;
    } else {
      await params.db.insert(schema.quoteItems).values({
        tenantId: params.tenantId,
        quoteComboId: comboId,
        name: itemName,
        description: `Seed quote line ${i}`,
        category: 'Labour',
        itemType: 'Labour',
        quantity: '2',
        tax: '0.1',
        unitCost: '500',
        markupType: 'percent',
        markupValue: '10',
        sortIndex: 0,
      });
      params.stats.inserted += 1;
    }

    out.push({ quoteId, groupId, comboId });
  }
  return out;
}

// -----------------------------------------------------------------------
// Purchase orders → groups → combos → items
// -----------------------------------------------------------------------

interface PurchaseOrderBundle {
  purchaseOrderId: string;
  groupId: string;
  comboId: string;
}

async function seedPurchaseOrders(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  claimIds: string[];
  jobIds: string[];
  vendorIds: string[];
  quoteBundles: QuoteBundle[];
}): Promise<PurchaseOrderBundle[]> {
  const out: PurchaseOrderBundle[] = [];
  for (let i = 1; i <= COUNT; i += 1) {
    const ref = extRef('po', i);

    let poId: string;
    const [existing] = await params.db
      .select({ id: schema.purchaseOrders.id })
      .from(schema.purchaseOrders)
      .where(
        and(
          eq(schema.purchaseOrders.tenantId, params.tenantId),
          eq(schema.purchaseOrders.externalId, ref),
        ),
      )
      .limit(1);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + i);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 5);

    if (existing) {
      poId = existing.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.purchaseOrders)
        .values({
          tenantId: params.tenantId,
          externalId: ref,
          claimId: params.claimIds[(i - 1) % params.claimIds.length],
          jobId: params.jobIds[(i - 1) % params.jobIds.length],
          vendorId: params.vendorIds[(i - 1) % params.vendorIds.length],
          quoteId: params.quoteBundles[(i - 1) % params.quoteBundles.length]?.quoteId,
          purchaseOrderNumber: `PO-SEED-${String(i).padStart(4, '0')}`,
          name: `Seed PO ${i}`,
          statusLookupId: params.lookups['po-status-issued'],
          startDate: startDate.toISOString().slice(0, 10),
          endDate: endDate.toISOString().slice(0, 10),
          totalAmount: '1100.00',
          poToEmail: `vendor${i}@example.com`,
          poForName: `Recipient ${i}`,
        })
        .returning({ id: schema.purchaseOrders.id });
      poId = inserted.id;
      params.stats.inserted += 1;
    }

    const groupDesc = `${PREFIX}po-group-${String(i).padStart(2, '0')}`;
    let groupId: string;
    const [existingGroup] = await params.db
      .select({ id: schema.purchaseOrderGroups.id })
      .from(schema.purchaseOrderGroups)
      .where(
        and(
          eq(schema.purchaseOrderGroups.purchaseOrderId, poId),
          eq(schema.purchaseOrderGroups.description, groupDesc),
        ),
      )
      .limit(1);
    if (existingGroup) {
      groupId = existingGroup.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.purchaseOrderGroups)
        .values({
          tenantId: params.tenantId,
          purchaseOrderId: poId,
          description: groupDesc,
          sortIndex: 0,
        })
        .returning({ id: schema.purchaseOrderGroups.id });
      groupId = inserted.id;
      params.stats.inserted += 1;
    }

    const comboName = `${PREFIX}po-combo-${String(i).padStart(2, '0')}`;
    let comboId: string;
    const [existingCombo] = await params.db
      .select({ id: schema.purchaseOrderCombos.id })
      .from(schema.purchaseOrderCombos)
      .where(
        and(
          eq(schema.purchaseOrderCombos.purchaseOrderGroupId, groupId),
          eq(schema.purchaseOrderCombos.name, comboName),
        ),
      )
      .limit(1);
    if (existingCombo) {
      comboId = existingCombo.id;
      params.stats.skipped += 1;
    } else {
      const [inserted] = await params.db
        .insert(schema.purchaseOrderCombos)
        .values({
          tenantId: params.tenantId,
          purchaseOrderGroupId: groupId,
          name: comboName,
          description: `Seed PO combo bundle ${i}`,
          category: 'Labour',
          quantity: '1',
          sortIndex: 0,
        })
        .returning({ id: schema.purchaseOrderCombos.id });
      comboId = inserted.id;
      params.stats.inserted += 1;
    }

    const itemName = `${PREFIX}po-item-${String(i).padStart(2, '0')}`;
    const [existingItem] = await params.db
      .select({ id: schema.purchaseOrderItems.id })
      .from(schema.purchaseOrderItems)
      .where(
        and(
          eq(schema.purchaseOrderItems.purchaseOrderComboId, comboId),
          eq(schema.purchaseOrderItems.name, itemName),
        ),
      )
      .limit(1);
    if (existingItem) {
      params.stats.skipped += 1;
    } else {
      await params.db.insert(schema.purchaseOrderItems).values({
        tenantId: params.tenantId,
        purchaseOrderComboId: comboId,
        name: itemName,
        description: `Seed PO line ${i}`,
        category: 'Labour',
        itemType: 'Labour',
        quantity: '2',
        tax: '0.1',
        unitCost: '500',
        markupType: 'percent',
        markupValue: '10',
        sortIndex: 0,
      });
      params.stats.inserted += 1;
    }

    out.push({ purchaseOrderId: poId, groupId, comboId });
  }
  return out;
}

// -----------------------------------------------------------------------
// Invoices
// -----------------------------------------------------------------------

async function seedInvoices(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  purchaseOrderBundles: PurchaseOrderBundle[];
  claimIds: string[];
  jobIds: string[];
}): Promise<void> {
  for (let i = 1; i <= COUNT; i += 1) {
    const invoiceNumber = `INV-SEED-${String(i).padStart(4, '0')}`;
    const po = params.purchaseOrderBundles[(i - 1) % params.purchaseOrderBundles.length];
    const [existing] = await params.db
      .select({ id: schema.invoices.id })
      .from(schema.invoices)
      .where(
        and(
          eq(schema.invoices.tenantId, params.tenantId),
          eq(schema.invoices.purchaseOrderId, po.purchaseOrderId),
          eq(schema.invoices.invoiceNumber, invoiceNumber),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.invoices).values({
      tenantId: params.tenantId,
      purchaseOrderId: po.purchaseOrderId,
      claimId: params.claimIds[(i - 1) % params.claimIds.length],
      jobId: params.jobIds[(i - 1) % params.jobIds.length],
      invoiceNumber,
      issueDate: new Date(),
      receivedDate: new Date(),
      statusLookupId: params.lookups['invoice-status-received'],
      subTotal: '1000.00',
      totalTax: '100.00',
      totalAmount: '1100.00',
      excessAmount: '0.00',
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Tasks
// -----------------------------------------------------------------------

async function seedTasks(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  claimIds: string[];
  jobIds: string[];
}): Promise<void> {
  const priorities = ['Low', 'Medium', 'High', 'Critical'] as const;
  const statuses = ['Open', 'Completed'] as const;
  for (let i = 1; i <= COUNT; i += 1) {
    const name = `${PREFIX}task-${String(i).padStart(2, '0')}`;
    const claimId = params.claimIds[(i - 1) % params.claimIds.length];
    const [existing] = await params.db
      .select({ id: schema.tasks.id })
      .from(schema.tasks)
      .where(
        and(
          eq(schema.tasks.tenantId, params.tenantId),
          eq(schema.tasks.name, name),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    const due = new Date();
    due.setDate(due.getDate() + i * 2);
    await params.db.insert(schema.tasks).values({
      tenantId: params.tenantId,
      claimId,
      jobId: i % 2 === 0 ? params.jobIds[(i - 1) % params.jobIds.length] : null,
      name,
      description: `Seed task #${i}: follow-up action required.`,
      dueDate: due,
      priority: pick(priorities, i - 1),
      status: pick(statuses, i - 1),
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Messages
// -----------------------------------------------------------------------

async function seedMessages(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  claimIds: string[];
  jobIds: string[];
}): Promise<void> {
  for (let i = 1; i <= COUNT; i += 1) {
    const subject = `${PREFIX}message-${String(i).padStart(2, '0')}`;
    const [existing] = await params.db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.tenantId, params.tenantId),
          eq(schema.messages.subject, subject),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    const fromClaimId = params.claimIds[(i - 1) % params.claimIds.length];
    const toClaimId = params.claimIds[i % params.claimIds.length];
    await params.db.insert(schema.messages).values({
      tenantId: params.tenantId,
      fromClaimId,
      fromJobId: i % 2 === 0 ? params.jobIds[(i - 1) % params.jobIds.length] : null,
      toClaimId,
      subject,
      body: `Seed message body #${i}. This is demo content.`,
      acknowledgementRequired: i % 3 === 0,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Appointments + attendees
// -----------------------------------------------------------------------

async function seedAppointments(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  jobIds: string[];
  contactIds: string[];
}): Promise<void> {
  const locations = ['ONSITE', 'DIGITAL'] as const;
  for (let i = 1; i <= COUNT; i += 1) {
    const name = `${PREFIX}appointment-${String(i).padStart(2, '0')}`;
    const [existing] = await params.db
      .select({ id: schema.appointments.id })
      .from(schema.appointments)
      .where(
        and(
          eq(schema.appointments.tenantId, params.tenantId),
          eq(schema.appointments.name, name),
        ),
      )
      .limit(1);

    let appointmentId: string;
    if (existing) {
      appointmentId = existing.id;
      params.stats.skipped += 1;
    } else {
      const start = new Date();
      start.setDate(start.getDate() + i);
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(10, 0, 0, 0);
      const [inserted] = await params.db
        .insert(schema.appointments)
        .values({
          tenantId: params.tenantId,
          jobId: params.jobIds[(i - 1) % params.jobIds.length],
          name,
          location: pick(locations, i - 1),
          startDate: start,
          endDate: end,
          status: 'Scheduled',
        })
        .returning({ id: schema.appointments.id });
      appointmentId = inserted.id;
      params.stats.inserted += 1;
    }

    const contactId = params.contactIds[(i - 1) % params.contactIds.length];
    const [existingAttendee] = await params.db
      .select({ id: schema.appointmentAttendees.id })
      .from(schema.appointmentAttendees)
      .where(
        and(
          eq(schema.appointmentAttendees.appointmentId, appointmentId),
          eq(schema.appointmentAttendees.contactId, contactId),
        ),
      )
      .limit(1);
    if (existingAttendee) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.appointmentAttendees).values({
      tenantId: params.tenantId,
      appointmentId,
      attendeeType: 'CONTACT',
      contactId,
      email: `attendee${i}@example.com`,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Reports
// -----------------------------------------------------------------------

async function seedReports(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  claimIds: string[];
  jobIds: string[];
}): Promise<void> {
  for (let i = 1; i <= COUNT; i += 1) {
    const reference = `${PREFIX}report-${String(i).padStart(2, '0')}`;
    const [existing] = await params.db
      .select({ id: schema.reports.id })
      .from(schema.reports)
      .where(
        and(
          eq(schema.reports.tenantId, params.tenantId),
          eq(schema.reports.reference, reference),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.reports).values({
      tenantId: params.tenantId,
      claimId: params.claimIds[(i - 1) % params.claimIds.length],
      jobId: params.jobIds[(i - 1) % params.jobIds.length],
      reportTypeLookupId: params.lookups['report-type-inspection'],
      title: `Seed Inspection Report ${i}`,
      reference,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Attachments (attached to claims)
// -----------------------------------------------------------------------

async function seedAttachments(params: {
  db: SeedDb;
  tenantId: string;
  stats: Stats;
  lookups: Record<string, string>;
  claimIds: string[];
}): Promise<void> {
  for (let i = 1; i <= COUNT; i += 1) {
    const title = `${PREFIX}attachment-${String(i).padStart(2, '0')}`;
    const claimId = params.claimIds[(i - 1) % params.claimIds.length];
    const [existing] = await params.db
      .select({ id: schema.attachments.id })
      .from(schema.attachments)
      .where(
        and(
          eq(schema.attachments.tenantId, params.tenantId),
          eq(schema.attachments.relatedRecordId, claimId),
          eq(schema.attachments.title, title),
        ),
      )
      .limit(1);
    if (existing) {
      params.stats.skipped += 1;
      continue;
    }
    await params.db.insert(schema.attachments).values({
      tenantId: params.tenantId,
      relatedRecordType: 'Claim',
      relatedRecordId: claimId,
      documentTypeLookupId: params.lookups['doc-type-photo'],
      title,
      description: `Seed attachment #${i}`,
      fileName: `seed-${i}.jpg`,
      mimeType: 'image/jpeg',
      fileSize: 102_400 + i,
      storageProvider: 'seed',
      storageKey: `seeds/${title}.jpg`,
    });
    params.stats.inserted += 1;
  }
}

// -----------------------------------------------------------------------
// Seed definition
// -----------------------------------------------------------------------

async function run(ctx: SeedContext): Promise<SeedResult> {
  const { db, logger } = ctx;
  const stats: Stats = { inserted: 0, skipped: 0 };

  const tenantId = await resolveTenantId({ db });
  if (!tenantId) {
    logger.warn('no organizations in DB — nothing to seed');
    return { inserted: 0, updated: 0, skipped: 0, notes: 'no tenant' };
  }

  const lookups = await seedLookups({ db, tenantId, stats });
  logger.info(`lookups ready (${Object.keys(lookups).length})`);

  const contactIds = await seedContacts({ db, tenantId, stats, lookups });
  const vendorIds = await seedVendors({ db, tenantId, stats });
  const claimIds = await seedClaims({ db, tenantId, stats, lookups });

  await seedClaimContacts({ db, tenantId, stats, claimIds, contactIds });
  await seedClaimAssignees({ db, tenantId, stats, claimIds });

  const jobIds = await seedJobs({ db, tenantId, stats, lookups, claimIds, vendorIds });
  await seedJobContacts({ db, tenantId, stats, jobIds, contactIds });

  const quoteBundles = await seedQuotes({ db, tenantId, stats, lookups, claimIds, jobIds });
  const purchaseOrderBundles = await seedPurchaseOrders({
    db,
    tenantId,
    stats,
    lookups,
    claimIds,
    jobIds,
    vendorIds,
    quoteBundles,
  });

  await seedInvoices({ db, tenantId, stats, lookups, purchaseOrderBundles, claimIds, jobIds });
  await seedTasks({ db, tenantId, stats, claimIds, jobIds });
  await seedMessages({ db, tenantId, stats, claimIds, jobIds });
  await seedAppointments({ db, tenantId, stats, jobIds, contactIds });
  await seedReports({ db, tenantId, stats, lookups, claimIds, jobIds });
  await seedAttachments({ db, tenantId, stats, lookups, claimIds });

  return {
    inserted: stats.inserted,
    updated: 0,
    skipped: stats.skipped,
    notes: `tenant=${tenantId}`,
  };
}

const seed: Seed = {
  name: 'sample-data',
  description: `Insert ~${COUNT} rows per core business table for the first organization (idempotent via external_reference='${PREFIX}*').`,
  run,
};

export default seed;
