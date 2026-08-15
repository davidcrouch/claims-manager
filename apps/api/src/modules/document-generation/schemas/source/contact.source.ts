import { z } from 'zod';

export const ContactSourceSchema = z.object({
  company_name: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  full_name: z.string(),
  email: z.string(),
  mobile_phone: z.string(),
  home_phone: z.string(),
  work_phone: z.string(),
  notes: z.string(),
  report_date: z.string(),
});
