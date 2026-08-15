import { z } from 'zod';

export const JournalSourceSchema = z.object({
  company_name: z.string(),
  journal_name: z.string(),
  description: z.string(),
  status: z.string(),
  address_suburb: z.string(),
  address_state: z.string(),
  address_postcode: z.string(),
  created_at: z.string(),
  report_date: z.string(),
});
