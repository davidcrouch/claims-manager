import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  time,
  bigint,
  jsonb,
  uniqueIndex,
  unique,
  index,
  check,
  primaryKey,
  customType,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

const vector = customType<{ data: number[]; driverParam: string }>({
  dataType() {
    return 'vector(768)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map(Number);
  },
});

// Lookup values
export const lookupValues = pgTable(
  'lookup_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    domain: text('domain').notNull(),
    providerCode: text('provider_code'),
    name: text('name'),
    externalReference: text('external_reference'),
    metadata: jsonb('metadata').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_lookup_tenant_domain_provider_extref').on(t.tenantId, t.domain, t.providerCode, t.externalReference),
    index('idx_lookup_values_domain').on(t.tenantId, t.domain),
  ],
);

// External reference resolution log
export const externalReferenceResolutionLog = pgTable('external_reference_resolution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  domain: text('domain').notNull(),
  externalReference: text('external_reference').notNull(),
  sourceEntity: text('source_entity'),
  sourceEntityId: uuid('source_entity_id'),
  resolutionAction: text('resolution_action').notNull(),
  matchedLookupId: uuid('matched_lookup_id').references(() => lookupValues.id),
  details: jsonb('details').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Contacts
export const contacts = pgTable(
  'contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    externalReference: text('external_reference'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    email: text('email'),
    mobilePhone: text('mobile_phone'),
    homePhone: text('home_phone'),
    workPhone: text('work_phone'),
    typeLookupId: uuid('type_lookup_id').references(() => lookupValues.id),
    preferredContactMethodLookupId: uuid('preferred_contact_method_lookup_id').references(
      () => lookupValues.id,
    ),
    notes: text('notes'),
    contactPayload: jsonb('contact_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_contacts_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_contacts_email').on(t.tenantId, t.email),
    index('idx_contacts_mobile').on(t.tenantId, t.mobilePhone),
  ],
);

// Claims
export const claims = pgTable(
  'claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimNumber: text('claim_number'),
    externalReference: text('external_reference'),
    externalClaimId: text('external_claim_id'),
    accountLookupId: uuid('account_lookup_id').references(() => lookupValues.id),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    catCodeLookupId: uuid('cat_code_lookup_id').references(() => lookupValues.id),
    lossTypeLookupId: uuid('loss_type_lookup_id').references(() => lookupValues.id),
    lossSubtypeLookupId: uuid('loss_subtype_lookup_id').references(() => lookupValues.id),
    claimDecisionLookupId: uuid('claim_decision_lookup_id'),
    priorityLookupId: uuid('priority_lookup_id'),
    policyTypeLookupId: uuid('policy_type_lookup_id'),
    lineOfBusinessLookupId: uuid('line_of_business_lookup_id'),
    lodgementDate: date('lodgement_date'),
    dateOfLoss: timestamp('date_of_loss', { withTimezone: true }),
    address: jsonb('address').notNull().default({}),
    policyDetails: jsonb('policy_details').notNull().default({}),
    financialDetails: jsonb('financial_details').notNull().default({}),
    vulnerabilityDetails: jsonb('vulnerability_details').notNull().default({}),
    contentionDetails: jsonb('contention_details').notNull().default({}),
    addressPostcode: text('address_postcode'),
    addressSuburb: text('address_suburb'),
    addressState: text('address_state'),
    addressCountry: text('address_country'),
    addressLatitude: numeric('address_latitude', { precision: 10, scale: 7 }),
    addressLongitude: numeric('address_longitude', { precision: 10, scale: 7 }),
    policyNumber: text('policy_number'),
    policyName: text('policy_name'),
    abn: text('abn'),
    vulnerableCustomer: boolean('vulnerable_customer'),
    totalLoss: boolean('total_loss'),
    contentiousClaim: boolean('contentious_claim'),
    contentiousActivityFlag: boolean('contentious_activity_flag'),
    autoApprovalApplies: boolean('auto_approval_applies'),
    contentsDamaged: boolean('contents_damaged'),
    incidentDescription: text('incident_description'),
    postalAddress: text('postal_address'),
    customData: jsonb('custom_data').notNull().default({}),
    apiPayload: jsonb('api_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_claims_tenant_number').on(t.tenantId, t.claimNumber),
    uniqueIndex('UQ_claims_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_claims_extref').on(t.tenantId, t.externalReference),
    index('idx_claims_status').on(t.tenantId, t.statusLookupId),
    index('idx_claims_postcode').on(t.tenantId, t.addressPostcode),
  ],
);

// Claim contacts
export const claimContacts = pgTable(
  'claim_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    sortIndex: integer('sort_index').notNull().default(0),
    visibility: text('visibility').notNull().default('org'),
    createdByUserId: text('created_by_user_id'),
    sourcePayload: jsonb('source_payload').notNull().default({}),
  },
  (t) => [uniqueIndex('UQ_claim_contact').on(t.claimId, t.contactId)],
);

// Claim assignees
export const claimAssignees = pgTable('claim_assignees', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
  claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
  assigneeTypeLookupId: uuid('assignee_type_lookup_id'),
  userId: text('user_id'),
  externalReference: text('external_reference'),
  displayName: text('display_name'),
  email: text('email'),
  assigneePayload: jsonb('assignee_payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Vendors
export const vendors = pgTable(
  'vendors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    externalReference: text('external_reference'),
    address: jsonb('address').notNull().default({}),
    contactDetails: jsonb('contact_details').notNull().default({}),
    vendorPayload: jsonb('vendor_payload').notNull().default({}),
    postcode: text('postcode'),
    state: text('state'),
    city: text('city'),
    country: text('country'),
    phone: text('phone'),
    afterHoursPhone: text('after_hours_phone'),
    organisationId: uuid('organisation_id').references(() => organizations.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_vendors_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_vendors_postcode').on(t.tenantId, t.postcode),
    index('idx_vendors_organisation').on(t.organisationId),
  ],
);

// Jobs
export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    parentClaimId: uuid('parent_claim_id'),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    connectionId: uuid('connection_id').references(() => integrationConnections.id),
    parentJobId: uuid('parent_job_id').references((): AnyPgColumn => jobs.id),
    name: text('name'),
    internalNumber: text('internal_number'),
    externalReference: text('external_reference'),
    externalJobId: text('external_job_id'),
    jobTypeLookupId: uuid('job_type_lookup_id').notNull().references(() => lookupValues.id),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    requestDate: date('request_date'),
    collectExcess: boolean('collect_excess'),
    excess: numeric('excess', { precision: 14, scale: 2 }),
    makeSafeRequired: boolean('make_safe_required'),
    address: jsonb('address').notNull().default({}),
    vendorSnapshot: jsonb('vendor_snapshot').notNull().default({}),
    temporaryAccommodationDetails: jsonb('temporary_accommodation_details').notNull().default({}),
    specialistDetails: jsonb('specialist_details').notNull().default({}),
    rectificationDetails: jsonb('rectification_details').notNull().default({}),
    auditDetails: jsonb('audit_details').notNull().default({}),
    mobilityConsiderations: jsonb('mobility_considerations').notNull().default([]),
    addressPostcode: text('address_postcode'),
    addressSuburb: text('address_suburb'),
    addressState: text('address_state'),
    addressCountry: text('address_country'),
    jobInstructions: text('job_instructions'),
    syncStatus: text('sync_status'),
    assignedToUserId: text('assigned_to_user_id'),
    sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    sourceExternalReference: text('source_external_reference'),
    apiPayload: jsonb('api_payload').notNull().default({}),
    customData: jsonb('custom_data').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_jobs_tenant_extref').on(t.tenantId, t.externalReference),
    uniqueIndex('UQ_jobs_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(
        sql`internal_number IS NOT NULL AND deleted_at IS NULL AND external_job_id IS NULL`,
      ),
    index('idx_jobs_tenant_external_job_id')
      .on(t.tenantId, t.externalJobId)
      .where(sql`external_job_id IS NOT NULL AND deleted_at IS NULL`),
    index('idx_jobs_claim').on(t.tenantId, t.claimId),
    index('idx_jobs_assigned').on(t.tenantId, t.assignedToUserId),
    index('idx_jobs_source_tenant').on(t.sourceTenantId),
  ],
);

// Quotes
export const quotes = pgTable(
  'quotes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
    recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
    custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
    captureMethod: text('capture_method'),
    ownershipStatus: text('ownership_status').notNull().default('owned'),
    externalReference: text('external_reference'),
    quoteNumber: text('quote_number'),
    internalNumber: text('internal_number'),
    name: text('name'),
    reference: text('reference'),
    note: text('note'),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    quoteTypeLookupId: uuid('quote_type_lookup_id').references(() => lookupValues.id),
    quoteDate: timestamp('quote_date', { withTimezone: true }),
    expiresInDays: integer('expires_in_days'),
    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    quoteTo: jsonb('quote_to').notNull().default({}),
    quoteFor: jsonb('quote_for').notNull().default({}),
    quoteFrom: jsonb('quote_from').notNull().default({}),
    scheduleInfo: jsonb('schedule_info').notNull().default({}),
    approvalInfo: jsonb('approval_info').notNull().default({}),
    quoteToEmail: text('quote_to_email'),
    quoteToName: text('quote_to_name'),
    quoteForName: text('quote_for_name'),
    estimatedStartDate: date('estimated_start_date'),
    estimatedCompletionDate: date('estimated_completion_date'),
    isAutoApproved: boolean('is_auto_approved'),
    customData: jsonb('custom_data').notNull().default({}),
    apiPayload: jsonb('api_payload').notNull().default({}),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    assignedToUserId: text('assigned_to_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    syncStatus: text('sync_status'),
  },
  (t) => [
    check('chk_quote_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    uniqueIndex('UQ_quotes_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_quotes_job').on(t.tenantId, t.jobId),
    index('idx_quotes_claim').on(t.tenantId, t.claimId),
    index('idx_quotes_status').on(t.tenantId, t.statusLookupId),
    index('idx_quotes_issuer_org').on(t.issuerOrganisationId),
    index('idx_quotes_ownership').on(t.ownershipStatus),
    index('idx_quotes_assigned').on(t.tenantId, t.assignedToUserId),
    uniqueIndex('UQ_quotes_issuer_org_number')
      .on(t.issuerOrganisationId, t.quoteNumber)
      .where(
        sql`issuer_organisation_id IS NOT NULL AND quote_number IS NOT NULL AND deleted_at IS NULL`,
      ),
    uniqueIndex('UQ_quotes_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(sql`internal_number IS NOT NULL AND deleted_at IS NULL`),
  ],
);

// Quote groups
export const quoteGroups = pgTable(
  'quote_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    externalReference: text('external_reference'),
    groupLabelLookupId: uuid('group_label_lookup_id').references(() => lookupValues.id),
    description: text('description'),
    dimensions: jsonb('dimensions').notNull().default({}),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    groupPayload: jsonb('group_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_quote_groups_parent_extref').on(t.quoteId, t.externalReference),
    index('idx_quote_groups_quote').on(t.tenantId, t.quoteId),
  ],
);

// Quote combos
export const quoteCombos = pgTable(
  'quote_combos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quoteGroupId: uuid('quote_group_id')
      .notNull()
      .references(() => quoteGroups.id, { onDelete: 'cascade' }),
    externalReference: text('external_reference'),
    catalogComboId: uuid('catalog_combo_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    lineScopeStatusLookupId: uuid('line_scope_status_lookup_id').references(() => lookupValues.id),
    name: text('name'),
    component: text('component'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    publishStatus: text('publish_status'),
    totals: jsonb('totals').notNull().default({}),
    comboPayload: jsonb('combo_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_quote_combos_parent_extref').on(t.quoteGroupId, t.externalReference),
    index('idx_quote_combos_group').on(t.tenantId, t.quoteGroupId),
  ],
);

// Quote items
export const quoteItems = pgTable(
  'quote_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quoteGroupId: uuid('quote_group_id').references(() => quoteGroups.id, { onDelete: 'cascade' }),
    quoteComboId: uuid('quote_combo_id').references(() => quoteCombos.id, { onDelete: 'cascade' }),
    externalReference: text('external_reference'),
    catalogItemId: uuid('catalog_item_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    lineScopeStatusLookupId: uuid('line_scope_status_lookup_id').references(() => lookupValues.id),
    unitTypeLookupId: uuid('unit_type_lookup_id').references(() => lookupValues.id),
    name: text('name'),
    component: text('component'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    itemType: text('item_type'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    tax: numeric('tax', { precision: 14, scale: 4 }),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    markupType: text('markup_type'),
    markupValue: numeric('markup_value', { precision: 14, scale: 4 }),
    allocatedCost: numeric('allocated_cost', { precision: 14, scale: 4 }),
    committedCost: numeric('committed_cost', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    internal: boolean('internal'),
    publishStatus: text('publish_status'),
    note: text('note'),
    tags: jsonb('tags').notNull().default([]),
    mismatches: jsonb('mismatches').notNull().default([]),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_quote_item_parent',
      sql`(quote_group_id IS NOT NULL AND quote_combo_id IS NULL) OR (quote_group_id IS NULL AND quote_combo_id IS NOT NULL)`,
    ),
    uniqueIndex('UQ_quote_items_group_extref').on(t.quoteGroupId, t.externalReference),
    uniqueIndex('UQ_quote_items_combo_extref').on(t.quoteComboId, t.externalReference),
    index('idx_quote_items_group').on(t.tenantId, t.quoteGroupId),
    index('idx_quote_items_combo').on(t.tenantId, t.quoteComboId),
  ],
);

// Purchase orders
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    quoteId: uuid('quote_id').references(() => quotes.id),
    issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
    recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
    custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
    captureMethod: text('capture_method'),
    ownershipStatus: text('ownership_status').notNull().default('owned'),
    scopeOfWork: text('scope_of_work'),
    externalId: text('external_id'),
    purchaseOrderNumber: text('purchase_order_number'),
    internalNumber: text('internal_number'),
    name: text('name'),
    statusLookupId: uuid('status_lookup_id'),
    purchaseOrderTypeLookupId: uuid('purchase_order_type_lookup_id'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    startTime: time('start_time'),
    endTime: time('end_time'),
    note: text('note'),
    poTo: jsonb('po_to').notNull().default({}),
    poFor: jsonb('po_for').notNull().default({}),
    poFrom: jsonb('po_from').notNull().default({}),
    serviceWindow: jsonb('service_window').notNull().default({}),
    adjustmentInfo: jsonb('adjustment_info').notNull().default({}),
    allocationContext: jsonb('allocation_context').notNull().default({}),
    poToEmail: text('po_to_email'),
    poForName: text('po_for_name'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    adjustedTotal: numeric('adjusted_total', { precision: 14, scale: 2 }),
    adjustedTotalAdjustmentAmount: numeric('adjusted_total_adjustment_amount', {
      precision: 14,
      scale: 2,
    }),
    purchaseOrderPayload: jsonb('purchase_order_payload').notNull().default({}),
    supplyChainDepth: integer('supply_chain_depth').notNull().default(0),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_po_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    index('idx_po_job').on(t.tenantId, t.jobId),
    index('idx_po_claim').on(t.tenantId, t.claimId),
    index('idx_po_vendor').on(t.tenantId, t.vendorId),
    index('idx_po_issuer_org').on(t.issuerOrganisationId),
    index('idx_po_ownership').on(t.ownershipStatus),
    uniqueIndex('UQ_purchase_orders_tenant_external_id')
      .on(t.tenantId, t.externalId)
      .where(sql`external_id IS NOT NULL`),
    uniqueIndex('UQ_purchase_orders_tenant_po_number')
      .on(t.tenantId, t.purchaseOrderNumber)
      .where(sql`purchase_order_number IS NOT NULL`),
    uniqueIndex('UQ_po_issuer_org_number')
      .on(t.issuerOrganisationId, t.purchaseOrderNumber)
      .where(sql`issuer_organisation_id IS NOT NULL AND purchase_order_number IS NOT NULL AND deleted_at IS NULL`),
    uniqueIndex('UQ_purchase_orders_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(sql`internal_number IS NOT NULL AND deleted_at IS NULL`),
  ],
);

// Purchase order groups
export const purchaseOrderGroups = pgTable(
  'purchase_order_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
    groupLabelLookupId: uuid('group_label_lookup_id'),
    description: text('description'),
    dimensions: jsonb('dimensions').notNull().default({}),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    groupPayload: jsonb('group_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_po_groups_po').on(t.tenantId, t.purchaseOrderId)],
);

// Purchase order combos
export const purchaseOrderCombos = pgTable(
  'purchase_order_combos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseOrderGroupId: uuid('purchase_order_group_id')
      .notNull()
      .references(() => purchaseOrderGroups.id, { onDelete: 'cascade' }),
    catalogComboId: uuid('catalog_combo_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    quoteComboId: uuid('quote_combo_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    comboPayload: jsonb('combo_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_po_combos_group').on(t.tenantId, t.purchaseOrderGroupId)],
);

// Purchase order items
export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseOrderGroupId: uuid('purchase_order_group_id').references(
      () => purchaseOrderGroups.id,
      { onDelete: 'cascade' },
    ),
    purchaseOrderComboId: uuid('purchase_order_combo_id').references(
      () => purchaseOrderCombos.id,
      { onDelete: 'cascade' },
    ),
    catalogItemId: uuid('catalog_item_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    quoteLineItemId: uuid('quote_line_item_id'),
    unitTypeLookupId: uuid('unit_type_lookup_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    itemType: text('item_type'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    tax: numeric('tax', { precision: 14, scale: 4 }),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    markupType: text('markup_type'),
    markupValue: numeric('markup_value', { precision: 14, scale: 4 }),
    reconciliation: numeric('reconciliation', { precision: 14, scale: 4 }),
    manualAllocation: boolean('manual_allocation'),
    sortIndex: integer('sort_index').notNull().default(0),
    note: text('note'),
    tags: jsonb('tags').notNull().default([]),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_po_item_parent',
      sql`(purchase_order_group_id IS NOT NULL AND purchase_order_combo_id IS NULL) OR (purchase_order_group_id IS NULL AND purchase_order_combo_id IS NOT NULL)`,
    ),
    index('idx_po_items_group').on(t.tenantId, t.purchaseOrderGroupId),
    index('idx_po_items_combo').on(t.tenantId, t.purchaseOrderComboId),
  ],
);

// Invoices
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    workOrderId: uuid('work_order_id').references(() => workOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    invoiceNumber: text('invoice_number'),
    internalNumber: text('internal_number'),
    issueDate: timestamp('issue_date', { withTimezone: true }),
    receivedDate: timestamp('received_date', { withTimezone: true }),
    comments: text('comments'),
    declinedReason: text('declined_reason'),
    statusLookupId: uuid('status_lookup_id'),
    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    excessAmount: numeric('excess_amount', { precision: 14, scale: 2 }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    invoicePayload: jsonb('invoice_payload').notNull().default({}),
    issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
    recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
    sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    sourceExternalReference: text('source_external_reference'),
    custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
    captureMethod: text('capture_method'),
    ownershipStatus: text('ownership_status'),
    sourceVersionNumber: integer('source_version_number'),
    latestAvailableVersion: integer('latest_available_version'),
    versionAcknowledged: boolean('version_acknowledged').default(true),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    syncStatus: text('sync_status'),
  },
  (t) => [
    check(
      'chk_invoice_parent',
      sql`purchase_order_id IS NOT NULL OR work_order_id IS NOT NULL`,
    ),
    uniqueIndex('UQ_invoices_tenant_po_number')
      .on(t.tenantId, t.purchaseOrderId, t.invoiceNumber)
      .where(sql`purchase_order_id IS NOT NULL`),
    uniqueIndex('UQ_invoices_tenant_wo_number')
      .on(t.tenantId, t.workOrderId, t.invoiceNumber)
      .where(sql`work_order_id IS NOT NULL AND invoice_number IS NOT NULL`),
    uniqueIndex('UQ_invoices_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(sql`internal_number IS NOT NULL`),
    index('idx_invoices_source_tenant').on(t.sourceTenantId),
    index('idx_invoices_work_order').on(t.tenantId, t.workOrderId),
  ],
);

// Job contacts
export const jobContacts = pgTable(
  'job_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    sortIndex: integer('sort_index').notNull().default(0),
    visibility: text('visibility').notNull().default('org'),
    createdByUserId: text('created_by_user_id'),
    sourcePayload: jsonb('source_payload').notNull().default({}),
  },
  (t) => [uniqueIndex('UQ_job_contact').on(t.jobId, t.contactId)],
);

// Tasks
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    taskTypeLookupId: uuid('task_type_lookup_id'),
    relatedEntityType: text('related_entity_type').notNull(),
    relatedEntityId: uuid('related_entity_id').notNull(),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    taskType: text('task_type'),
    startDate: timestamp('start_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    reminderAt: timestamp('reminder_at', { withTimezone: true }),
    estimatedHours: numeric('estimated_hours', { precision: 8, scale: 2 }),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    priority: text('priority').notNull().default('Low'),
    status: text('status').notNull().default('Open'),
    taskPayload: jsonb('task_payload').notNull().default({}),
    assignedToUserId: text('assigned_to_user_id'),
    assignedToExternalReference: text('assigned_to_external_reference'),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    syncStatus: text('sync_status'),
    externalReference: text('external_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_task_entity_type',
      sql`related_entity_type IN (
        'Job', 'Claim', 'Quote', 'WorkOrder', 'Invoice',
        'RFQ', 'Proposal', 'PurchaseOrder', 'Bill',
        'Appointment', 'Contact'
      )`,
    ),
    check('chk_task_priority', sql`priority IN ('Low','Medium','High','Critical')`),
    check(
      'chk_task_status',
      sql`status IN ('Open','In Progress','On Hold','Completed','Failed','Cancelled')`,
    ),
    index('idx_tasks_entity').on(t.tenantId, t.relatedEntityType, t.relatedEntityId),
    index('idx_tasks_claim').on(t.tenantId, t.claimId),
    index('idx_tasks_job').on(t.tenantId, t.jobId),
    index('idx_tasks_status').on(t.tenantId, t.status),
    index('idx_tasks_due_date').on(t.tenantId, t.dueDate),
    index('idx_tasks_assigned').on(t.tenantId, t.assignedToUserId),
  ],
);

// Messages
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    messageTypeLookupId: uuid('message_type_lookup_id'),
    fromClaimId: uuid('from_claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    fromJobId: uuid('from_job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    toClaimId: uuid('to_claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    toJobId: uuid('to_job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    toAssigneeTypeLookupId: uuid('to_assignee_type_lookup_id'),
    toUserId: text('to_user_id'),
    subject: text('subject'),
    body: text('body'),
    acknowledgementRequired: boolean('acknowledgement_required').notNull().default(false),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    acknowledgedByUserId: text('acknowledged_by_user_id'),
    messagePayload: jsonb('message_payload').notNull().default({}),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_message_from', sql`from_claim_id IS NOT NULL OR from_job_id IS NOT NULL`),
    check('chk_message_to', sql`to_claim_id IS NOT NULL OR to_job_id IS NOT NULL`),
  ],
);

// Appointments
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    appointmentTypeLookupId: uuid('appointment_type_lookup_id'),
    specialistVisitTypeLookupId: uuid('specialist_visit_type_lookup_id'),
    name: text('name').notNull(),
    location: text('location').notNull(),
    startDate: timestamp('start_date', { withTimezone: true }).notNull(),
    endDate: timestamp('end_date', { withTimezone: true }).notNull(),
    status: text('status'),
    cancellationDetails: jsonb('cancellation_details').notNull().default({}),
    appointmentPayload: jsonb('appointment_payload').notNull().default({}),
    syncStatus: text('sync_status'),
    externalReference: text('external_reference'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_appt_location', sql`location IN ('ONSITE', 'DIGITAL')`)],
);

// Appointment attendees
export const appointmentAttendees = pgTable(
  'appointment_attendees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    appointmentId: uuid('appointment_id')
      .notNull()
      .references(() => appointments.id, { onDelete: 'cascade' }),
    attendeeType: text('attendee_type').notNull(),
    userId: text('user_id'),
    contactId: uuid('contact_id'),
    email: text('email'),
    attendeePayload: jsonb('attendee_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check('chk_attendee_type', sql`attendee_type IN ('CONTACT','USER')`)],
);

// Reports
export const reports = pgTable(
  'reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    reportTypeLookupId: uuid('report_type_lookup_id'),
    statusLookupId: uuid('status_lookup_id'),
    title: text('title'),
    reference: text('reference'),
    reportData: jsonb('report_data').notNull().default({}),
    reportMeta: jsonb('report_meta').notNull().default({}),
    apiPayload: jsonb('api_payload').notNull().default({}),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_reports_job').on(t.tenantId, t.jobId),
    index('idx_reports_claim').on(t.tenantId, t.claimId),
    index('idx_reports_type').on(t.tenantId, t.reportTypeLookupId),
  ],
);

// Attachments
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    relatedRecordType: text('related_record_type').notNull(),
    relatedRecordId: uuid('related_record_id').notNull(),
    documentTypeLookupId: uuid('document_type_lookup_id'),
    title: text('title'),
    description: text('description'),
    fileName: text('file_name'),
    mimeType: text('mime_type'),
    fileSize: bigint('file_size', { mode: 'number' }),
    storageProvider: text('storage_provider'),
    storageKey: text('storage_key'),
    fileUrl: text('file_url'),
    attachmentMeta: jsonb('attachment_meta').notNull().default({}),
    apiPayload: jsonb('api_payload').notNull().default({}),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_attachment_record_type',
      sql`related_record_type IN ('Claim','Job','PurchaseOrder','Quote','Report','Tender','Invoice','Contact','Vendor','PulseJob')`,
    ),
    index('idx_attachments_related').on(
      t.tenantId,
      t.relatedRecordType,
      t.relatedRecordId,
    ),
  ],
);

// Users (identity only — org membership lives in organization_users)
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email'),
    name: text('name'),
    status: text('status').notNull().default('active'),
    object: text('object').notNull().default('user'),
    isActive: boolean('is_active').notNull().default(true),
    config: jsonb('config'),
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_email').on(t.email),
  ],
);

// User identities (auth: links users to external identity providers)
export const userIdentities = pgTable(
  'user_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerSubject: text('provider_subject').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    rawProfile: jsonb('raw_profile').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_user_identities_provider_subject').on(t.provider, t.providerSubject),
  ],
);

// Organizations (auth: tenant/org registry)
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: text('status').notNull(),
    object: text('object').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull(),
    modified: timestamp('modified', { withTimezone: true, mode: 'string' }).notNull(),
    createdBy: uuid('created_by').notNull(),
    modifiedBy: uuid('modified_by').notNull(),
    orgCode: text('org_code').notNull(),
    config: jsonb('config'),
    abn: text('abn'),
    legalName: text('legal_name'),
    tradingName: text('trading_name'),
    primaryEmail: text('primary_email'),
    emailDomain: text('email_domain'),
    phone: text('phone'),
    subscriptionStatus: text('subscription_status').notNull().default('active'),
    provisioningStatus: text('provisioning_status').notNull().default('pending'),
    provisioningStartedAt: timestamp('provisioning_started_at', { withTimezone: true }),
    provisioningCompletedAt: timestamp('provisioning_completed_at', { withTimezone: true }),
    /** FK enforced in SQL migration 0046 (avoids Drizzle circular type with filesystem_template). */
    defaultCompanyFilesystemTemplateId: uuid('default_company_filesystem_template_id'),
    defaultProjectFilesystemTemplateId: uuid('default_project_filesystem_template_id'),
  },
  (t) => [
    uniqueIndex('UQ_organizations_abn')
      .on(t.abn)
      .where(sql`abn IS NOT NULL`),
  ],
);

// Organization users (auth: maps users to organizations)
export const organizationUsers = pgTable(
  'organization_users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    role: text('role').notNull(),
    status: text('status').notNull(),
    object: text('object').notNull(),
    created: timestamp('created', { withTimezone: true, mode: 'string' }).notNull(),
    modified: timestamp('modified', { withTimezone: true, mode: 'string' }).notNull(),
    createdBy: uuid('created_by').notNull(),
    modifiedBy: uuid('modified_by').notNull(),
    profile: jsonb('profile'),
    config: jsonb('config'),
    ext: jsonb('ext'),
  },
  (t) => [unique('organization_users_user_organization_key').on(t.userId, t.organizationId)],
);

// Integration connections
// Providers are hardcoded in `src/modules/providers/provider-registry.ts`;
// `provider_code` is the stable slug identifying the provider.
export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    providerCode: text('provider_code').notNull(),
    name: text('name').notNull().default(''),
    environment: text('environment').notNull(),
    authType: text('auth_type').notNull().default('client_credentials'),
    baseUrl: text('base_url').notNull(),
    baseApi: text('base_api'),
    authUrl: text('auth_url'),
    docsUrl: text('docs_url'),
    clientIdentifier: text('client_identifier'),
    providerTenantId: text('provider_tenant_id'),
    credentials: jsonb('credentials').notNull().default({}),
    webhookSecret: text('webhook_secret'),
    config: jsonb('config').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_connection_tenant_provider_env').on(t.tenantId, t.providerCode, t.environment),
    index('idx_connections_tenant').on(t.tenantId),
    index('idx_connections_provider_code').on(t.providerCode),
  ],
);

// Connection identifiers — maps multiple external tenant/platform IDs to a single connection
export const connectionIdentifiers = pgTable(
  'connection_identifiers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),
    identifierType: text('identifier_type').notNull(),
    identifierValue: text('identifier_value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('uq_identifier_type_value').on(t.identifierType, t.identifierValue),
    index('idx_identifier_connection').on(t.connectionId),
    index('idx_identifier_value').on(t.identifierValue),
  ],
);

// External objects
export const externalObjects = pgTable(
  'external_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    providerCode: text('provider_code').notNull(),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    normalizedEntityType: text('normalized_entity_type').notNull(),
    externalParentId: text('external_parent_id'),
    latestPayload: jsonb('latest_payload').notNull(),
    payloadHash: text('payload_hash'),
    fetchStatus: text('fetch_status').notNull().default('fetched'),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    lastFetchEventId: uuid('last_fetch_event_id'),
    latestEventType: text('latest_event_type'),
    latestEventTimestamp: timestamp('latest_event_timestamp', { withTimezone: true }),
    externalCreatedAt: timestamp('external_created_at', { withTimezone: true }),
    externalUpdatedAt: timestamp('external_updated_at', { withTimezone: true }),
    lastErrorMessage: text('last_error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_obj_connection_type_id').on(
      t.connectionId,
      t.providerEntityType,
      t.providerEntityId,
    ),
    index('idx_ext_obj_tenant_type').on(t.tenantId, t.normalizedEntityType),
    index('idx_ext_obj_provider_entity_id').on(t.providerEntityId),
  ],
);

// External object versions
export const externalObjectVersions = pgTable(
  'external_object_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalObjectId: uuid('external_object_id')
      .notNull()
      .references(() => externalObjects.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    payload: jsonb('payload').notNull(),
    payloadHash: text('payload_hash').notNull(),
    sourceEventId: uuid('source_event_id'),
    changeSummary: jsonb('change_summary').notNull().default({}),
    archiveObjectUri: text('archive_object_uri'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_obj_ver_obj_version').on(t.externalObjectId, t.versionNumber),
    index('idx_ext_obj_ver_obj_created').on(t.externalObjectId, t.createdAt),
  ],
);

// External links
export const externalLinks = pgTable(
  'external_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    externalObjectId: uuid('external_object_id')
      .notNull()
      .references(() => externalObjects.id, { onDelete: 'cascade' }),
    internalEntityType: text('internal_entity_type').notNull(),
    internalEntityId: uuid('internal_entity_id').notNull(),
    linkRole: text('link_role').notNull().default('source'),
    isPrimary: boolean('is_primary').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_ext_link_obj_type_id_role').on(
      t.externalObjectId,
      t.internalEntityType,
      t.internalEntityId,
      t.linkRole,
    ),
    uniqueIndex('UQ_ext_link_primary_per_type')
      .on(t.externalObjectId, t.internalEntityType, t.linkRole)
      .where(sql`is_primary = true`),
    index('idx_ext_link_internal').on(t.internalEntityType, t.internalEntityId),
    index('idx_ext_link_external').on(t.externalObjectId),
  ],
);

// Inbound webhook events
export const inboundWebhookEvents = pgTable(
  'inbound_webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    externalEventId: text('external_event_id').notNull().unique(),
    tenantId: uuid('tenant_id').references(() => organizations.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    eventType: text('event_type').notNull(),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    payloadEntityId: text('payload_entity_id'),
    payloadTeamIds: jsonb('payload_team_ids').notNull().default([]),
    payloadTenantId: text('payload_tenant_id'),
    payloadClient: text('payload_client'),
    payloadProjectExternalReference: text('payload_project_external_reference'),
    signatureHeader: text('signature_header'),
    hmacVerified: boolean('hmac_verified'),
    rawHeaders: jsonb('raw_headers').notNull().default({}),
    rawBodyText: text('raw_body_text').notNull(),
    rawBodyJson: jsonb('raw_body_json'),
    processingStatus: text('processing_status').notNull().default('pending'),
    processingError: text('processing_error'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    connectionId: uuid('connection_id').references(() => integrationConnections.id),
    providerCode: text('provider_code'),
    providerEntityType: text('provider_entity_type'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_webhooks_status').on(t.processingStatus, t.createdAt),
    index('idx_webhooks_connection_type_entity').on(t.connectionId, t.eventType, t.payloadEntityId),
    index('idx_webhooks_provider_code_entity').on(t.providerCode, t.providerEntityType),
  ],
);

// External processing log
export const externalProcessingLog = pgTable(
  'external_processing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    connectionId: uuid('connection_id').references(() => integrationConnections.id),
    eventId: uuid('event_id'),
    workflowRunId: text('workflow_run_id'),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    action: text('action').notNull(),
    status: text('status').notNull().default('pending'),
    externalObjectId: uuid('external_object_id'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').notNull().default({}),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_processing_log_status').on(t.status, t.createdAt),
    index('idx_processing_log_tenant_type').on(t.tenantId, t.providerEntityType),
    index('idx_processing_log_workflow').on(t.workflowRunId),
  ],
);

// External event attempts
export const externalEventAttempts = pgTable(
  'external_event_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => inboundWebhookEvents.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: text('status').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_event_attempt').on(t.eventId, t.attemptNumber),
  ],
);

// Work Orders
export const workOrders = pgTable(
  'work_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    purchaseOrderId: uuid('purchase_order_id')
      .references(() => purchaseOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    quoteId: uuid('quote_id').references(() => quotes.id),
    sourceTenantId: uuid('source_tenant_id'),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    sourceExternalReference: text('source_external_reference'),
    externalId: text('external_id'),
    workOrderNumber: text('work_order_number'),
    internalNumber: text('internal_number'),
    name: text('name'),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    workOrderTypeLookupId: uuid('work_order_type_lookup_id').references(() => lookupValues.id),
    startDate: date('start_date'),
    endDate: date('end_date'),
    startTime: time('start_time'),
    endTime: time('end_time'),
    note: text('note'),
    scopeOfWork: text('scope_of_work'),
    woTo: jsonb('wo_to').notNull().default({}),
    woFor: jsonb('wo_for').notNull().default({}),
    woFrom: jsonb('wo_from').notNull().default({}),
    serviceWindow: jsonb('service_window').notNull().default({}),
    woToEmail: text('wo_to_email'),
    woForName: text('wo_for_name'),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    adjustedTotal: numeric('adjusted_total', { precision: 14, scale: 2 }),
    adjustedTotalAdjustmentAmount: numeric('adjusted_total_adjustment_amount', {
      precision: 14,
      scale: 2,
    }),
    adjustmentInfo: jsonb('adjustment_info').notNull().default({}),
    allocationContext: jsonb('allocation_context').notNull().default({}),
    workOrderPayload: jsonb('work_order_payload').notNull().default({}),
    sourceVersionNumber: integer('source_version_number').notNull().default(1),
    latestAvailableVersion: integer('latest_available_version').notNull().default(1),
    versionAcknowledged: boolean('version_acknowledged').notNull().default(true),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_wo_po').on(t.tenantId, t.purchaseOrderId),
    index('idx_wo_job').on(t.tenantId, t.jobId),
    index('idx_wo_claim').on(t.tenantId, t.claimId),
    index('idx_wo_number').on(t.tenantId, t.workOrderNumber),
    uniqueIndex('UQ_work_orders_tenant_number')
      .on(t.tenantId, t.workOrderNumber)
      .where(sql`work_order_number ~* '^wo-[0-9]+$' AND deleted_at IS NULL`),
    uniqueIndex('UQ_work_orders_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(sql`internal_number IS NOT NULL AND deleted_at IS NULL`),
  ],
);

// Work order groups
export const workOrderGroups = pgTable(
  'work_order_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.id, { onDelete: 'cascade' }),
    groupLabelLookupId: uuid('group_label_lookup_id'),
    description: text('description'),
    dimensions: jsonb('dimensions').notNull().default({}),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    groupPayload: jsonb('group_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_wo_groups_wo').on(t.tenantId, t.workOrderId)],
);

// Work order combos
export const workOrderCombos = pgTable(
  'work_order_combos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    workOrderGroupId: uuid('work_order_group_id')
      .notNull()
      .references(() => workOrderGroups.id, { onDelete: 'cascade' }),
    catalogComboId: uuid('catalog_combo_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    quoteComboId: uuid('quote_combo_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    comboPayload: jsonb('combo_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_wo_combos_group').on(t.tenantId, t.workOrderGroupId)],
);

// Work order items
export const workOrderItems = pgTable(
  'work_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    workOrderGroupId: uuid('work_order_group_id').references(
      () => workOrderGroups.id,
      { onDelete: 'cascade' },
    ),
    workOrderComboId: uuid('work_order_combo_id').references(
      () => workOrderCombos.id,
      { onDelete: 'cascade' },
    ),
    catalogItemId: uuid('catalog_item_id').references((): AnyPgColumn => catalogItems.id, {
      onDelete: 'set null',
    }),
    quoteLineItemId: uuid('quote_line_item_id'),
    unitTypeLookupId: uuid('unit_type_lookup_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    itemType: text('item_type'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    tax: numeric('tax', { precision: 14, scale: 4 }),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    markupType: text('markup_type'),
    markupValue: numeric('markup_value', { precision: 14, scale: 4 }),
    reconciliation: numeric('reconciliation', { precision: 14, scale: 4 }),
    manualAllocation: boolean('manual_allocation'),
    sortIndex: integer('sort_index').notNull().default(0),
    note: text('note'),
    tags: jsonb('tags').notNull().default([]),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_wo_item_parent',
      sql`(work_order_group_id IS NOT NULL AND work_order_combo_id IS NULL) OR (work_order_group_id IS NULL AND work_order_combo_id IS NOT NULL)`,
    ),
    index('idx_wo_items_group').on(t.tenantId, t.workOrderGroupId),
    index('idx_wo_items_combo').on(t.tenantId, t.workOrderComboId),
  ],
);

// RFQs
export const rfqs = pgTable(
  'rfqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    rfqNumber: text('rfq_number'),
    internalNumber: text('internal_number'),
    name: text('name'),
    note: text('note'),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    sentDate: timestamp('sent_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    receivedDate: timestamp('received_date', { withTimezone: true }),
    includePricing: boolean('include_pricing').notNull().default(false),
    includeQuantities: boolean('include_quantities').notNull().default(true),
    rfqTo: jsonb('rfq_to').notNull().default({}),
    rfqFrom: jsonb('rfq_from').notNull().default({}),
    rfqToEmail: text('rfq_to_email'),
    rfqToName: text('rfq_to_name'),
    rfqPayload: jsonb('rfq_payload').notNull().default({}),
    supplyChainDepth: integer('supply_chain_depth').notNull().default(0),
    issuerOrganisationId: uuid('issuer_organisation_id').references(() => organizations.id),
    recipientOrganisationId: uuid('recipient_organisation_id').references(() => organizations.id),
    sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    sourceExternalReference: text('source_external_reference'),
    custodianTenantId: uuid('custodian_tenant_id').references(() => organizations.id),
    captureMethod: text('capture_method'),
    ownershipStatus: text('ownership_status'),
    sourceVersionNumber: integer('source_version_number'),
    latestAvailableVersion: integer('latest_available_version'),
    versionAcknowledged: boolean('version_acknowledged').default(true),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_rfq_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    index('idx_rfq_job').on(t.tenantId, t.jobId),
    index('idx_rfq_claim').on(t.tenantId, t.claimId),
    index('idx_rfq_quote').on(t.tenantId, t.quoteId),
    index('idx_rfq_vendor').on(t.tenantId, t.vendorId),
    index('idx_rfq_number').on(t.tenantId, t.rfqNumber),
    uniqueIndex('UQ_rfqs_tenant_number')
      .on(t.tenantId, t.rfqNumber)
      .where(sql`rfq_number IS NOT NULL AND deleted_at IS NULL`),
    uniqueIndex('UQ_rfqs_tenant_internal_number')
      .on(t.tenantId, t.internalNumber)
      .where(sql`internal_number IS NOT NULL AND deleted_at IS NULL`),
    index('idx_rfq_source_tenant').on(t.sourceTenantId),
  ],
);

// RFQ groups
export const rfqGroups = pgTable(
  'rfq_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    rfqId: uuid('rfq_id').notNull().references(() => rfqs.id, { onDelete: 'cascade' }),
    sourceQuoteGroupId: uuid('source_quote_group_id').references(() => quoteGroups.id),
    groupLabelLookupId: uuid('group_label_lookup_id').references(() => lookupValues.id),
    description: text('description'),
    note: text('note'),
    dimensions: jsonb('dimensions').notNull().default({}),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    groupPayload: jsonb('group_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_rfq_groups_rfq').on(t.tenantId, t.rfqId)],
);

// RFQ combos
export const rfqCombos = pgTable(
  'rfq_combos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    rfqGroupId: uuid('rfq_group_id')
      .notNull()
      .references(() => rfqGroups.id, { onDelete: 'cascade' }),
    sourceQuoteComboId: uuid('source_quote_combo_id').references(() => quoteCombos.id),
    name: text('name'),
    description: text('description'),
    note: text('note'),
    category: text('category'),
    subCategory: text('sub_category'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    comboPayload: jsonb('combo_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_rfq_combos_group').on(t.tenantId, t.rfqGroupId)],
);

// RFQ items
export const rfqItems = pgTable(
  'rfq_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    rfqGroupId: uuid('rfq_group_id').references(() => rfqGroups.id, { onDelete: 'cascade' }),
    rfqComboId: uuid('rfq_combo_id').references(() => rfqCombos.id, { onDelete: 'cascade' }),
    sourceQuoteItemId: uuid('source_quote_item_id').references(() => quoteItems.id),
    unitTypeLookupId: uuid('unit_type_lookup_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    itemType: text('item_type'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    tax: numeric('tax', { precision: 14, scale: 4 }),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    note: text('note'),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_rfq_item_parent',
      sql`(rfq_group_id IS NOT NULL AND rfq_combo_id IS NULL) OR (rfq_group_id IS NULL AND rfq_combo_id IS NOT NULL)`,
    ),
    index('idx_rfq_items_group').on(t.tenantId, t.rfqGroupId),
    index('idx_rfq_items_combo').on(t.tenantId, t.rfqComboId),
  ],
);

// Proposals
export const proposals = pgTable(
  'proposals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    rfqId: uuid('rfq_id').references(() => rfqs.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    sourceTenantId: uuid('source_tenant_id'),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    proposalNumber: text('proposal_number'),
    name: text('name'),
    reference: text('reference'),
    note: text('note'),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    proposalTypeLookupId: uuid('proposal_type_lookup_id').references(() => lookupValues.id),
    receivedDate: timestamp('received_date', { withTimezone: true }),
    proposalDate: timestamp('proposal_date', { withTimezone: true }),
    expiresInDays: integer('expires_in_days'),
    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    proposalTo: jsonb('proposal_to').notNull().default({}),
    proposalFor: jsonb('proposal_for').notNull().default({}),
    proposalFrom: jsonb('proposal_from').notNull().default({}),
    proposalToEmail: text('proposal_to_email'),
    proposalToName: text('proposal_to_name'),
    proposalFromName: text('proposal_from_name'),
    customData: jsonb('custom_data').notNull().default({}),
    proposalPayload: jsonb('proposal_payload').notNull().default({}),
    sourceVersionNumber: integer('source_version_number').notNull().default(1),
    latestAvailableVersion: integer('latest_available_version').notNull().default(1),
    versionAcknowledged: boolean('version_acknowledged').notNull().default(true),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_proposal_quote').on(t.tenantId, t.quoteId),
    index('idx_proposal_job').on(t.tenantId, t.jobId),
    index('idx_proposal_claim').on(t.tenantId, t.claimId),
    index('idx_proposal_rfq').on(t.tenantId, t.rfqId),
    index('idx_proposal_vendor').on(t.tenantId, t.vendorId),
    index('idx_proposal_number').on(t.tenantId, t.proposalNumber),
    index('idx_proposal_source_org').on(t.sourceOrganisationId),
  ],
);

// Proposal groups
export const proposalGroups = pgTable(
  'proposal_groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    proposalId: uuid('proposal_id')
      .notNull()
      .references(() => proposals.id, { onDelete: 'cascade' }),
    sourceRfqGroupId: uuid('source_rfq_group_id').references(() => rfqGroups.id),
    groupLabelLookupId: uuid('group_label_lookup_id').references(() => lookupValues.id),
    description: text('description'),
    dimensions: jsonb('dimensions').notNull().default({}),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    groupPayload: jsonb('group_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_proposal_groups_proposal').on(t.tenantId, t.proposalId)],
);

// Proposal combos
export const proposalCombos = pgTable(
  'proposal_combos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    proposalGroupId: uuid('proposal_group_id')
      .notNull()
      .references(() => proposalGroups.id, { onDelete: 'cascade' }),
    sourceRfqComboId: uuid('source_rfq_combo_id').references(() => rfqCombos.id),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    totals: jsonb('totals').notNull().default({}),
    comboPayload: jsonb('combo_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('idx_proposal_combos_group').on(t.tenantId, t.proposalGroupId)],
);

// Proposal items
export const proposalItems = pgTable(
  'proposal_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    proposalGroupId: uuid('proposal_group_id').references(() => proposalGroups.id, {
      onDelete: 'cascade',
    }),
    proposalComboId: uuid('proposal_combo_id').references(() => proposalCombos.id, {
      onDelete: 'cascade',
    }),
    sourceRfqItemId: uuid('source_rfq_item_id').references(() => rfqItems.id),
    unitTypeLookupId: uuid('unit_type_lookup_id'),
    name: text('name'),
    description: text('description'),
    category: text('category'),
    subCategory: text('sub_category'),
    itemType: text('item_type'),
    quantity: numeric('quantity', { precision: 14, scale: 4 }),
    tax: numeric('tax', { precision: 14, scale: 4 }),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    markupType: text('markup_type'),
    markupValue: numeric('markup_value', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    note: text('note'),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_proposal_item_parent',
      sql`(proposal_group_id IS NOT NULL AND proposal_combo_id IS NULL) OR (proposal_group_id IS NULL AND proposal_combo_id IS NOT NULL)`,
    ),
    index('idx_proposal_items_group').on(t.tenantId, t.proposalGroupId),
    index('idx_proposal_items_combo').on(t.tenantId, t.proposalComboId),
  ],
);

// Bills
export const bills = pgTable(
  'bills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id),
    purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    billNumber: text('bill_number'),
    externalReference: text('external_reference'),
    issueDate: timestamp('issue_date', { withTimezone: true }),
    receivedDate: timestamp('received_date', { withTimezone: true }),
    dueDate: timestamp('due_date', { withTimezone: true }),
    paymentDate: timestamp('payment_date', { withTimezone: true }),
    comments: text('comments'),
    declinedReason: text('declined_reason'),
    statusLookupId: uuid('status_lookup_id').references(() => lookupValues.id),
    paymentStatusLookupId: uuid('payment_status_lookup_id').references(() => lookupValues.id),
    subTotal: numeric('sub_total', { precision: 14, scale: 2 }),
    totalTax: numeric('total_tax', { precision: 14, scale: 2 }),
    totalAmount: numeric('total_amount', { precision: 14, scale: 2 }),
    isDeleted: boolean('is_deleted').notNull().default(false),
    billPayload: jsonb('bill_payload').notNull().default({}),
    sourceTenantId: uuid('source_tenant_id').references(() => organizations.id),
    sourceOrganisationId: uuid('source_organisation_id').references(() => organizations.id),
    sourceExternalReference: text('source_external_reference'),
    sourceVersionNumber: integer('source_version_number').notNull().default(1),
    latestAvailableVersion: integer('latest_available_version').notNull().default(1),
    versionAcknowledged: boolean('version_acknowledged').notNull().default(true),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_bills_invoice').on(t.tenantId, t.invoiceId),
    index('idx_bills_po').on(t.tenantId, t.purchaseOrderId),
    index('idx_bills_job').on(t.tenantId, t.jobId),
    index('idx_bills_claim').on(t.tenantId, t.claimId),
    index('idx_bills_vendor').on(t.tenantId, t.vendorId),
    index('idx_bills_number').on(t.tenantId, t.billNumber),
    index('idx_bills_status').on(t.tenantId, t.statusLookupId),
    index('idx_bills_source_tenant').on(t.sourceTenantId),
    index('idx_bills_due_date').on(t.tenantId, t.dueDate),
    index('idx_bills_payment_status').on(t.tenantId, t.paymentStatusLookupId),
    unique('UQ_bills_tenant_number').on(t.tenantId, t.purchaseOrderId, t.billNumber),
  ],
);

// ── Document Versions ──────────────────────────────────────────
export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    documentType: text('document_type').notNull(),
    documentId: uuid('document_id').notNull(),
    versionNumber: integer('version_number').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    lineItemSnapshot: jsonb('line_item_snapshot').notNull().default([]),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull(),
    issuedByUserId: text('issued_by_user_id'),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('UQ_doc_version').on(t.tenantId, t.documentType, t.documentId, t.versionNumber),
    index('idx_doc_versions_doc').on(t.tenantId, t.documentType, t.documentId),
  ],
);

// ── Item Allocations (WO items → PO items) ────────────────────
export const itemAllocations = pgTable(
  'item_allocations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    sourceWorkOrderItemId: uuid('source_work_order_item_id')
      .notNull()
      .references(() => workOrderItems.id, { onDelete: 'cascade' }),
    targetPurchaseOrderItemId: uuid('target_purchase_order_item_id')
      .notNull()
      .references(() => purchaseOrderItems.id, { onDelete: 'cascade' }),
    allocatedQuantity: numeric('allocated_quantity', { precision: 14, scale: 4 }),
    allocatedAmount: numeric('allocated_amount', { precision: 14, scale: 2 }),
    allocationType: text('allocation_type').notNull().default('full'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('chk_allocation_type', sql`allocation_type IN ('full', 'partial', 'split')`),
    index('idx_item_alloc_source').on(t.tenantId, t.sourceWorkOrderItemId),
    index('idx_item_alloc_target').on(t.tenantId, t.targetPurchaseOrderItemId),
  ],
);

// ── Outbound Sync Queue ───────────────────────────────────────
export const outboundSyncQueue = pgTable(
  'outbound_sync_queue',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    connectionId: uuid('connection_id')
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),

    channel: text('channel').notNull().default('integration'),

    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(),
    payload: jsonb('payload').notNull(),

    status: text('status').notNull().default('pending'),
    priority: integer('priority').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lastError: text('last_error'),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),

    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    notBefore: timestamp('not_before', { withTimezone: true }),

    sourceEvent: text('source_event'),
    idempotencyKey: text('idempotency_key'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_outbound_status', sql`status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')`),
    check('chk_outbound_channel', sql`channel IN ('integration', 'pubsub')`),
    index('idx_outbound_poll').on(t.status, t.scheduledAt, t.priority),
    index('idx_outbound_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_outbound_connection').on(t.connectionId, t.status),
    index('idx_outbound_channel_poll').on(t.channel, t.status, t.scheduledAt),
  ],
);

// ── Item Catalogue ─────────────────────────────────────────────

export const catalogs = pgTable(
  'catalogs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull().default('internal'),
    isActive: boolean('is_active').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_catalogs_tenant_name').on(t.tenantId, t.name),
    uniqueIndex('UQ_catalogs_tenant_default')
      .on(t.tenantId)
      .where(sql`is_default = true`),
    index('idx_catalogs_tenant').on(t.tenantId, t.isActive),
    check('chk_catalogs_type', sql`type IN ('crunchwork', 'internal')`),
  ],
);

export const catalogItemTypes = pgTable(
  'catalog_item_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortIndex: integer('sort_index').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_catalog_item_types_tenant_code').on(t.tenantId, t.code),
    index('idx_catalog_item_types_tenant').on(t.tenantId, t.isActive),
  ],
);

export const catalogCategories = pgTable(
  'catalog_categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    parentCategoryId: uuid('parent_category_id').references((): AnyPgColumn => catalogCategories.id, {
      onDelete: 'restrict',
    }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortIndex: integer('sort_index').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_catalog_categories_tenant_parent_code').on(
      t.tenantId,
      t.parentCategoryId,
      t.code,
    ),
    index('idx_catalog_categories_tenant').on(t.tenantId, t.isActive),
    index('idx_catalog_categories_parent').on(t.tenantId, t.parentCategoryId),
  ],
);

export const catalogItems = pgTable(
  'catalog_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    catalogId: uuid('catalog_id')
      .references(() => catalogs.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').notNull(),
    typeId: uuid('type_id')
      .notNull()
      .references(() => catalogItemTypes.id),
    categoryId: uuid('category_id').references(() => catalogCategories.id),
    subCategoryId: uuid('sub_category_id').references(() => catalogCategories.id),
    unitTypeLookupId: uuid('unit_type_lookup_id').references(() => lookupValues.id),
    unitCost: numeric('unit_cost', { precision: 14, scale: 4 }),
    buyCost: numeric('buy_cost', { precision: 14, scale: 4 }),
    markupType: text('markup_type'),
    markupValue: numeric('markup_value', { precision: 14, scale: 4 }),
    taxRate: numeric('tax_rate', { precision: 14, scale: 4 }),
    pricingMode: text('pricing_mode'),
    fixedUnitCost: numeric('fixed_unit_cost', { precision: 14, scale: 4 }),
    computedUnitCost: numeric('computed_unit_cost', { precision: 14, scale: 4 }),
    computedCostAt: timestamp('computed_cost_at', { withTimezone: true }),
    externalReference: text('external_reference'),
    /** Provider affinity tags used to filter outbound publish payloads (e.g. crunchwork, internal). */
    providerCodes: text('provider_codes').array().notNull().default([]),
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_catalog_items_catalog_code').on(t.tenantId, t.catalogId, t.code),
    uniqueIndex('UQ_catalog_items_catalog_extref')
      .on(t.tenantId, t.catalogId, t.externalReference)
      .where(sql`external_reference IS NOT NULL`),
    index('idx_catalog_items_tenant').on(t.tenantId, t.isActive, t.deletedAt),
    index('idx_catalog_items_type').on(t.tenantId, t.typeId),
    index('idx_catalog_items_category').on(t.tenantId, t.categoryId),
    index('idx_catalog_items_kind').on(t.tenantId, t.kind),
    index('idx_catalog_items_catalog').on(t.tenantId, t.catalogId, t.isActive, t.deletedAt),
    index('idx_catalog_items_provider_codes').using('gin', t.providerCodes),
    check('chk_catalog_items_kind', sql`kind IN ('primitive', 'assembly', 'scope')`),
    check(
      'chk_catalog_items_primitive_unit',
      sql`kind IN ('assembly', 'scope') OR unit_type_lookup_id IS NOT NULL`,
    ),
    check(
      'chk_catalog_items_assembly_pricing',
      sql`kind = 'primitive' OR pricing_mode IS NOT NULL`,
    ),
  ],
);

export const catalogAssemblyComponents = pgTable(
  'catalog_assembly_components',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    assemblyId: uuid('assembly_id')
      .notNull()
      .references(() => catalogItems.id, { onDelete: 'cascade' }),
    componentId: uuid('component_id')
      .notNull()
      .references(() => catalogItems.id, { onDelete: 'restrict' }),
    quantity: numeric('quantity', { precision: 14, scale: 4 }).notNull().default('1'),
    wasteFactor: numeric('waste_factor', { precision: 8, scale: 4 }).notNull().default('1'),
    sortIndex: integer('sort_index').notNull().default(0),
    isOptional: boolean('is_optional').notNull().default(false),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_catalog_bom_assembly').on(t.tenantId, t.assemblyId),
    index('idx_catalog_bom_component').on(t.tenantId, t.componentId),
    check('chk_bom_no_self_ref', sql`assembly_id != component_id`),
  ],
);

// ── Journals ──────────────────────────────────────────────────

export const journals = pgTable(
  'journals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    address: jsonb('address').notNull().default({}),
    addressPostcode: text('address_postcode'),
    addressSuburb: text('address_suburb'),
    addressState: text('address_state'),
    addressCountry: text('address_country'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    thumbnailUrl: text('thumbnail_url'),
    thumbnailStorageKey: text('thumbnail_storage_key'),
    metadata: jsonb('metadata').notNull().default({}),
    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_journal_status', sql`status IN ('active', 'archived', 'deleted')`),
    index('idx_journals_tenant').on(t.tenantId, t.status),
  ],
);

export const journalEntityLinks = pgTable(
  'journal_entity_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_journal_link_entity_type',
      sql`entity_type IN ('Job', 'Quote', 'Invoice')`,
    ),
    uniqueIndex('UQ_journal_entity_link').on(t.journalId, t.entityType, t.entityId),
    index('idx_journal_links_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_journal_links_journal').on(t.tenantId, t.journalId),
  ],
);

export const journalPages = pgTable(
  'journal_pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalId: uuid('journal_id')
      .notNull()
      .references(() => journals.id, { onDelete: 'cascade' }),
    body: text('body'),
    bodyFormat: text('body_format').notNull().default('plaintext'),
    latitude: numeric('latitude', { precision: 10, scale: 7 }),
    longitude: numeric('longitude', { precision: 10, scale: 7 }),
    locationAccuracy: numeric('location_accuracy', { precision: 10, scale: 2 }),
    locationLabel: text('location_label'),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
    sortIndex: integer('sort_index').notNull().default(0),
    metadata: jsonb('metadata').notNull().default({}),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_page_body_format', sql`body_format IN ('plaintext', 'markdown', 'html')`),
    index('idx_journal_pages_journal').on(t.tenantId, t.journalId),
    index('idx_journal_pages_captured').on(t.journalId, t.capturedAt),
    index('idx_journal_pages_sort').on(t.journalId, t.sortIndex),
  ],
);

export const journalPageAttachments = pgTable(
  'journal_page_attachments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    journalPageId: uuid('journal_page_id')
      .notNull()
      .references(() => journalPages.id, { onDelete: 'cascade' }),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    storageProvider: text('storage_provider').notNull().default('r2'),
    storageKey: text('storage_key').notNull(),
    fileUrl: text('file_url'),
    caption: text('caption'),
    sortIndex: integer('sort_index').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: numeric('duration_seconds', { precision: 10, scale: 2 }),
    thumbnailStorageKey: text('thumbnail_storage_key'),
    metadata: jsonb('metadata').notNull().default({}),
    createdByUserId: text('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_journal_page_attachments_page').on(t.tenantId, t.journalPageId),
    index('idx_journal_page_attachments_type').on(t.tenantId, t.mimeType),
  ],
);

// ── Entity Workflow State ──────────────────────────────────────
export const entityWorkflowState = pgTable(
  'entity_workflow_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    workflowName: text('workflow_name').notNull(),
    currentStep: text('current_step').notNull(),
    enteredAt: timestamp('entered_at', { withTimezone: true }).notNull().defaultNow(),
    enteredByUserId: text('entered_by_user_id'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('UQ_workflow_state').on(t.tenantId, t.entityType, t.entityId, t.workflowName),
    index('idx_workflow_state_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_workflow_state_step').on(t.tenantId, t.entityType, t.currentStep),
  ],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    eventType: text('event_type').notNull(),
    title: text('title').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    isRead: boolean('is_read').notNull().default(false),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_notifications_tenant_unread').on(t.tenantId, t.isRead),
    index('idx_notifications_entity').on(t.tenantId, t.entityType, t.entityId),
  ],
);

// ── Filesystem Module ──────────────────────────────────────────

/** company = org-wide document tree; project = per-job (project) document tree. */
export type FilesystemTemplateKind = 'company' | 'project';

export const filesystemTemplates = pgTable(
  'filesystem_template',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** NULL = platform-scoped template available to all tenants. */
    tenantId: uuid('tenant_id').references(() => organizations.id, {
      onDelete: 'restrict',
      onUpdate: 'cascade',
    }),
    name: text('name').notNull(),
    description: text('description'),
    /** company | project — drives which setup flows offer the template. */
    kind: text('kind').$type<FilesystemTemplateKind>().notNull().default('company'),
    isDefault: boolean('is_default').notNull().default(false),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_filesystem_template_tenant').on(t.tenantId),
    index('idx_filesystem_template_kind').on(t.kind),
    check('chk_filesystem_template_kind', sql`kind IN ('company', 'project')`),
    uniqueIndex('filesystem_template_platform_default_per_kind')
      .on(t.kind)
      .where(sql`is_default = true AND tenant_id IS NULL AND archived_at IS NULL`),
  ],
);

export interface CategoryConfig {
  color?: string | null;
  icon?: string | null;
  retentionDays?: number | null;
  allowedMimeTypes?: string[] | null;
  /**
   * When true, filesystem-root upload pipelines (e.g. Document Classifier) also
   * run for files already placed in this folder. Default false — an explicit
   * folder is treated as already filed.
   */
  runFilesystemPipelinesOnUpload?: boolean;
  [key: string]: unknown;
}

export interface PipelineStepConfig {
  prompt?: string;
  confidenceThreshold?: number;
  toolFilter?: string[];
  [key: string]: unknown;
}

export const filesystemTemplateCategories = pgTable(
  'filesystem_template_category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => filesystemTemplates.id, { onDelete: 'cascade' }),
    parentCategoryId: uuid('parent_category_id').references((): AnyPgColumn => filesystemTemplateCategories.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    description: text('description'),
    slug: text('slug').notNull(),
    config: jsonb('config').$type<CategoryConfig>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_fs_template_category_template').on(t.templateId),
  ],
);

/** Instance kind mirrors template kinds: company = org-wide; project = per-job. */
export type FilesystemKind = FilesystemTemplateKind;

export const filesystems = pgTable(
  'filesystem',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    kind: text('kind').$type<FilesystemKind>().notNull().default('company'),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'restrict' }),
    name: text('name').notNull().default('Documents'),
    sourceTemplateId: uuid('source_template_id').references(() => filesystemTemplates.id),
    copiedAt: timestamp('copied_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_filesystem_tenant').on(t.tenantId),
    index('idx_filesystem_tenant_kind').on(t.tenantId, t.kind),
    index('idx_filesystem_job').on(t.jobId),
    check('chk_filesystem_kind', sql`kind IN ('company', 'project')`),
    check(
      'chk_filesystem_kind_job',
      sql`(kind = 'company' AND job_id IS NULL) OR (kind = 'project' AND job_id IS NOT NULL)`,
    ),
    uniqueIndex('filesystem_tenant_company_unique')
      .on(t.tenantId)
      .where(sql`kind = 'company' AND archived_at IS NULL`),
    uniqueIndex('filesystem_job_project_unique')
      .on(t.jobId)
      .where(sql`kind = 'project' AND job_id IS NOT NULL AND archived_at IS NULL`),
  ],
);

export const filesystemCategories = pgTable(
  'filesystem_category',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    filesystemId: uuid('filesystem_id')
      .notNull()
      .references(() => filesystems.id, { onDelete: 'cascade' }),
    parentCategoryId: uuid('parent_category_id').references((): AnyPgColumn => filesystemCategories.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    description: text('description'),
    slug: text('slug').notNull(),
    config: jsonb('config').$type<CategoryConfig>().notNull().default({}),
    sortOrder: integer('sort_order').notNull().default(0),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_fs_category_filesystem').on(t.filesystemId),
    index('idx_fs_category_parent').on(t.parentCategoryId),
  ],
);

export const documents = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    filesystemId: uuid('filesystem_id').references(() => filesystems.id, {
      onDelete: 'set null',
    }),
    filesystemCategoryId: uuid('filesystem_category_id').references(() => filesystemCategories.id, { onDelete: 'set null' }),
    relatedRecordType: text('related_record_type'),
    relatedRecordId: uuid('related_record_id'),
    fileName: text('file_name').notNull(),
    mimeType: text('mime_type').notNull(),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    gcsBucket: text('gcs_bucket').notNull(),
    gcsObjectPath: text('gcs_object_path').notNull(),
    uri: text('uri'),
    thumbnailUri: text('thumbnail_uri'),
    uploadStatus: text('upload_status').notNull().default('pending'),
    sourceSystem: text('source_system').notNull().default('claims-manager'),
    uploadedByUserId: text('uploaded_by_user_id'),
    pipelineStatus: text('pipeline_status'),
    pipelineError: text('pipeline_error'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_document_tenant').on(t.tenantId),
    index('idx_document_category').on(t.filesystemCategoryId),
    index('idx_document_filesystem').on(t.filesystemId),
    index('idx_document_related').on(t.tenantId, t.relatedRecordType, t.relatedRecordId),
    index('idx_document_status').on(t.tenantId, t.uploadStatus),
  ],
);

// ── Document Pipelines ─────────────────────────────────────────

export const documentPipelines = pgTable(
  'document_pipeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    filesystemId: uuid('filesystem_id').references(() => filesystems.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => filesystemCategories.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    triggerOn: text('trigger_on').notNull().default('upload_complete'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('document_pipeline_tenant_idx').on(t.tenantId),
    index('document_pipeline_filesystem_idx').on(t.filesystemId),
    index('document_pipeline_category_idx').on(t.categoryId),
  ],
);

export const documentPipelineSteps = pgTable(
  'document_pipeline_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => documentPipelines.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(),
    stepOrder: integer('step_order').notNull().default(0),
    config: jsonb('config').$type<PipelineStepConfig>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('document_pipeline_step_pipeline_idx').on(t.pipelineId),
    uniqueIndex('document_pipeline_step_order_unique').on(t.pipelineId, t.stepOrder),
  ],
);

export const documentPipelineRuns = pgTable(
  'document_pipeline_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => documentPipelines.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('document_pipeline_run_document_idx').on(t.documentId),
    index('document_pipeline_run_tenant_status_idx').on(t.tenantId, t.status),
  ],
);

export const documentPipelineRunSteps = pgTable(
  'document_pipeline_run_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    runId: uuid('run_id')
      .notNull()
      .references(() => documentPipelineRuns.id, { onDelete: 'cascade' }),
    stepId: uuid('step_id').references(() => documentPipelineSteps.id, { onDelete: 'set null' }),
    agentId: text('agent_id').notNull(),
    stepOrder: integer('step_order').notNull(),
    status: text('status').notNull().default('pending'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    inputContext: jsonb('input_context').default({}),
    outputResult: jsonb('output_result').default({}),
    error: text('error'),
    durationMs: integer('duration_ms'),
  },
  (t) => [index('document_pipeline_run_step_run_idx').on(t.runId)],
);

export const filesystemTemplatePipelines = pgTable(
  'filesystem_template_pipeline',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    templateId: uuid('template_id')
      .notNull()
      .references(() => filesystemTemplates.id, { onDelete: 'cascade' }),
    templateCategoryId: uuid('template_category_id').references(
      () => filesystemTemplateCategories.id,
      { onDelete: 'cascade' },
    ),
    name: text('name').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    triggerOn: text('trigger_on').notNull().default('upload_complete'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('filesystem_template_pipeline_template_idx').on(t.templateId),
    index('filesystem_template_pipeline_category_idx').on(t.templateCategoryId),
  ],
);

export const filesystemTemplatePipelineSteps = pgTable(
  'filesystem_template_pipeline_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => filesystemTemplatePipelines.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').notNull(),
    stepOrder: integer('step_order').notNull().default(0),
    config: jsonb('config').$type<PipelineStepConfig>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('filesystem_template_pipeline_step_pipeline_idx').on(t.pipelineId),
    uniqueIndex('filesystem_template_pipeline_step_order_unique').on(t.pipelineId, t.stepOrder),
  ],
);

// ---------------------------------------------------------------------------
// Document Templates (per-tenant scenario → filesystem .docx mapping)
// ---------------------------------------------------------------------------
export const documentTemplates = pgTable(
  'document_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    documentType: text('document_type').notNull(),
    name: text('name').notNull(),
    s3Key: text('s3_key'),
    filesystemDocumentId: uuid('filesystem_document_id').references(() => documents.id, {
      onDelete: 'set null',
    }),
    version: integer('version').notNull().default(1),
    isDefault: boolean('is_default').notNull().default(true),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_doc_template_type',
      sql`document_type IN ('default','quote','invoice','purchase_order','work_order','proposal','report','bill','rfq','job_details','scope_of_work','claim','contact','task','appointment','message','journal','vendor','assessment','jobs_list','quotes_list','invoices_list','bills_list','work_orders_list','purchase_orders_list','proposals_list','rfqs_list','reports_list','claims_list','contacts_list','tasks_list','appointments_list','messages_list','journals_list','vendors_list')`,
    ),
    unique('UQ_doc_template_tenant_type').on(t.tenantId, t.documentType),
    index('idx_doc_templates_tenant_type').on(t.tenantId, t.documentType),
    index('idx_doc_templates_filesystem_doc').on(t.filesystemDocumentId),
  ],
);

// ---------------------------------------------------------------------------
// Generated Documents (audit log of every generated PDF/DOCX)
// ---------------------------------------------------------------------------
export const generatedDocuments = pgTable(
  'generated_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    documentType: text('document_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    entityType: text('entity_type').notNull(),
    templateId: uuid('template_id').references(() => documentTemplates.id, { onDelete: 'set null' }),
    s3KeyPdf: text('s3_key_pdf').notNull(),
    s3KeyDocx: text('s3_key_docx'),
    generatedBy: uuid('generated_by'),
    trigger: text('trigger').notNull(),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'chk_gen_doc_type',
      sql`document_type IN ('quote','invoice','purchase_order','work_order','proposal','report','bill','rfq','job_details','scope_of_work','claim','contact','task','appointment','message','journal','vendor','assessment','jobs_list','quotes_list','invoices_list','bills_list','work_orders_list','purchase_orders_list','proposals_list','rfqs_list','reports_list','claims_list','contacts_list','tasks_list','appointments_list','messages_list','journals_list','vendors_list')`,
    ),
    check('chk_gen_doc_trigger', sql`trigger IN ('manual','workflow')`),
    check('chk_gen_doc_status', sql`status IN ('pending','processing','completed','failed')`),
    index('idx_gen_docs_tenant_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_gen_docs_tenant_type').on(t.tenantId, t.documentType),
    index('idx_gen_docs_template').on(t.templateId),
  ],
);

// ── Organisation Claims (ghost org claiming & verification) ────
export const organisationClaims = pgTable(
  'organisation_claims',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ghostOrganisationId: uuid('ghost_organisation_id')
      .notNull()
      .references(() => organizations.id),
    claimingTenantId: uuid('claiming_tenant_id')
      .notNull()
      .references(() => organizations.id),
    status: text('status').notNull().default('pending'),
    verificationMethod: text('verification_method'),
    evidence: jsonb('evidence').notNull().default({}),
    reviewedByUserId: text('reviewed_by_user_id'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('UQ_org_claim_ghost_tenant').on(t.ghostOrganisationId, t.claimingTenantId),
    index('idx_org_claims_ghost').on(t.ghostOrganisationId),
    index('idx_org_claims_tenant').on(t.claimingTenantId),
  ],
);

// ── PO Custody Transfers (audit log) ──────────────────────────
export const poCustodyTransfers = pgTable(
  'po_custody_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    fromTenantId: uuid('from_tenant_id')
      .notNull()
      .references(() => organizations.id),
    toTenantId: uuid('to_tenant_id')
      .notNull()
      .references(() => organizations.id),
    organisationClaimId: uuid('organisation_claim_id').references(() => organisationClaims.id),
    transferredByUserId: text('transferred_by_user_id'),
    transferredAt: timestamp('transferred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => [
    index('idx_custody_transfer_po').on(t.purchaseOrderId),
  ],
);

// ── Quote Custody Transfers (audit log) ───────────────────────
export const quoteCustodyTransfers = pgTable(
  'quote_custody_transfers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    quoteId: uuid('quote_id')
      .notNull()
      .references(() => quotes.id),
    fromTenantId: uuid('from_tenant_id')
      .notNull()
      .references(() => organizations.id),
    toTenantId: uuid('to_tenant_id')
      .notNull()
      .references(() => organizations.id),
    organisationClaimId: uuid('organisation_claim_id').references(() => organisationClaims.id),
    transferredByUserId: text('transferred_by_user_id'),
    transferredAt: timestamp('transferred_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => [index('idx_custody_transfer_quote').on(t.quoteId)],
);

// ── Agentic AI Platform (doc 46) ───────────────────────────────

export const aiSettings = pgTable(
  'ai_settings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    defaultProvider: text('default_provider').notNull().default('vertex-gemini'),
    defaultModel: text('default_model').notNull().default('gemini-2.5-flash'),
    defaultTemperature: numeric('default_temperature', { precision: 3, scale: 2 }).notNull().default('0.7'),
    maxTokensPerResponse: integer('max_tokens_per_response').notNull().default(8192),
    enabled: boolean('enabled').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('ai_settings_tenant_id_unique').on(t.tenantId)],
);

export const mcpIntegration = pgTable(
  'mcp_integration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    url: text('url').notNull(),
    transportType: text('transport_type').notNull().default('http'),
    supportedAuthTypes: jsonb('supported_auth_types').notNull().default(['none']),
    authConfig: jsonb('auth_config').default({}),
    visibility: text('visibility').notNull().default('org'),
    status: text('status').notNull().default('draft'),
    trustedServer: boolean('trusted_server').notNull().default(false),
    sharedConnectionPolicy: text('shared_connection_policy').notNull().default('user_required'),
    createdByUserId: uuid('created_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('mcp_integration_transport_type_check', sql`transport_type IN ('http', 'sse')`),
    check('mcp_integration_visibility_check', sql`visibility IN ('public', 'org', 'private')`),
    check('mcp_integration_status_check', sql`status IN ('draft', 'active', 'disabled', 'error')`),
    check(
      'mcp_integration_shared_connection_policy_check',
      sql`shared_connection_policy IN ('org_shared', 'user_required')`,
    ),
    index('mcp_integration_tenant_idx').on(t.tenantId),
  ],
);

export const mcpConnection = pgTable(
  'mcp_connection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => mcpIntegration.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    authType: text('auth_type').notNull().default('none'),
    credentialRef: text('credential_ref'),
    status: text('status').notNull().default('pending'),
    visibility: text('visibility').notNull().default('org'),
    enabled: boolean('enabled').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('mcp_connection_auth_type_check', sql`auth_type IN ('none', 'api_key', 'bearer_passthrough', 'oauth')`),
    check(
      'mcp_connection_status_check',
      sql`status IN ('pending', 'connected', 'reauth_required', 'expired', 'revoked', 'error')`,
    ),
    check('mcp_connection_visibility_check', sql`visibility IN ('org', 'private')`),
    index('mcp_connection_integration_org_idx').on(t.integrationId, t.tenantId),
    uniqueIndex('mcp_connection_org_integration_user_unique')
      .on(t.tenantId, t.integrationId, t.userId)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const mcpToolManifest = pgTable('mcp_tool_manifest', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => mcpConnection.id, { onDelete: 'cascade' }),
  schemaHash: text('schema_hash').notNull(),
  toolCount: integer('tool_count').notNull().default(0),
  manifest: jsonb('manifest').notNull().default([]),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mcpOauthState = pgTable(
  'mcp_oauth_state',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    integrationId: uuid('integration_id')
      .notNull()
      .references(() => mcpIntegration.id, { onDelete: 'cascade' }),
    state: text('state').notNull().unique(),
    nonce: text('nonce'),
    pkceVerifier: text('pkce_verifier').notNull(),
    redirectUri: text('redirect_uri').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const agent = pgTable(
  'agent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    slug: text('slug'),
    name: text('name').notNull(),
    description: text('description'),
    type: text('type').notNull().default('chat'),
    chatEnabled: boolean('chat_enabled').notNull().default(true),
    provider: text('provider').notNull().default('vertex-gemini'),
    model: text('model').notNull().default('gemini-2.5-flash'),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.7'),
    maxTokens: integer('max_tokens').default(8192),
    systemPrompt: text('system_prompt'),
    enabledToolRefs: jsonb('enabled_tool_refs').default([]),
    connectionIds: uuid('connection_ids').array().default([]),
    visibility: text('visibility').notNull().default('org'),
    supportsVision: boolean('supports_vision').notNull().default(false),
    maxSteps: integer('max_steps').notNull().default(10),
    autonomousMode: boolean('autonomous_mode').notNull().default(false),
    pauseAfterToolSteps: integer('pause_after_tool_steps').notNull().default(4),
    maxDurationSeconds: integer('max_duration_seconds').notNull().default(120),
    avatarUrl: text('avatar_url'),
    isDefault: boolean('is_default').notNull().default(false),
    pinnedSkills: uuid('pinned_skills').array().default([]),
    semanticSkills: text('semantic_skills').default('all'),
    packInstallId: uuid('pack_install_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('agent_type_check', sql`type IN ('chat', 'system')`),
    check('agent_visibility_check', sql`visibility IN ('public', 'org', 'private')`),
    check('agent_semantic_skills_check', sql`semantic_skills IN ('all', 'none', 'pinned_only')`),
    index('agent_tenant_idx').on(t.tenantId),
    uniqueIndex('agent_tenant_slug_unique')
      .on(t.tenantId, t.slug)
      .where(sql`slug IS NOT NULL`),
  ],
);

export const chatConversation = pgTable(
  'chat_conversation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    agentId: uuid('agent_id').references(() => agent.id),
    title: text('title'),
    messagesJsonb: jsonb('messages_jsonb').notNull().default([]),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: uuid('related_entity_id'),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('chat_conversation_tenant_user_idx').on(t.tenantId, t.userId),
    index('chat_conversation_updated_idx').on(t.tenantId, t.userId, t.updatedAt),
    index('chat_conversation_entity_idx').on(t.relatedEntityType, t.relatedEntityId),
  ],
);

export const aiMessageAudit = pgTable(
  'ai_message_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    conversationId: uuid('conversation_id').references(() => chatConversation.id),
    agentId: uuid('agent_id').references(() => agent.id),
    agentName: text('agent_name'),
    model: text('model').notNull(),
    provider: text('provider').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    toolCallsCount: integer('tool_calls_count').notNull().default(0),
    toolNames: text('tool_names').array().default([]),
    systemPromptSnapshot: text('system_prompt_snapshot'),
    durationMs: integer('duration_ms'),
    status: text('status').notNull().default('success'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ai_message_audit_status_check', sql`status IN ('success', 'error', 'cancelled')`),
    index('ai_message_audit_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('ai_message_audit_conversation_idx').on(t.conversationId),
  ],
);

export const mcpToolInvocation = pgTable(
  'mcp_tool_invocation',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    agentId: uuid('agent_id'),
    conversationId: uuid('conversation_id'),
    messageAuditId: uuid('message_audit_id'),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => mcpConnection.id),
    toolName: text('tool_name').notNull(),
    namespacedToolId: text('namespaced_tool_id').notNull(),
    inputArgs: jsonb('input_args'),
    resultSummary: text('result_summary'),
    status: text('status').notNull().default('pending'),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('mcp_tool_invocation_status_check', sql`status IN ('pending', 'success', 'error', 'timeout')`),
  ],
);

export const canvasArtifact = pgTable(
  'canvas_artifact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id').references(() => chatConversation.id),
    contentType: text('content_type').notNull(),
    title: text('title'),
    content: text('content'),
    componentName: text('component_name'),
    componentProps: jsonb('component_props'),
    language: text('language'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('canvas_artifact_content_type_check', sql`content_type IN ('markdown', 'code', 'component')`),
  ],
);

export const conversationShare = pgTable(
  'conversation_share',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversation.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').notNull(),
    shareToken: text('share_token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('conversation_share_token_idx').on(t.shareToken),
    index('conversation_share_conversation_idx').on(t.conversationId),
  ],
);

export const skill = pgTable(
  'skill',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    triggerHints: text('trigger_hints').array().default([]),
    instructionPrompt: text('instruction_prompt').notNull(),
    requiredToolRefs: jsonb('required_tool_refs').default([]),
    inputSchema: jsonb('input_schema'),
    outputSchema: jsonb('output_schema'),
    invocationMode: text('invocation_mode').notNull().default('inline'),
    includeHistory: boolean('include_history').notNull().default(false),
    historyMessageCount: integer('history_message_count').default(5),
    modelOverride: text('model_override'),
    providerOverride: text('provider_override'),
    category: text('category').default('general'),
    visibility: text('visibility').notNull().default('org'),
    // Phase 4: upgrade to pgvector vector(768) for semantic skill matching
    embedding: jsonb('embedding'),
    embeddingVec: vector('embedding_vec'),
    packInstallId: uuid('pack_install_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('skill_invocation_mode_check', sql`invocation_mode IN ('inline', 'isolated')`),
    check('skill_visibility_check', sql`visibility IN ('public', 'org', 'private')`),
    index('skill_tenant_idx').on(t.tenantId),
  ],
);

export const aiMessageFeedback = pgTable(
  'ai_message_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    conversationId: uuid('conversation_id').notNull(),
    messageId: text('message_id').notNull(),
    rating: text('rating').notNull(),
    categories: jsonb('categories').default([]),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ai_message_feedback_rating_check', sql`rating IN ('positive', 'negative')`),
    uniqueIndex('ai_message_feedback_message_user_idx').on(t.messageId, t.userId),
  ],
);

export const aiUsageQuota = pgTable(
  'ai_usage_quota',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    quotaType: text('quota_type').notNull().default('tokens'),
    period: text('period').notNull().default('monthly'),
    limitValue: bigint('limit_value', { mode: 'number' }).notNull(),
    warnThresholdPct: integer('warn_threshold_pct').notNull().default(80),
    enforcement: text('enforcement').notNull().default('warn'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('ai_usage_quota_quota_type_check', sql`quota_type IN ('tokens', 'messages', 'cost')`),
    check('ai_usage_quota_period_check', sql`period IN ('daily', 'monthly')`),
    check('ai_usage_quota_enforcement_check', sql`enforcement IN ('warn', 'enforce')`),
    unique('ai_usage_quota_tenant_type_period_unique').on(t.tenantId, t.quotaType, t.period),
  ],
);

export const aiChatNotification = pgTable(
  'ai_chat_notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => chatConversation.id),
    eventType: text('event_type').notNull(),
    title: text('title'),
    isRead: boolean('is_read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ai_chat_notification_user_idx').on(t.tenantId, t.userId, t.isRead)],
);

export const aiUserMemory = pgTable(
  'ai_user_memory',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    scope: text('scope').notNull().default('global'),
    scopeId: text('scope_id'),
    key: text('key').notNull(),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('ai_user_memory_tenant_user_key_unique').on(t.tenantId, t.userId, t.key),
  ],
);

export const aiScheduledTask = pgTable(
  'ai_scheduled_task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull(),
    name: text('name').notNull(),
    scheduleType: text('schedule_type').notNull().default('cron'),
    cronExpression: text('cron_expression'),
    runAt: timestamp('run_at', { withTimezone: true }),
    agentId: uuid('agent_id').references(() => agent.id),
    conversationId: uuid('conversation_id').references(() => chatConversation.id),
    prompt: text('prompt').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('ai_scheduled_task_tenant_user_idx').on(t.tenantId, t.userId),
    index('ai_scheduled_task_next_run_idx').on(t.enabled, t.nextRunAt),
  ],
);

export const promptTemplate = pgTable('prompt_template', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  templateText: text('template_text').notNull(),
  variables: jsonb('variables').default([]),
  category: text('category').default('general'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const capabilityPackInstall = pgTable(
  'capability_pack_install',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    packId: text('pack_id').notNull(),
    packVersion: text('pack_version').notNull(),
    status: text('status').notNull().default('active'),
    source: text('source').notNull().default('builtin'),
    displayName: text('display_name'),
    errorMessage: text('error_message'),
    uploadId: uuid('upload_id'),
    installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'capability_pack_install_status_check',
      sql`status IN ('active', 'disabled', 'upgrading', 'error')`,
    ),
    check(
      'capability_pack_install_source_check',
      sql`source IN ('builtin', 'upload')`,
    ),
    index('capability_pack_install_tenant_idx').on(t.tenantId),
    uniqueIndex('capability_pack_install_tenant_pack_active_uidx')
      .on(t.tenantId, t.packId)
      .where(sql`status IN ('active', 'upgrading')`),
  ],
);

export const capabilityPackArtefact = pgTable(
  'capability_pack_artefact',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    installId: uuid('install_id')
      .notNull()
      .references(() => capabilityPackInstall.id, { onDelete: 'cascade' }),
    artefactType: text('artefact_type').notNull(),
    artefactId: uuid('artefact_id').notNull(),
    sourceHash: text('source_hash'),
    sourceKey: text('source_key'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'capability_pack_artefact_artefact_type_check',
      sql`artefact_type IN ('agent', 'skill', 'prompt_template')`,
    ),
    uniqueIndex('capability_pack_artefact_install_artefact_uidx').on(
      t.installId,
      t.artefactType,
      t.artefactId,
    ),
  ],
);

export const capabilityPackUpload = pgTable(
  'capability_pack_upload',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    packId: text('pack_id').notNull(),
    packVersion: text('pack_version').notNull(),
    displayName: text('display_name'),
    description: text('description'),
    bundleJson: jsonb('bundle_json').notNull(),
    manifestJson: jsonb('manifest_json').notNull(),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('capability_pack_upload_tenant_idx').on(t.tenantId),
    index('capability_pack_upload_pack_idx').on(t.tenantId, t.packId),
  ],
);

// RBAC — Shore-shaped tables owned by auth-server (shared DB)
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleName: text('role_name').notNull().unique(),
  scope: text('scope').notNull().default('org'),
  label: text('label').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  defaultForEvent: text('default_for_event'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  permissionName: text('permission_name').notNull().unique(),
  label: text('label').notNull(),
  description: text('description'),
  category: text('category').notNull().default('domain'),
  resourceGroup: text('resource_group'),
  scope: text('scope').notNull().default('all'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  'role_permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('role_permissions_role_permission_key').on(t.roleId, t.permissionId)],
);

export const userRoleAssignments = pgTable(
  'user_role_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    roleName: text('role_name').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    unique('user_role_assignments_user_org_role_key').on(
      t.userId,
      t.organizationId,
      t.roleName,
    ),
  ],
);

export const features = pgTable('features', {
  id: uuid('id').primaryKey().defaultRandom(),
  featureKey: text('feature_key').notNull().unique(),
  defaultEnabled: boolean('default_enabled').notNull().default(false),
  label: text('label'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const featureGrants = pgTable(
  'feature_grants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    featureId: uuid('feature_id')
      .notNull()
      .references(() => features.id, { onDelete: 'cascade' }),
    scope: text('scope').notNull(),
    scopeId: uuid('scope_id').notNull(),
    enabled: boolean('enabled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('feature_grants_feature_scope_key').on(t.featureId, t.scope, t.scopeId)],
);
// Assessments
export const assessments = pgTable(
  'assessments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('draft'),
    reportExternalReference: text('report_external_reference'),

    attendance: jsonb('attendance').$type<Record<string, unknown>>().notNull().default({}),
    building: jsonb('building').$type<Record<string, unknown>>().notNull().default({}),
    habitability: jsonb('habitability').$type<Record<string, unknown>>().notNull().default({}),
    hazards: jsonb('hazards').$type<Record<string, unknown>>().notNull().default({}),
    damage: jsonb('damage').$type<Record<string, unknown>>().notNull().default({}),
    makeSafe: jsonb('make_safe').$type<Record<string, unknown>>().notNull().default({}),
    temporaryAccommodation: jsonb('temporary_accommodation').$type<Record<string, unknown>>().notNull().default({}),
    specialists: jsonb('specialists').$type<Record<string, unknown>>().notNull().default({}),
    recommendation: jsonb('recommendation').$type<Record<string, unknown>>().notNull().default({}),
    extras: jsonb('extras').$type<Record<string, unknown>>().notNull().default({}),

    originType: text('origin_type').notNull().default('user'),
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_assessment_status',
      sql`status IN ('draft', 'in_progress', 'submitted', 'reviewed', 'published', 'archived')`,
    ),
    index('idx_assessments_tenant').on(t.tenantId, t.status),
  ],
);

// Relations (for Drizzle relational queries - optional)
export const claimsRelations = relations(claims, ({ one, many }) => ({
  accountLookup: one(lookupValues, {
    fields: [claims.accountLookupId],
    references: [lookupValues.id],
  }),
  statusLookup: one(lookupValues, {
    fields: [claims.statusLookupId],
    references: [lookupValues.id],
  }),
  claimContacts: many(claimContacts),
  claimAssignees: many(claimAssignees),
}));

export const jobsRelations = relations(jobs, ({ one }) => ({
  claim: one(claims, {
    fields: [jobs.claimId],
    references: [claims.id],
  }),
  vendor: one(vendors),
  jobTypeLookup: one(lookupValues, {
    fields: [jobs.jobTypeLookupId],
    references: [lookupValues.id],
  }),
  statusLookup: one(lookupValues, {
    fields: [jobs.statusLookupId],
    references: [lookupValues.id],
  }),
}));

// ---------------------------------------------------------------------------
// Document Template Transforms (per-tenant JSONata source → target mapping)
// ---------------------------------------------------------------------------
export const documentTemplateTransforms = pgTable(
  'document_template_transforms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    documentType: text('document_type').notNull(),
    jsonataRules: text('jsonata_rules'),
    targetSchema: jsonb('target_schema'),
    testData: jsonb('test_data'),
    version: integer('version').notNull().default(1),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedBy: uuid('updated_by'),
  },
  (t) => [
    unique('UQ_doc_transform_tenant_type').on(t.tenantId, t.documentType),
    index('idx_doc_transforms_tenant_type').on(t.tenantId, t.documentType),
  ],
);

// ---------------------------------------------------------------------------
// Document Template Transform Versions (history / audit trail)
// ---------------------------------------------------------------------------
export const documentTemplateTransformVersions = pgTable(
  'document_template_transform_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transformId: uuid('transform_id')
      .notNull()
      .references(() => documentTemplateTransforms.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    jsonataRules: text('jsonata_rules'),
    targetSchema: jsonb('target_schema'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid('created_by'),
  },
  (t) => [
    index('idx_doc_transform_versions_transform').on(t.transformId, t.version),
  ],
);

// ---------------------------------------------------------------------------
// Document Template Data Contexts (per-tenant related-entity enablement)
// ---------------------------------------------------------------------------
export const documentTemplateDataContexts = pgTable(
  'document_template_data_contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    documentType: text('document_type').notNull(),
    enabledSlugs: jsonb('enabled_slugs').$type<string[]>().notNull().default([]),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('UQ_doc_data_context_tenant_type').on(t.tenantId, t.documentType),
    index('idx_doc_data_contexts_tenant_type').on(t.tenantId, t.documentType),
  ],
);

// ---------------------------------------------------------------------------
// RFQ Send Requests (batch records for sending RFQs to suppliers)
// ---------------------------------------------------------------------------
export const rfqSendRequests = pgTable(
  'rfq_send_requests',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    rfqId: uuid('rfq_id')
      .notNull()
      .references(() => rfqs.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    initiatedBy: text('initiated_by'),
    generatedDocId: uuid('generated_doc_id'),
    emailSubject: text('email_subject').notNull(),
    emailBodyHtml: text('email_body_html').notNull(),
    emailBodyText: text('email_body_text'),
    replyTo: text('reply_to'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_rfq_send_requests_rfq').on(t.tenantId, t.rfqId),
    index('idx_rfq_send_requests_status').on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// RFQ Send Recipients (per-recipient tracking)
// ---------------------------------------------------------------------------
export const rfqSendRecipients = pgTable(
  'rfq_send_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sendRequestId: uuid('send_request_id')
      .notNull()
      .references(() => rfqSendRequests.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').references(() => contacts.id, { onDelete: 'set null' }),
    recipientName: text('recipient_name').notNull(),
    recipientEmail: text('recipient_email').notNull(),
    status: text('status').notNull().default('pending'),
    errorMessage: text('error_message'),
    resendMessageId: text('resend_message_id'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    retryCount: integer('retry_count').notNull().default(0),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_rfq_send_recipients_request').on(t.sendRequestId),
  ],
);

// ---------------------------------------------------------------------------
// Email Templates (configurable per tenant)
// ---------------------------------------------------------------------------
export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    templateType: text('template_type').notNull(),
    subject: text('subject').notNull(),
    bodyHtml: text('body_html').notNull(),
    bodyText: text('body_text'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('email_templates_tenant_type_uidx').on(t.tenantId, t.templateType),
  ],
);

// ---------------------------------------------------------------------------
// Entity Activities (unified audit / activity feed)
// ---------------------------------------------------------------------------
export const entityActivities = pgTable(
  'entity_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict', onUpdate: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    action: text('action').notNull(),
    actorType: text('actor_type').notNull().default('user'),
    actorId: text('actor_id'),
    actorName: text('actor_name'),
    summary: text('summary').notNull(),
    detail: jsonb('detail').notNull().default({}),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: uuid('related_entity_id'),
    source: text('source').default('internal'),
    sourceEventId: uuid('source_event_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_entity_activities_tenant_entity').on(t.tenantId, t.entityType, t.entityId, t.createdAt),
    index('idx_entity_activities_entity_action').on(t.entityId, t.action),
    index('idx_entity_activities_actor').on(t.tenantId, t.actorType, t.actorId),
  ],
);

// ---------------------------------------------------------------------------
// Tenant record number sequences (auto-incrementing entity numbers per tenant)
// ---------------------------------------------------------------------------
export const tenantRecordSequences = pgTable(
  'tenant_record_sequences',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sequenceKey: text('sequence_key').notNull(),
    nextValue: integer('next_value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.sequenceKey] })],
);
