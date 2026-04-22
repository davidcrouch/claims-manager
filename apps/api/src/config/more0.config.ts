import { registerAs } from '@nestjs/config';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export default registerAs('more0', () => ({
  registryUrl: process.env.MORE0_REGISTRY_URL || 'http://localhost:3201',
  gatewayUrl: process.env.MORE0_GATEWAY_URL || 'http://localhost:3205',
  organizationId:
    process.env.MORE0_ORGANIZATION_ID || 'claims-manager-webhook',
  appKey: process.env.MORE0_APP_KEY || 'claims-manager-webhook',
  apiKey: process.env.MORE0_API_KEY || '',
  toolSecret: process.env.MORE0_TOOL_SECRET || '',
  enabled: parseBool(process.env.MORE0_ENABLED, false),
}));
