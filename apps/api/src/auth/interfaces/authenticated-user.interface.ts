export interface AuthenticatedUser {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  features: string[];
  tenantId: string;
}
