import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const ScheduleListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(
    z.object({
      name: z.string(),
      location: z.string(),
      start_date: z.string(),
      end_date: z.string(),
      status: z.string(),
      job_name: z.string(),
      job_reference: z.string(),
    }),
  ),
});
