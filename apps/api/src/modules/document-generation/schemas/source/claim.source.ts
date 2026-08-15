import { z } from 'zod';

export const ClaimSourceSchema = z.object({
  company_name: z.string(),
  claim_number: z.string(),
  external_reference: z.string(),
  status: z.string(),
  lodgement_date: z.string(),
  date_of_loss: z.string(),
  incident_description: z.string(),
  address: z.string(),
  policy_number: z.string(),
  policy_name: z.string(),
  abn: z.string(),
  vulnerable_customer: z.string(),
  total_loss: z.string(),
  contentious_claim: z.string(),
  report_date: z.string(),
});
