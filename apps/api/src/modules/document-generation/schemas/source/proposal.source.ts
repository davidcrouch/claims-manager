import { z } from 'zod';
import { GroupSchema } from './_shared';

export const ProposalSourceSchema = z.object({
  company_name: z.string(),
  proposal_number: z.string(),
  proposal_name: z.string(),
  proposal_reference: z.string(),
  proposal_date: z.string(),
  received_date: z.string(),
  note: z.string(),
  proposal_to_name: z.string(),
  proposal_to_email: z.string(),
  proposal_from_name: z.string(),
  proposal_for_name: z.string(),
  sub_total: z.string(),
  total_tax: z.string(),
  total_amount: z.string(),
  groups: z.array(GroupSchema),
});
