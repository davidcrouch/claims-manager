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
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_vendors_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_vendors_postcode').on(t.tenantId, t.postcode),
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
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    parentClaimId: uuid('parent_claim_id'),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    connectionId: uuid('connection_id').references(() => integrationConnections.id),
    parentJobId: uuid('parent_job_id').references((): AnyPgColumn => jobs.id),
    externalReference: text('external_reference'),
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
    apiPayload: jsonb('api_payload').notNull().default({}),
    customData: jsonb('custom_data').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_jobs_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_jobs_claim').on(t.tenantId, t.claimId),
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
    externalReference: text('external_reference'),
    quoteNumber: text('quote_number'),
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
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check('chk_quote_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    uniqueIndex('UQ_quotes_tenant_extref').on(t.tenantId, t.externalReference),
    index('idx_quotes_job').on(t.tenantId, t.jobId),
    index('idx_quotes_claim').on(t.tenantId, t.claimId),
    index('idx_quotes_status').on(t.tenantId, t.statusLookupId),
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
    externalId: text('external_id'),
    purchaseOrderNumber: text('purchase_order_number'),
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
    uniqueIndex('UQ_purchase_orders_tenant_external_id')
      .on(t.tenantId, t.externalId)
      .where(sql`external_id IS NOT NULL`),
    uniqueIndex('UQ_purchase_orders_tenant_po_number')
      .on(t.tenantId, t.purchaseOrderNumber)
      .where(sql`purchase_order_number IS NOT NULL`),
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
    purchaseOrderId: uuid('purchase_order_id')
      .notNull()
      .references(() => purchaseOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'set null' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    invoiceNumber: text('invoice_number'),
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
    createdByUserId: text('created_by_user_id'),
    updatedByUserId: text('updated_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_invoices_tenant_po_number').on(
      t.tenantId,
      t.purchaseOrderId,
      t.invoiceNumber,
    ),
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
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority').notNull().default('Low'),
    status: text('status').notNull().default('Open'),
    taskPayload: jsonb('task_payload').notNull().default({}),
    assignedToUserId: text('assigned_to_user_id'),
    assignedToExternalReference: text('assigned_to_external_reference'),
    createdByUserId: text('created_by_user_id'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
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
    check('chk_task_status', sql`status IN ('Open','Completed','Failed')`),
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
export const organizations = pgTable('organizations', {
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
});

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
      .notNull()
      .references(() => purchaseOrders.id),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    vendorId: uuid('vendor_id').references(() => vendors.id),
    sourceTenantId: uuid('source_tenant_id'),
    sourceExternalReference: text('source_external_reference'),
    externalId: text('external_id'),
    workOrderNumber: text('work_order_number'),
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
    workOrderPayload: jsonb('work_order_payload').notNull().default({}),
    sourceVersionNumber: integer('source_version_number').notNull().default(1),
    latestAvailableVersion: integer('latest_available_version').notNull().default(1),
    versionAcknowledged: boolean('version_acknowledged').notNull().default(true),
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
    sourceVersionNumber: integer('source_version_number').notNull().default(1),
    latestAvailableVersion: integer('latest_available_version').notNull().default(1),
    versionAcknowledged: boolean('version_acknowledged').notNull().default(true),
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
      .notNull()
      .references(() => integrationConnections.id, { onDelete: 'cascade' }),

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
    index('idx_outbound_poll').on(t.status, t.scheduledAt, t.priority),
    index('idx_outbound_entity').on(t.tenantId, t.entityType, t.entityId),
    index('idx_outbound_connection').on(t.connectionId, t.status),
  ],
);

// ── Item Catalogue ─────────────────────────────────────────────

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
    isActive: boolean('is_active').notNull().default(true),
    effectiveFrom: date('effective_from'),
    effectiveTo: date('effective_to'),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('UQ_catalog_items_tenant_code').on(t.tenantId, t.code),
    uniqueIndex('UQ_catalog_items_tenant_extref')
      .on(t.tenantId, t.externalReference)
      .where(sql`external_reference IS NOT NULL`),
    index('idx_catalog_items_tenant').on(t.tenantId, t.isActive, t.deletedAt),
    index('idx_catalog_items_type').on(t.tenantId, t.typeId),
    index('idx_catalog_items_category').on(t.tenantId, t.categoryId),
    index('idx_catalog_items_kind').on(t.tenantId, t.kind),
    check('chk_catalog_items_kind', sql`kind IN ('primitive', 'assembly')`),
    check(
      'chk_catalog_items_primitive_unit',
      sql`kind = 'assembly' OR unit_type_lookup_id IS NOT NULL`,
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
  claim: one(claims),
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
