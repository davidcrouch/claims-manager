import { z } from 'zod';

const schema = z.object({
  MS_GRAPH_MCP_PORT: z.coerce.number().int().positive().default(4602),
  MCP_HOST: z.string().default('0.0.0.0'),
  MCP_SERVER_NAME: z.string().default('ms-graph-mcp'),
  MCP_SERVER_VERSION: z.string().default('0.1.0'),
  CLAIMS_API_URL: z.string().url().optional(),
  GRAPH_API_BASE_URL: z.string().url().default('https://graph.microsoft.com/v1.0'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type MsGraphConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): MsGraphConfig {
  return schema.parse(env);
}
