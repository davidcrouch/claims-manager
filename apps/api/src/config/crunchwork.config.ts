import { registerAs } from '@nestjs/config';

export default registerAs('crunchwork', () => ({
  vendorTenantId: process.env.CRUNCHWORK_VENDOR_TENANT_ID,
  insureTenantId: process.env.CRUNCHWORK_INSURE_TENANT_ID,
}));
