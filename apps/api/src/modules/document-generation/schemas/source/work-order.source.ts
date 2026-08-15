import { z } from 'zod';
import { GroupSchema } from './_shared';

export const WorkOrderSourceSchema = z.object({
  company_name: z.string(),
  wo_number: z.string(),
  wo_name: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  note: z.string(),
  scope_of_work: z.string(),
  wo_to_name: z.string(),
  wo_to_email: z.string(),
  wo_to_address: z.string(),
  wo_for_name: z.string(),
  wo_from_name: z.string(),
  wo_from_address: z.string(),
  total_amount: z.string(),
  adjusted_total: z.string(),
  groups: z.array(GroupSchema),
});
