import { z } from 'zod';

export const DocumentSourceSchema = z.object({
  company_name: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  file_size: z.string(),
  upload_status: z.string(),
  related_record_type: z.string(),
  related_record_id: z.string(),
  source_system: z.string(),
  pipeline_status: z.string(),
  created_at: z.string(),
  report_date: z.string(),
});
