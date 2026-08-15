import { z } from 'zod';

export const ReportSourceSchema = z.object({
  company_name: z.string(),
  report_title: z.string(),
  report_reference: z.string(),
  report_date: z.string(),
  report_data: z.record(z.string(), z.unknown()),
  report_meta: z.record(z.string(), z.unknown()),
}).catchall(z.unknown());
