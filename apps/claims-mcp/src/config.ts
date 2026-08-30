import { z } from 'zod';

const emptyToUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const commaList = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .default('mcp:tools')
    .transform((value) =>
      value
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
    ),
);

const schema = z.object({
  CLAIMS_MCP_PORT: z.coerce.number().int().positive().default(4601),
  CLAIMS_MCP_HOST: z.string().default('0.0.0.0'),
  /** Canonical public origin of this MCP server (no path). Derived from the request when unset. */
  CLAIMS_MCP_PUBLIC_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  MCP_SERVER_NAME: z.string().default('claims-mcp'),
  MCP_SERVER_VERSION: z.string().default('0.1.0'),
  CLAIMS_API_URL: z.string().url().default('http://127.0.0.1:5001'),
  /**
   * OAuth 2.1 / OIDC issuer advertised in RFC 9728 `authorization_servers`.
   * Accepts the same names as the rest of the stack:
   * AUTH_ISSUER_URL (api) | OIDC_ISSUER (frontend / auth-server) | AUTH_SERVER_URL (base URL).
   */
  AUTH_ISSUER_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().default('http://localhost:3285'),
  ),
  MCP_OAUTH_SCOPES: commaList,
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type ClaimsMcpConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ClaimsMcpConfig {
  return schema.parse({
    ...env,
    AUTH_ISSUER_URL:
      env.AUTH_ISSUER_URL || env.OIDC_ISSUER || env.AUTH_SERVER_URL,
  });
}
