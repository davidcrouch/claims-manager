import { z } from 'zod';

export const MessageSourceSchema = z.object({
  company_name: z.string(),
  subject: z.string(),
  body: z.string(),
  acknowledgement_required: z.string(),
  acknowledged_at: z.string(),
  created_at: z.string(),
  report_date: z.string(),
});
