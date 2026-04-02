export interface CrunchworkConfig {
  authUrl: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  hmacKey: string;
  insureTenantId?: string;
  vendorTenantId?: string;
}
