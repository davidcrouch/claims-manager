import { z } from 'zod';

export const BillSourceSchema = z.object({
  company_name: z.string(),
  bill_number: z.string(),
  invoice_number: z.string(),
  po_number: z.string(),
  issue_date: z.string(),
  received_date: z.string(),
  due_date: z.string(),
  payment_date: z.string(),
  comments: z.string(),
  sub_total: z.string(),
  total_tax: z.string(),
  total_amount: z.string(),
});
