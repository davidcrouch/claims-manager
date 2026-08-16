import { registerAs } from '@nestjs/config';

function parseAudiences(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default registerAs('auth', () => ({
  issuerUrl: process.env.AUTH_ISSUER_URL,
  jwksUri: process.env.AUTH_JWKS_URI,
  audiences: parseAudiences(process.env.AUTH_AUDIENCE),
  authServerUrl:
    process.env.AUTH_SERVER_URL ?? process.env.AUTH_ISSUER_URL ?? '',
}));
