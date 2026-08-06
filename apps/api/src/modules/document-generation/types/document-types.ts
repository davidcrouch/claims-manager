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
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

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
  scope_of_work: 'Job',
  claim: 'Claim',
  contact: 'Contact',
  task: 'Task',
  appointment: 'Appointment',
  message: 'Message',
  journal: 'Journal',
  vendor: 'Vendor',
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
};

export const ENTITY_TYPE_TO_DOCUMENT_TYPE: Record<string, DocumentType> = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_TO_ENTITY_TYPE).map(([k, v]) => [v, k as DocumentType]),
) as Record<string, DocumentType>;

export type GenerationTrigger = 'manual' | 'workflow';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TemplateData {
  [key: string]: unknown;
}
