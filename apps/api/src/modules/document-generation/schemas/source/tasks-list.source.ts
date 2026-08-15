import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const TasksListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    name: z.string(),
    status: z.string(),
    priority: z.string(),
    due_date: z.string(),
  })),
});
