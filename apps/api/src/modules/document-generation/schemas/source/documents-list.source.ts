import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const DocumentsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(
    z.object({
      file_name: z.string(),
      mime_type: z.string(),
      upload_status: z.string(),
      related_record_type: z.string(),
      created_at: z.string(),
    }),
  ),
});
