import { z } from 'zod';

export const JobSourceSchema = z.object({
  company_name: z.string(),
  job_name: z.string(),
  job_reference: z.string(),
  job_status: z.string(),
  job_type: z.string(),
  request_date: z.string(),
  excess: z.string(),
  make_safe_required: z.string(),
  job_instructions: z.string(),
  job_address: z.string(),
  address_suburb: z.string(),
  address_state: z.string(),
  address_postcode: z.string(),
  address_country: z.string(),
  claim_number: z.string(),
  claim_reference: z.string(),
  date_of_loss: z.string(),
  incident_description: z.string(),
  scope_of_work: z.string(),
  report_date: z.string(),
});
