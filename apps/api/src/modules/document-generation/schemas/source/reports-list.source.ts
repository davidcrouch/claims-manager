import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const ReportsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    title: z.string(),
    reference: z.string(),
    created_at: z.string(),
  })),
});
