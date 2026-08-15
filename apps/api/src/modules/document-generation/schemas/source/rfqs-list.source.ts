import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const RfqsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    rfq_number: z.string(),
    name: z.string(),
    date: z.string(),
  })),
});
