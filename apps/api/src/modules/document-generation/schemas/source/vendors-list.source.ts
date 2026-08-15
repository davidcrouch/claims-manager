import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const VendorsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    name: z.string(),
    external_reference: z.string(),
    phone: z.string(),
    state: z.string(),
    is_active: z.string(),
  })),
});
