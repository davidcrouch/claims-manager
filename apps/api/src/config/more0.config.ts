import { registerAs } from '@nestjs/config';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('more0', () => ({
  registryUrl: process.env.MORE0_REGISTRY_URL || 'http://localhost:3200',
  appKey: process.env.MORE0_APP_KEY || 'claims-manager',
  apiKey: process.env.MORE0_API_KEY || '',
  toolSecret: process.env.MORE0_TOOL_SECRET || '',
  enabled: parseBool(process.env.MORE0_ENABLED, false),
}));
