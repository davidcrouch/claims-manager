import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const QuotesListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    quote_number: z.string(),
    name: z.string(),
    date: z.string(),
    total_amount: z.string(),
  })),
});
