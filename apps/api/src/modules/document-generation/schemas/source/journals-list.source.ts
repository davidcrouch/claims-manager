import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const JournalsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    name: z.string(),
    status: z.string(),
    suburb: z.string(),
    state: z.string(),
    created_at: z.string(),
  })),
});
