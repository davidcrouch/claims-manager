import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const WorkOrdersListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    wo_number: z.string(),
    name: z.string(),
    start_date: z.string(),
    total_amount: z.string(),
  })),
});
