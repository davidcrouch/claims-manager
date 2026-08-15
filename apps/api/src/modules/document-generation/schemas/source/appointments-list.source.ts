import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const AppointmentsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    name: z.string(),
    location: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    status: z.string(),
  })),
});
