import { z } from 'zod';
import { GroupSchema } from './_shared';

export const QuoteSourceSchema = z.object({
  company_name: z.string(),
  quote_number: z.string(),
  quote_name: z.string(),
  quote_date: z.string(),
  quote_reference: z.string(),
  quote_note: z.string(),
  expires_in_days: z.string(),
  estimated_start_date: z.string(),
  estimated_completion_date: z.string(),
  quote_to_name: z.string(),
  quote_to_email: z.string(),
  quote_to_address: z.string(),
  quote_for_name: z.string(),
  quote_from_name: z.string(),
  quote_from_address: z.string(),
  sub_total: z.string(),
  total_tax: z.string(),
  total_amount: z.string(),
  groups: z.array(GroupSchema),
});
