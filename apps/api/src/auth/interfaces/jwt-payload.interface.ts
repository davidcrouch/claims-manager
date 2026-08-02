export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  features?: string[];
  org_roles?: string[];
  organization_id?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
