import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const InvoicesListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    invoice_number: z.string(),
    name: z.string(),
    date: z.string(),
    total_amount: z.string(),
  })),
});
