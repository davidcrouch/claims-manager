import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const ContactsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    full_name: z.string(),
    email: z.string(),
    mobile_phone: z.string(),
  })),
});
