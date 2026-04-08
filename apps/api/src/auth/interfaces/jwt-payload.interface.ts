export interface JwtPayload {
  sub: string;
  email?: string;
  roles?: string[];
  organization_id?: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}
