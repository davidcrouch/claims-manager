import type { DocumentType } from '../types/document-types';
import type { DataContextDefinition, EntityFieldDef, RelatedEntityDef } from './types';

const f = (
  key: string,
  label: string,
  type: EntityFieldDef['type'] = 'string',
  description?: string,
): EntityFieldDef => ({ key, label, type, description });

/** Report-facing fields for each entity — aligned to Drizzle schema columns. */
const JOB_FIELDS: EntityFieldDef[] = [
  f('id', 'Job ID'),
  f('internalNumber', 'Internal number'),
  f('name', 'Job name'),
  f('externalReference', 'Job reference'),
  f('externalJobId', 'External job id'),
  f('claimId', 'Claim ID'),
  f('parentJobId', 'Parent job ID'),
  f('vendorId', 'Vendor ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('statusName', 'Status name'),
  f('jobTypeLookupId', 'Job type lookup ID'),
  f('jobTypeName', 'Job type name'),
  f('requestDate', 'Request date', 'date'),
  f('collectExcess', 'Collect excess', 'boolean'),
  f('excess', 'Excess amount', 'currency'),
  f('makeSafeRequired', 'Make safe required', 'boolean'),
  f('address', 'Site address', 'object'),
  f('addressSuburb', 'Suburb'),
  f('addressState', 'State'),
  f('addressPostcode', 'Postcode'),
  f('addressCountry', 'Country'),
  f('jobInstructions', 'Job instructions'),
  f('vendorSnapshot', 'Vendor snapshot', 'object'),
  f('temporaryAccommodationDetails', 'Temporary accommodation', 'object'),
  f('specialistDetails', 'Specialist details', 'object'),
  f('rectificationDetails', 'Rectification details', 'object'),
  f('auditDetails', 'Audit details', 'object'),
  f('mobilityConsiderations', 'Mobility considerations', 'array'),
  f('customData', 'Custom data', 'object'),
  f('syncStatus', 'Sync status'),
  f('assignedToUserId', 'Assigned user ID'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const CLAIM_FIELDS: EntityFieldDef[] = [
  f('id', 'Claim ID'),
  f('claimNumber', 'Claim number'),
  f('externalReference', 'Insurer reference'),
  f('externalClaimId', 'External claim ID'),
  f('accountLookupId', 'Account lookup ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('catCodeLookupId', 'CAT code lookup ID'),
  f('lossTypeLookupId', 'Loss type lookup ID'),
  f('lossSubtypeLookupId', 'Loss subtype lookup ID'),
  f('claimDecisionLookupId', 'Claim decision lookup ID'),
  f('priorityLookupId', 'Priority lookup ID'),
  f('policyTypeLookupId', 'Policy type lookup ID'),
  f('lineOfBusinessLookupId', 'Line of business lookup ID'),
  f('lodgementDate', 'Lodgement date', 'date'),
  f('dateOfLoss', 'Date of loss', 'date'),
  f('address', 'Risk address', 'object'),
  f('addressSuburb', 'Suburb'),
  f('addressState', 'State'),
  f('addressPostcode', 'Postcode'),
  f('addressCountry', 'Country'),
  f('addressLatitude', 'Latitude', 'number'),
  f('addressLongitude', 'Longitude', 'number'),
  f('postalAddress', 'Postal address'),
  f('policyNumber', 'Policy number'),
  f('policyName', 'Policy name'),
  f('abn', 'ABN'),
  f('policyDetails', 'Policy details', 'object'),
  f('financialDetails', 'Financial details', 'object'),
  f('vulnerabilityDetails', 'Vulnerability details', 'object'),
  f('contentionDetails', 'Contention details', 'object'),
  f('vulnerableCustomer', 'Vulnerable customer', 'boolean'),
  f('totalLoss', 'Total loss', 'boolean'),
  f('contentiousClaim', 'Contentious claim', 'boolean'),
  f('contentiousActivityFlag', 'Contentious activity', 'boolean'),
  f('autoApprovalApplies', 'Auto-approval applies', 'boolean'),
  f('contentsDamaged', 'Contents damaged', 'boolean'),
  f('incidentDescription', 'Incident description'),
  f('customData', 'Custom data', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const QUOTE_FIELDS: EntityFieldDef[] = [
  f('id', 'Quote ID'),
  f('internalNumber', 'Internal number'),
  f('quoteNumber', 'Quote number'),
  f('name', 'Name'),
  f('reference', 'Reference'),
  f('externalReference', 'External reference'),
  f('note', 'Note'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('quoteTypeLookupId', 'Quote type lookup ID'),
  f('quoteDate', 'Quote date', 'date'),
  f('expiresInDays', 'Expires in days', 'number'),
  f('subTotal', 'Subtotal', 'currency'),
  f('totalTax', 'Tax', 'currency'),
  f('totalAmount', 'Total amount', 'currency'),
  f('quoteTo', 'Quote to', 'object'),
  f('quoteFor', 'Quote for', 'object'),
  f('quoteFrom', 'Quote from', 'object'),
  f('quoteToName', 'Quote to name'),
  f('quoteToEmail', 'Quote to email'),
  f('quoteForName', 'Quote for name'),
  f('scheduleInfo', 'Schedule info', 'object'),
  f('approvalInfo', 'Approval info', 'object'),
  f('estimatedStartDate', 'Estimated start', 'date'),
  f('estimatedCompletionDate', 'Estimated completion', 'date'),
  f('isAutoApproved', 'Auto-approved', 'boolean'),
  f('ownershipStatus', 'Ownership status'),
  f('captureMethod', 'Capture method'),
  f('customData', 'Custom data', 'object'),
  f('assignedToUserId', 'Assigned user ID'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const INVOICE_FIELDS: EntityFieldDef[] = [
  f('id', 'Invoice ID'),
  f('internalNumber', 'Internal number'),
  f('invoiceNumber', 'Invoice number'),
  f('purchaseOrderId', 'Purchase order ID'),
  f('workOrderId', 'Work order ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('issueDate', 'Issue date', 'date'),
  f('receivedDate', 'Received date', 'date'),
  f('comments', 'Comments'),
  f('declinedReason', 'Declined reason'),
  f('statusLookupId', 'Status lookup ID'),
  f('subTotal', 'Subtotal', 'currency'),
  f('totalTax', 'Tax', 'currency'),
  f('totalAmount', 'Total amount', 'currency'),
  f('excessAmount', 'Excess amount', 'currency'),
  f('invoicePayload', 'Invoice payload', 'object'),
  f('ownershipStatus', 'Ownership status'),
  f('captureMethod', 'Capture method'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const PO_FIELDS: EntityFieldDef[] = [
  f('id', 'PO ID'),
  f('internalNumber', 'Internal number'),
  f('purchaseOrderNumber', 'PO number'),
  f('name', 'Name'),
  f('externalId', 'External ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('vendorId', 'Vendor ID'),
  f('quoteId', 'Quote ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('purchaseOrderTypeLookupId', 'PO type lookup ID'),
  f('scopeOfWork', 'Scope of work'),
  f('startDate', 'Start date', 'date'),
  f('endDate', 'End date', 'date'),
  f('startTime', 'Start time'),
  f('endTime', 'End time'),
  f('note', 'Note'),
  f('poTo', 'PO to', 'object'),
  f('poFor', 'PO for', 'object'),
  f('poFrom', 'PO from', 'object'),
  f('poToEmail', 'PO to email'),
  f('poForName', 'PO for name'),
  f('serviceWindow', 'Service window', 'object'),
  f('adjustmentInfo', 'Adjustment info', 'object'),
  f('allocationContext', 'Allocation context', 'object'),
  f('totalAmount', 'Total amount', 'currency'),
  f('adjustedTotal', 'Adjusted total', 'currency'),
  f('adjustedTotalAdjustmentAmount', 'Adjustment amount', 'currency'),
  f('ownershipStatus', 'Ownership status'),
  f('captureMethod', 'Capture method'),
  f('supplyChainDepth', 'Supply chain depth', 'number'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const CONTACT_FIELDS: EntityFieldDef[] = [
  f('id', 'Contact ID'),
  f('externalReference', 'External reference'),
  f('firstName', 'First name'),
  f('lastName', 'Last name'),
  f('email', 'Email'),
  f('mobilePhone', 'Mobile'),
  f('homePhone', 'Home phone'),
  f('workPhone', 'Work phone'),
  f('typeLookupId', 'Type lookup ID'),
  f('typeName', 'Primary contact type name'),
  f('typeNames', 'All contact type names', 'array'),
  f('isInsured', 'Contact is typed as Insured', 'boolean'),
  f('isTenant', 'Contact is typed as Tenant/Occupant', 'boolean'),
  f('preferredContactMethodLookupId', 'Preferred contact method'),
  f('notes', 'Notes'),
  f('contactPayload', 'Contact payload', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const TASK_FIELDS: EntityFieldDef[] = [
  f('id', 'Task ID'),
  f('name', 'Task name'),
  f('description', 'Description'),
  f('taskType', 'Task type'),
  f('taskTypeLookupId', 'Task type lookup ID'),
  f('relatedEntityType', 'Related entity type'),
  f('relatedEntityId', 'Related entity ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('status', 'Status'),
  f('priority', 'Priority'),
  f('startDate', 'Start date', 'date'),
  f('dueDate', 'Due date', 'date'),
  f('reminderAt', 'Reminder', 'date'),
  f('estimatedHours', 'Estimated hours', 'number'),
  f('notes', 'Notes'),
  f('tags', 'Tags', 'array'),
  f('taskPayload', 'Task payload', 'object'),
  f('assignedToUserId', 'Assigned user ID'),
  f('assignedToExternalReference', 'Assigned external reference'),
  f('completedAt', 'Completed at', 'date'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const APPOINTMENT_FIELDS: EntityFieldDef[] = [
  f('id', 'Appointment ID'),
  f('jobId', 'Job ID'),
  f('name', 'Name'),
  f('location', 'Location'),
  f('startDate', 'Start', 'date'),
  f('endDate', 'End', 'date'),
  f('status', 'Status'),
  f('appointmentTypeLookupId', 'Appointment type lookup ID'),
  f('specialistVisitTypeLookupId', 'Specialist visit type lookup ID'),
  f('cancellationDetails', 'Cancellation details', 'object'),
  f('appointmentPayload', 'Appointment payload', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const VENDOR_FIELDS: EntityFieldDef[] = [
  f('id', 'Vendor ID'),
  f('name', 'Vendor name'),
  f('externalReference', 'External reference'),
  f('address', 'Address', 'object'),
  f('contactDetails', 'Contact details', 'object'),
  f('vendorPayload', 'Vendor payload', 'object'),
  f('postcode', 'Postcode'),
  f('state', 'State'),
  f('city', 'City'),
  f('country', 'Country'),
  f('phone', 'Phone'),
  f('afterHoursPhone', 'After-hours phone'),
  f('organisationId', 'Organisation ID'),
  f('isActive', 'Active', 'boolean'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const ASSESSMENT_FIELDS: EntityFieldDef[] = [
  f('id', 'Assessment ID'),
  f('jobId', 'Job ID'),
  f('name', 'Name'),
  f('status', 'Status'),
  f('reportExternalReference', 'Report external reference'),
  f('attendance', 'Attendance details', 'object'),
  f('building', 'Building details', 'object'),
  f('habitability', 'Habitability', 'object'),
  f('hazards', 'Hazards', 'object'),
  f('damage', 'Damage details', 'object'),
  f('makeSafe', 'Make safe', 'object'),
  f('temporaryAccommodation', 'Temporary accommodation', 'object'),
  f('specialists', 'Specialists', 'object'),
  f('recommendation', 'Recommendation', 'object'),
  f('extras', 'Extras', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const REPORT_FIELDS: EntityFieldDef[] = [
  f('id', 'Report ID'),
  f('title', 'Title'),
  f('reference', 'Reference'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('reportTypeLookupId', 'Report type lookup ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('reportData', 'Report data', 'object'),
  f('reportMeta', 'Report meta', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const WORK_ORDER_FIELDS: EntityFieldDef[] = [
  f('id', 'Work order ID'),
  f('internalNumber', 'Internal number'),
  f('workOrderNumber', 'Work order number'),
  f('name', 'Name'),
  f('purchaseOrderId', 'Purchase order ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('vendorId', 'Vendor ID'),
  f('externalId', 'External ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('workOrderTypeLookupId', 'Work order type lookup ID'),
  f('startDate', 'Start date', 'date'),
  f('endDate', 'End date', 'date'),
  f('startTime', 'Start time'),
  f('endTime', 'End time'),
  f('note', 'Note'),
  f('scopeOfWork', 'Scope of work'),
  f('woTo', 'WO to', 'object'),
  f('woFor', 'WO for', 'object'),
  f('woFrom', 'WO from', 'object'),
  f('serviceWindow', 'Service window', 'object'),
  f('woToEmail', 'WO to email'),
  f('woForName', 'WO for name'),
  f('totalAmount', 'Total amount', 'currency'),
  f('adjustedTotal', 'Adjusted total', 'currency'),
  f('workOrderPayload', 'Work order payload', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const BILL_FIELDS: EntityFieldDef[] = [
  f('id', 'Bill ID'),
  f('billNumber', 'Bill number'),
  f('externalReference', 'External reference'),
  f('invoiceId', 'Invoice ID'),
  f('purchaseOrderId', 'Purchase order ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('vendorId', 'Vendor ID'),
  f('issueDate', 'Issue date', 'date'),
  f('receivedDate', 'Received date', 'date'),
  f('dueDate', 'Due date', 'date'),
  f('paymentDate', 'Payment date', 'date'),
  f('comments', 'Comments'),
  f('declinedReason', 'Declined reason'),
  f('statusLookupId', 'Status lookup ID'),
  f('paymentStatusLookupId', 'Payment status lookup ID'),
  f('subTotal', 'Subtotal', 'currency'),
  f('totalTax', 'Tax', 'currency'),
  f('totalAmount', 'Total amount', 'currency'),
  f('billPayload', 'Bill payload', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const PROPOSAL_FIELDS: EntityFieldDef[] = [
  f('id', 'Proposal ID'),
  f('proposalNumber', 'Proposal number'),
  f('name', 'Name'),
  f('reference', 'Reference'),
  f('note', 'Note'),
  f('quoteId', 'Quote ID'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('rfqId', 'RFQ ID'),
  f('vendorId', 'Vendor ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('proposalTypeLookupId', 'Proposal type lookup ID'),
  f('receivedDate', 'Received date', 'date'),
  f('proposalDate', 'Proposal date', 'date'),
  f('expiresInDays', 'Expires in days', 'number'),
  f('subTotal', 'Subtotal', 'currency'),
  f('totalTax', 'Tax', 'currency'),
  f('totalAmount', 'Total amount', 'currency'),
  f('proposalTo', 'Proposal to', 'object'),
  f('proposalFor', 'Proposal for', 'object'),
  f('proposalFrom', 'Proposal from', 'object'),
  f('proposalToEmail', 'Proposal to email'),
  f('proposalToName', 'Proposal to name'),
  f('proposalFromName', 'Proposal from name'),
  f('customData', 'Custom data', 'object'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

const RFQ_FIELDS: EntityFieldDef[] = [
  f('id', 'RFQ ID'),
  f('internalNumber', 'Internal number'),
  f('rfqNumber', 'RFQ number'),
  f('name', 'Name'),
  f('note', 'Note'),
  f('claimId', 'Claim ID'),
  f('jobId', 'Job ID'),
  f('quoteId', 'Quote ID'),
  f('vendorId', 'Vendor ID'),
  f('statusLookupId', 'Status lookup ID'),
  f('sentDate', 'Sent date', 'date'),
  f('dueDate', 'Due date', 'date'),
  f('receivedDate', 'Received date', 'date'),
  f('includePricing', 'Include pricing', 'boolean'),
  f('includeQuantities', 'Include quantities', 'boolean'),
  f('rfqTo', 'RFQ to', 'object'),
  f('rfqFrom', 'RFQ from', 'object'),
  f('rfqToEmail', 'RFQ to email'),
  f('rfqToName', 'RFQ to name'),
  f('supplyChainDepth', 'Supply chain depth', 'number'),
  f('createdAt', 'Created at', 'date'),
  f('updatedAt', 'Updated at', 'date'),
];

function relatedJob(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Job',
    slug: 'job',
    label: 'Job details',
    description: 'The job linked to this record',
    cardinality: 'one',
    traversalPath: ['jobId'],
    fields: JOB_FIELDS,
    defaultEnabled: true,
    ...overrides,
  };
}

function relatedClaimViaJob(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Claim',
    slug: 'claim',
    label: 'Claim details',
    description: 'The insurance claim (via job)',
    cardinality: 'one',
    traversalPath: ['jobId', 'claimId'],
    fields: CLAIM_FIELDS,
    defaultEnabled: false,
    ...overrides,
  };
}

function relatedClaimDirect(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Claim',
    slug: 'claim',
    label: 'Claim details',
    description: 'The insurance claim',
    cardinality: 'one',
    traversalPath: ['claimId'],
    fields: CLAIM_FIELDS,
    defaultEnabled: true,
    ...overrides,
  };
}

function relatedQuotesViaJob(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Quote',
    slug: 'quotes',
    label: 'Quotes / estimates',
    description: 'Quotes linked to the job',
    cardinality: 'many',
    traversalPath: ['jobId'],
    parentFk: 'jobId',
    fields: QUOTE_FIELDS,
    defaultEnabled: false,
    ...overrides,
  };
}

function relatedContactsViaJob(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Contact',
    slug: 'contacts',
    label: 'Contacts',
    description: 'People associated with the job',
    cardinality: 'many',
    traversalPath: ['jobId'],
    parentFk: 'jobId',
    viaJoin: 'job_contacts',
    fields: CONTACT_FIELDS,
    defaultEnabled: false,
    ...overrides,
  };
}

function relatedClaimContactsViaJob(overrides: Partial<RelatedEntityDef> = {}): RelatedEntityDef {
  return {
    entityType: 'Contact',
    slug: 'claim_contacts',
    label: 'Claim contacts',
    description: 'People associated with the linked claim',
    cardinality: 'many',
    traversalPath: ['jobId', 'claimId'],
    viaJoin: 'claim_contacts',
    fields: CONTACT_FIELDS,
    defaultEnabled: false,
    ...overrides,
  };
}

const ASSESSMENT_CONTEXT: DataContextDefinition = {
  documentType: 'assessment',
  primaryEntity: {
    entityType: 'Assessment',
    label: 'Assessment',
    fields: ASSESSMENT_FIELDS,
  },
  relatedEntities: [
    relatedJob(),
    relatedClaimViaJob(),
    relatedQuotesViaJob(),
    relatedContactsViaJob(),
    {
      entityType: 'Appointment',
      slug: 'appointments',
      label: 'Appointments',
      description: 'Site visits booked on the job',
      cardinality: 'many',
      traversalPath: ['jobId'],
      parentFk: 'jobId',
      fields: APPOINTMENT_FIELDS,
      defaultEnabled: false,
    },
  ],
};

const QUOTE_CONTEXT: DataContextDefinition = {
  documentType: 'quote',
  primaryEntity: {
    entityType: 'Quote',
    label: 'Quote',
    fields: QUOTE_FIELDS,
  },
  relatedEntities: [
    relatedJob({ defaultEnabled: true }),
    {
      ...relatedClaimViaJob({ defaultEnabled: false }),
      description: 'The insurance claim (via job or direct claim link)',
    },
    relatedClaimDirect({
      slug: 'claim_direct',
      label: 'Claim (direct)',
      description: 'Claim linked directly on the quote when present',
      defaultEnabled: false,
    }),
  ],
};

const INVOICE_CONTEXT: DataContextDefinition = {
  documentType: 'invoice',
  primaryEntity: {
    entityType: 'Invoice',
    label: 'Invoice',
    fields: INVOICE_FIELDS,
  },
  relatedEntities: [
    {
      entityType: 'PurchaseOrder',
      slug: 'purchase_order',
      label: 'Purchase order',
      description: 'The purchase order this invoice is billed against',
      cardinality: 'one',
      traversalPath: ['purchaseOrderId'],
      fields: PO_FIELDS,
      defaultEnabled: true,
    },
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: false }),
  ],
};

const JOB_DETAILS_CONTEXT: DataContextDefinition = {
  documentType: 'job_details',
  primaryEntity: {
    entityType: 'Job',
    label: 'Job',
    fields: JOB_FIELDS,
  },
  relatedEntities: [
    relatedClaimDirect(),
    {
      entityType: 'Quote',
      slug: 'quotes',
      label: 'Quotes / estimates',
      description: 'Quotes on this job',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'jobId',
      fields: QUOTE_FIELDS,
      defaultEnabled: false,
    },
    {
      entityType: 'Task',
      slug: 'tasks',
      label: 'Tasks',
      description: 'Open and completed tasks on this job',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'jobId',
      fields: TASK_FIELDS,
      defaultEnabled: false,
    },
    {
      entityType: 'Appointment',
      slug: 'appointments',
      label: 'Appointments',
      description: 'Site visits on this job',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'jobId',
      fields: APPOINTMENT_FIELDS,
      defaultEnabled: false,
    },
    {
      entityType: 'Contact',
      slug: 'contacts',
      label: 'Contacts',
      description: 'People associated with this job',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'jobId',
      viaJoin: 'job_contacts',
      fields: CONTACT_FIELDS,
      defaultEnabled: false,
    },
  ],
};

const SCOPE_OF_WORK_CONTEXT: DataContextDefinition = {
  documentType: 'scope_of_work',
  primaryEntity: {
    entityType: 'Quote',
    label: 'Estimate / quote',
    fields: QUOTE_FIELDS,
  },
  relatedEntities: [
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: true }),
    relatedClaimDirect({
      slug: 'claim_direct',
      label: 'Claim (direct)',
      description: 'Claim linked directly on the estimate when present',
      defaultEnabled: false,
    }),
    relatedContactsViaJob({ defaultEnabled: true }),
    relatedClaimContactsViaJob({ defaultEnabled: true }),
  ],
};

const PURCHASE_ORDER_CONTEXT: DataContextDefinition = {
  documentType: 'purchase_order',
  primaryEntity: {
    entityType: 'PurchaseOrder',
    label: 'Purchase order',
    fields: PO_FIELDS,
  },
  relatedEntities: [
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: true }),
    {
      entityType: 'Quote',
      slug: 'quote',
      label: 'Source quote',
      description: 'The quote this purchase order was created from',
      cardinality: 'one',
      traversalPath: ['quoteId'],
      fields: QUOTE_FIELDS,
      defaultEnabled: false,
    },
    {
      entityType: 'Vendor',
      slug: 'vendor',
      label: 'Vendor',
      description: 'Supplier on the purchase order',
      cardinality: 'one',
      traversalPath: ['vendorId'],
      fields: VENDOR_FIELDS,
      defaultEnabled: true,
    },
    relatedContactsViaJob({ defaultEnabled: true }),
    relatedClaimContactsViaJob({ defaultEnabled: true }),
  ],
};

const WORK_ORDER_CONTEXT: DataContextDefinition = {
  documentType: 'work_order',
  primaryEntity: {
    entityType: 'WorkOrder',
    label: 'Work order',
    fields: WORK_ORDER_FIELDS,
  },
  relatedEntities: [
    {
      entityType: 'PurchaseOrder',
      slug: 'purchase_order',
      label: 'Purchase order',
      description: 'Parent purchase order',
      cardinality: 'one',
      traversalPath: ['purchaseOrderId'],
      fields: PO_FIELDS,
      defaultEnabled: true,
    },
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: true }),
    relatedContactsViaJob({ defaultEnabled: true }),
    relatedClaimContactsViaJob({ defaultEnabled: true }),
  ],
};

const CLAIM_CONTEXT: DataContextDefinition = {
  documentType: 'claim',
  primaryEntity: {
    entityType: 'Claim',
    label: 'Claim',
    fields: CLAIM_FIELDS,
  },
  relatedEntities: [
    {
      entityType: 'Job',
      slug: 'jobs',
      label: 'Jobs',
      description: 'Jobs on this claim',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'claimId',
      fields: JOB_FIELDS,
      defaultEnabled: true,
    },
    {
      entityType: 'Contact',
      slug: 'contacts',
      label: 'Contacts',
      description: 'People associated with this claim',
      cardinality: 'many',
      traversalPath: [],
      parentFk: 'claimId',
      viaJoin: 'claim_contacts',
      fields: CONTACT_FIELDS,
      defaultEnabled: false,
    },
  ],
};

const REPORT_CONTEXT: DataContextDefinition = {
  documentType: 'report',
  primaryEntity: {
    entityType: 'Report',
    label: 'Report',
    fields: REPORT_FIELDS,
  },
  relatedEntities: [
    relatedJob({ defaultEnabled: true }),
    relatedClaimDirect({ defaultEnabled: true }),
  ],
};

const BILL_CONTEXT: DataContextDefinition = {
  documentType: 'bill',
  primaryEntity: {
    entityType: 'Bill',
    label: 'Bill',
    fields: BILL_FIELDS,
  },
  relatedEntities: [
    {
      entityType: 'Invoice',
      slug: 'invoice',
      label: 'Invoice',
      description: 'Source invoice',
      cardinality: 'one',
      traversalPath: ['invoiceId'],
      fields: INVOICE_FIELDS,
      defaultEnabled: true,
    },
    {
      entityType: 'PurchaseOrder',
      slug: 'purchase_order',
      label: 'Purchase order',
      description: 'Linked purchase order when present',
      cardinality: 'one',
      traversalPath: ['purchaseOrderId'],
      fields: PO_FIELDS,
      defaultEnabled: true,
    },
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: false }),
  ],
};

const PROPOSAL_CONTEXT: DataContextDefinition = {
  documentType: 'proposal',
  primaryEntity: {
    entityType: 'Proposal',
    label: 'Proposal',
    fields: PROPOSAL_FIELDS,
  },
  relatedEntities: [
    {
      entityType: 'Quote',
      slug: 'quote',
      label: 'Source quote',
      description: 'The estimate this proposal responds to',
      cardinality: 'one',
      traversalPath: ['quoteId'],
      fields: QUOTE_FIELDS,
      defaultEnabled: true,
    },
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: false }),
  ],
};

const RFQ_CONTEXT: DataContextDefinition = {
  documentType: 'rfq',
  primaryEntity: {
    entityType: 'RFQ',
    label: 'RFQ',
    fields: RFQ_FIELDS,
  },
  relatedEntities: [
    relatedJob({ defaultEnabled: true }),
    relatedClaimViaJob({ defaultEnabled: true }),
    {
      entityType: 'Quote',
      slug: 'quote',
      label: 'Source quote',
      description: 'Linked estimate when present',
      cardinality: 'one',
      traversalPath: ['quoteId'],
      fields: QUOTE_FIELDS,
      defaultEnabled: false,
    },
    relatedContactsViaJob({ defaultEnabled: true }),
    relatedClaimContactsViaJob({ defaultEnabled: true }),
  ],
};

const DEFINITIONS: DataContextDefinition[] = [
  ASSESSMENT_CONTEXT,
  QUOTE_CONTEXT,
  INVOICE_CONTEXT,
  JOB_DETAILS_CONTEXT,
  SCOPE_OF_WORK_CONTEXT,
  PURCHASE_ORDER_CONTEXT,
  WORK_ORDER_CONTEXT,
  CLAIM_CONTEXT,
  REPORT_CONTEXT,
  BILL_CONTEXT,
  PROPOSAL_CONTEXT,
  RFQ_CONTEXT,
];

export const CONTEXT_DEFINITIONS: Partial<Record<DocumentType, DataContextDefinition>> =
  Object.fromEntries(DEFINITIONS.map((d) => [d.documentType, d])) as Partial<
    Record<DocumentType, DataContextDefinition>
  >;

export function getContextDefinition(
  documentType: DocumentType,
): DataContextDefinition | undefined {
  return CONTEXT_DEFINITIONS[documentType];
}

export function hasContextDefinition(documentType: DocumentType): boolean {
  return documentType in CONTEXT_DEFINITIONS;
}

export function getDefaultEnabledSlugs(documentType: DocumentType): string[] {
  const def = CONTEXT_DEFINITIONS[documentType];
  if (!def) return [];
  return def.relatedEntities.filter((r) => r.defaultEnabled).map((r) => r.slug);
}
