import { z } from 'zod';
import { GroupSchema } from './_shared';

export const RfqSourceSchema = z.object({
  company_name: z.string(),
  rfq_number: z.string(),
  rfq_name: z.string(),
  note: z.string(),
  sent_date: z.string(),
  due_date: z.string(),
  received_date: z.string(),
  include_pricing: z.string(),
  include_quantities: z.string(),
  rfq_to_name: z.string(),
  rfq_to_email: z.string(),
  rfq_from_name: z.string(),
  groups: z.array(GroupSchema),
});
