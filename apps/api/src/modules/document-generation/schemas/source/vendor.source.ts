import { z } from 'zod';

export const VendorSourceSchema = z.object({
  company_name: z.string(),
  vendor_name: z.string(),
  external_reference: z.string(),
  phone: z.string(),
  after_hours_phone: z.string(),
  postcode: z.string(),
  state: z.string(),
  city: z.string(),
  country: z.string(),
  is_active: z.string(),
  report_date: z.string(),
});
