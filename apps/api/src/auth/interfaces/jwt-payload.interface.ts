export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  /** App-specific or Kinde custom claim */
  tenantId?: string;
  /** Kinde organization code (e.g. org_xxx) - used as tenantId fallback */
  org_code?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
