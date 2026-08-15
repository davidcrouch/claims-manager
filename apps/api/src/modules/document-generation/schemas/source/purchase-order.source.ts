import { z } from 'zod';
import { GroupSchema } from './_shared';

export const PurchaseOrderSourceSchema = z.object({
  company_name: z.string(),
  po_number: z.string(),
  po_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  po_to_name: z.string(),
  po_to_email: z.string(),
  po_to_address: z.string(),
  po_for_name: z.string(),
  po_from_name: z.string(),
  po_from_address: z.string(),
  total_amount: z.string(),
  adjusted_total: z.string(),
  groups: z.array(GroupSchema),
});
