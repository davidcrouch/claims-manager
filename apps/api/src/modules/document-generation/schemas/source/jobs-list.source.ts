import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const JobsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    name: z.string(),
    reference: z.string(),
    request_date: z.string(),
    suburb: z.string(),
    state: z.string(),
  })),
});
