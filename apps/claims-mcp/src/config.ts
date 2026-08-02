import { z } from 'zod';

const schema = z.object({
  CLAIMS_MCP_PORT: z.coerce.number().int().positive().default(4601),
  CLAIMS_MCP_HOST: z.string().default('0.0.0.0'),
  MCP_SERVER_NAME: z.string().default('claims-mcp'),
  MCP_SERVER_VERSION: z.string().default('0.1.0'),
  CLAIMS_API_URL: z.string().url().default('http://localhost:3001'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ClaimsMcpConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ClaimsMcpConfig {
  return schema.parse(env);
}
