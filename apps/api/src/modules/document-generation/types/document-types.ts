/** Fallback template used when a scenario has no dedicated assignment. Not a printable type. */
export const DEFAULT_DOCUMENT_TYPE = 'default' as const;

export const DOCUMENT_TYPES = [
  // Singular (detail) types
  'quote',
  'invoice',
  'purchase_order',
  'work_order',
  'proposal',
  'report',
  'bill',
  'rfq',
  'job_details',
  'scope_of_work',
  'claim',
  'contact',
  'task',
  'appointment',
  'message',
  'journal',
  'vendor',
  'assessment',
  'document',
  // Plural (list) types
  'jobs_list',
  'quotes_list',
  'invoices_list',
  'bills_list',
  'work_orders_list',
  'purchase_orders_list',
  'proposals_list',
  'rfqs_list',
  'reports_list',
  'claims_list',
  'contacts_list',
  'tasks_list',
  'appointments_list',
  'messages_list',
  'journals_list',
  'vendors_list',
  'assessments_list',
  'documents_list',
  'schedule_list',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const ASSIGNABLE_TEMPLATE_TYPES = [
  DEFAULT_DOCUMENT_TYPE,
  ...DOCUMENT_TYPES,
] as const;

export type AssignableTemplateType = (typeof ASSIGNABLE_TEMPLATE_TYPES)[number];

export function isAssignableTemplateType(
  value: string,
): value is AssignableTemplateType {
  return (ASSIGNABLE_TEMPLATE_TYPES as readonly string[]).includes(value);
}

export const DOCUMENT_TYPE_TO_ENTITY_TYPE: Record<DocumentType, string> = {
  quote: 'Quote',
  invoice: 'Invoice',
  purchase_order: 'PurchaseOrder',
  work_order: 'WorkOrder',
  proposal: 'Proposal',
  report: 'Report',
  bill: 'Bill',
  rfq: 'RFQ',
  job_details: 'Job',
  scope_of_work: 'Quote',
  claim: 'Claim',
  contact: 'Contact',
  task: 'Task',
  appointment: 'Appointment',
  message: 'Message',
  journal: 'Journal',
  vendor: 'Vendor',
  assessment: 'Assessment',
  document: 'Document',
  jobs_list: 'Organization',
  quotes_list: 'Organization',
  invoices_list: 'Organization',
  bills_list: 'Organization',
  work_orders_list: 'Organization',
  purchase_orders_list: 'Organization',
  proposals_list: 'Organization',
  rfqs_list: 'Organization',
  reports_list: 'Organization',
  claims_list: 'Organization',
  contacts_list: 'Organization',
  tasks_list: 'Organization',
  appointments_list: 'Organization',
  messages_list: 'Organization',
  journals_list: 'Organization',
  vendors_list: 'Organization',
  assessments_list: 'Organization',
  documents_list: 'Organization',
  schedule_list: 'Organization',
};

/** First document type wins when several types share an entity (Job, Quote). */
export const ENTITY_TYPE_TO_DOCUMENT_TYPE: Record<string, DocumentType> = {};
for (const [documentType, entityType] of Object.entries(DOCUMENT_TYPE_TO_ENTITY_TYPE)) {
  if (!(entityType in ENTITY_TYPE_TO_DOCUMENT_TYPE)) {
    ENTITY_TYPE_TO_DOCUMENT_TYPE[entityType] = documentType as DocumentType;
  }
}

export type GenerationTrigger = 'manual' | 'workflow';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TemplateData {
  [key: string]: unknown;
}
