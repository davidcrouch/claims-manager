import { z } from 'zod';
import { ListEnvelopeSchema } from './_shared';

export const ClaimsListSourceSchema = ListEnvelopeSchema.extend({
  items: z.array(z.object({
    claim_number: z.string(),
    external_reference: z.string(),
    lodgement_date: z.string(),
    policy_number: z.string(),
  })),
});
