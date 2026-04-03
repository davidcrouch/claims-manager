export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  /** App-specific custom claim */
  tenantId?: string;
  /** Kinde organization code (e.g. org_xxx) - legacy fallback */
  org_code?: string;
  /** MoreZero auth-server organization identifier */
  organization_id?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
