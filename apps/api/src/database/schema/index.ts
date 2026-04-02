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
    tenantId: text('tenant_id').notNull(),
    domain: text('domain').notNull(),
    name: text('name'),
    externalReference: text('external_reference'),
    metadata: jsonb('metadata').notNull().default({}),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('UQ_lookup_tenant_domain_extref').on(t.tenantId, t.domain, t.externalReference),
    index('idx_lookup_values_domain').on(t.tenantId, t.domain),
  ],
);

// External reference resolution log
export const externalReferenceResolutionLog = pgTable('external_reference_resolution_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    sortIndex: integer('sort_index').notNull().default(0),
    sourcePayload: jsonb('source_payload').notNull().default({}),
  },
  (t) => [uniqueIndex('UQ_claim_contact').on(t.claimId, t.contactId)],
);

// Claim assignees
export const claimAssignees = pgTable('claim_assignees', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
    claimId: uuid('claim_id').notNull().references(() => claims.id, { onDelete: 'cascade' }),
    parentClaimId: uuid('parent_claim_id'),
    vendorId: uuid('vendor_id').references(() => vendors.id),
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
    tenantId: text('tenant_id').notNull(),
    claimId: uuid('claim_id').references(() => claims.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id').references(() => jobs.id, { onDelete: 'cascade' }),
    externalReference: text('external_reference'),
    quoteNumber: text('quote_number'),
    name: text('name'),
    reference: text('reference'),
    note: text('note'),
    statusLookupId: uuid('status_lookup_id'),
    quoteTypeLookupId: uuid('quote_type_lookup_id'),
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
    index('idx_quotes_job').on(t.tenantId, t.jobId),
    index('idx_quotes_claim').on(t.tenantId, t.claimId),
    index('idx_quotes_status').on(t.tenantId, t.statusLookupId),
  ],
);

// Quote groups
export const quoteGroups = pgTable('quote_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  groupLabelLookupId: uuid('group_label_lookup_id'),
  description: text('description'),
  dimensions: jsonb('dimensions').notNull().default({}),
  sortIndex: integer('sort_index').notNull().default(0),
  totals: jsonb('totals').notNull().default({}),
  groupPayload: jsonb('group_payload').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Quote combos
export const quoteCombos = pgTable('quote_combos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  quoteGroupId: uuid('quote_group_id')
    .notNull()
    .references(() => quoteGroups.id, { onDelete: 'cascade' }),
  catalogComboId: uuid('catalog_combo_id'),
  lineScopeStatusLookupId: uuid('line_scope_status_lookup_id'),
  name: text('name'),
  description: text('description'),
  category: text('category'),
  subCategory: text('sub_category'),
  quantity: numeric('quantity', { precision: 14, scale: 4 }),
  sortIndex: integer('sort_index').notNull().default(0),
  totals: jsonb('totals').notNull().default({}),
  comboPayload: jsonb('combo_payload').notNull().default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Quote items
export const quoteItems = pgTable(
  'quote_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    quoteGroupId: uuid('quote_group_id').references(() => quoteGroups.id),
    quoteComboId: uuid('quote_combo_id').references(() => quoteCombos.id),
    catalogItemId: uuid('catalog_item_id'),
    lineScopeStatusLookupId: uuid('line_scope_status_lookup_id'),
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
    allocatedCost: numeric('allocated_cost', { precision: 14, scale: 4 }),
    committedCost: numeric('committed_cost', { precision: 14, scale: 4 }),
    sortIndex: integer('sort_index').notNull().default(0),
    internal: boolean('internal'),
    note: text('note'),
    tags: jsonb('tags').notNull().default([]),
    mismatches: jsonb('mismatches').notNull().default([]),
    totals: jsonb('totals').notNull().default({}),
    itemPayload: jsonb('item_payload').notNull().default({}),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_quote_item_parent',
      sql`(quote_group_id IS NOT NULL AND quote_combo_id IS NULL) OR (quote_group_id IS NULL AND quote_combo_id IS NOT NULL)`,
    ),
  ],
);

// Purchase orders
export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
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
  ],
);

// Purchase order groups
export const purchaseOrderGroups = pgTable('purchase_order_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  groupLabelLookupId: uuid('group_label_lookup_id'),
  description: text('description'),
  dimensions: jsonb('dimensions').notNull().default({}),
  sortIndex: integer('sort_index').notNull().default(0),
  totals: jsonb('totals').notNull().default({}),
  groupPayload: jsonb('group_payload').notNull().default({}),
});

// Purchase order combos
export const purchaseOrderCombos = pgTable('purchase_order_combos', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: text('tenant_id').notNull(),
  purchaseOrderGroupId: uuid('purchase_order_group_id')
    .notNull()
    .references(() => purchaseOrderGroups.id, { onDelete: 'cascade' }),
  catalogComboId: uuid('catalog_combo_id'),
  quoteComboId: uuid('quote_combo_id'),
  name: text('name'),
  description: text('description'),
  category: text('category'),
  subCategory: text('sub_category'),
  quantity: numeric('quantity', { precision: 14, scale: 4 }),
  sortIndex: integer('sort_index').notNull().default(0),
  totals: jsonb('totals').notNull().default({}),
  comboPayload: jsonb('combo_payload').notNull().default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// Purchase order items
export const purchaseOrderItems = pgTable(
  'purchase_order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    purchaseOrderGroupId: uuid('purchase_order_group_id').references(
      () => purchaseOrderGroups.id,
    ),
    purchaseOrderComboId: uuid('purchase_order_combo_id').references(
      () => purchaseOrderCombos.id,
    ),
    catalogItemId: uuid('catalog_item_id'),
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
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    check(
      'chk_po_item_parent',
      sql`(purchase_order_group_id IS NOT NULL AND purchase_order_combo_id IS NULL) OR (purchase_order_group_id IS NULL AND purchase_order_combo_id IS NOT NULL)`,
    ),
  ],
);

// Invoices
export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
    jobId: uuid('job_id').notNull().references(() => jobs.id, { onDelete: 'cascade' }),
    contactId: uuid('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
    sortIndex: integer('sort_index').notNull().default(0),
    sourcePayload: jsonb('source_payload').notNull().default({}),
  },
  (t) => [uniqueIndex('UQ_job_contact').on(t.jobId, t.contactId)],
);

// Tasks
export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    taskTypeLookupId: uuid('task_type_lookup_id'),
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
    check('chk_task_parent', sql`claim_id IS NOT NULL OR job_id IS NOT NULL`),
    check('chk_task_priority', sql`priority IN ('Low','Medium','High','Critical')`),
    check('chk_task_status', sql`status IN ('Open','Completed','Failed')`),
    index('idx_tasks_claim').on(t.tenantId, t.claimId),
    index('idx_tasks_job').on(t.tenantId, t.jobId),
    index('idx_tasks_status').on(t.tenantId, t.status),
  ],
);

// Messages
export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id').notNull(),
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

// Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').unique(),
  config: jsonb('config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Users
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    kindeUserId: text('kinde_user_id').notNull().unique(),
    email: text('email'),
    name: text('name'),
    role: text('role'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_users_tenant').on(t.tenantId),
    index('idx_users_email').on(t.tenantId, t.email),
  ],
);

// Integration providers
export const integrationProviders = pgTable('integration_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Integration connections
export const integrationConnections = pgTable(
  'integration_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    providerId: uuid('provider_id').notNull().references(() => integrationProviders.id),
    environment: text('environment').notNull(),
    baseUrl: text('base_url').notNull(),
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
    uniqueIndex('UQ_connection_tenant_provider_env').on(t.tenantId, t.providerId, t.environment),
    index('idx_connections_tenant').on(t.tenantId),
  ],
);

// External objects
export const externalObjects = pgTable(
  'external_objects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
    connectionId: uuid('connection_id').notNull().references(() => integrationConnections.id),
    providerCode: text('provider_code').notNull(),
    providerEntityType: text('provider_entity_type').notNull(),
    providerEntityId: text('provider_entity_id').notNull(),
    normalizedEntityType: text('normalized_entity_type').notNull(),
    latestPayload: jsonb('latest_payload').notNull(),
    payloadHash: text('payload_hash'),
    fetchStatus: text('fetch_status').notNull().default('fetched'),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    lastFetchEventId: uuid('last_fetch_event_id'),
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
    changedFields: jsonb('changed_fields').notNull().default([]),
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
    tenantId: text('tenant_id').notNull(),
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
    tenantId: text('tenant_id'),
    eventType: text('event_type').notNull(),
    eventTimestamp: timestamp('event_timestamp', { withTimezone: true }).notNull(),
    payloadEntityId: uuid('payload_entity_id'),
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
    connectionId: uuid('connection_id'),
    providerCode: text('provider_code'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_webhooks_status').on(t.processingStatus, t.createdAt),
  ],
);

// External processing log
export const externalProcessingLog = pgTable(
  'external_processing_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull(),
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
