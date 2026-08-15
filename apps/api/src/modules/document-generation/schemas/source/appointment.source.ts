import { z } from 'zod';

export const AppointmentSourceSchema = z.object({
  company_name: z.string(),
  appointment_name: z.string(),
  location: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  status: z.string(),
  report_date: z.string(),
});
