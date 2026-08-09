export const LOOKUP_DOMAINS = {
  CLAIM_STATUS: 'claim_status',
  JOB_STATUS: 'job_status',
  QUOTE_STATUS: 'quote_status',
  PROPOSAL_STATUS: 'proposal_status',
  PURCHASE_ORDER_STATUS: 'purchase_order_status',
  WORK_ORDER_STATUS: 'work_order_status',
  INVOICE_STATUS: 'invoice_status',
  BILL_STATUS: 'bill_status',
  RFQ_STATUS: 'rfq_status',
} as const;

export type LookupDomain = (typeof LOOKUP_DOMAINS)[keyof typeof LOOKUP_DOMAINS];
