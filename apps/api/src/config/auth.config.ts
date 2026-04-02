import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  issuerUrl: process.env.AUTH_ISSUER_URL,
  jwksUri: process.env.AUTH_JWKS_URI,
}));
