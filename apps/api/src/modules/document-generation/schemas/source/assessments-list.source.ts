import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const AssessmentsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(
    z.object({
      name: z.string(),
      status: z.string(),
      job_name: z.string(),
      job_reference: z.string(),
      created_at: z.string(),
    }),
  ),
});
