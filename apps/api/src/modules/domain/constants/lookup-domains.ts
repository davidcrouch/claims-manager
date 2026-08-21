export const LOOKUP_DOMAINS = {
  CLAIM_STATUS: 'claim_status',
  JOB_STATUS: 'job_status',
  JOB_TYPE: 'job_type',
  QUOTE_STATUS: 'quote_status',
  PROPOSAL_STATUS: 'proposal_status',
  PURCHASE_ORDER_STATUS: 'purchase_order_status',
  PURCHASE_ORDER_TYPE: 'purchase_order_type',
  WORK_ORDER_STATUS: 'work_order_status',
  WORK_ORDER_TYPE: 'work_order_type',
  INVOICE_STATUS: 'invoice_status',
  BILL_STATUS: 'bill_status',
  RFQ_STATUS: 'rfq_status',
  GROUP_LABEL: 'group_label',
  UNIT_TYPE: 'unit_type',
} as const;

export type LookupDomain = (typeof LOOKUP_DOMAINS)[keyof typeof LOOKUP_DOMAINS];
