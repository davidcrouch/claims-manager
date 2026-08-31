import { registerAs } from '@nestjs/config';

export default registerAs('apiInternal', () => ({
  baseUrl: (process.env.API_INTERNAL_URL ?? '').trim(),
  prefix: (process.env.API_INTERNAL_PREFIX ?? '/api/v1').trim(),
  token: (process.env.INTERNAL_API_TOKEN ?? '').trim(),
}));
