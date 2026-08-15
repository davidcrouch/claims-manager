import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const MessagesListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    subject: z.string(),
    created_at: z.string(),
    acknowledgement_required: z.string(),
  })),
});
