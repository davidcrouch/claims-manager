export const DOCUMENT_TYPES = [
  'quote',
  'invoice',
  'purchase_order',
  'work_order',
  'proposal',
  'report',
  'bill',
  'rfq',
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
};

export const ENTITY_TYPE_TO_DOCUMENT_TYPE: Record<string, DocumentType> = Object.fromEntries(
  Object.entries(DOCUMENT_TYPE_TO_ENTITY_TYPE).map(([k, v]) => [v, k as DocumentType]),
) as Record<string, DocumentType>;

export type GenerationTrigger = 'manual' | 'workflow';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TemplateData {
  [key: string]: unknown;
}
