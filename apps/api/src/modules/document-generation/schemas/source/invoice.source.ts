import { z } from 'zod';

export const InvoiceSourceSchema = z.object({
  company_name: z.string(),
  invoice_number: z.string(),
  issue_date: z.string(),
  received_date: z.string(),
  comments: z.string(),
  sub_total: z.string(),
  total_tax: z.string(),
  total_amount: z.string(),
  excess_amount: z.string(),
  po_number: z.string(),
  po_name: z.string(),
});
