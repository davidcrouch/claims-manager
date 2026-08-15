/**
 * First-party claims-mcp integrations that packs may declare by name.
 * Pack install will create these if missing (trusted + org-shared connection).
 */
export const KNOWN_CLAIMS_MCP_INTEGRATIONS = [
  {
    name: 'Claims Tools',
    description: 'First-party claims-manager domain tools (trusted, all categories)',
    path: '/mcp',
  },
  {
    name: 'Claims Operations',
    description:
      'Main-menu domains: claims, jobs, commercial docs, finance, tasks, schedule, contacts, journals, reports',
    path: '/operations/mcp',
  },
  {
    name: 'Claims Documents',
    description: 'Documents runtime plus templates, transforms, and attachments',
    path: '/documents/mcp',
  },
  {
    name: 'Claims Filesystem',
    description: 'Filesystems, templates, pipelines, and catalogue',
    path: '/filesystem/mcp',
  },
  {
    name: 'Claims AI',
    description: 'Messages/chat plus agents, skills, AI settings, MCP admin, and providers',
    path: '/ai/mcp',
  },
  {
    name: 'Claims Organisation',
    description: 'Users, organisations, roles, and notifications',
    path: '/organisation/mcp',
  },
] as const;

export type KnownClaimsMcpIntegrationName =
  (typeof KNOWN_CLAIMS_MCP_INTEGRATIONS)[number]['name'];

export function resolveClaimsMcpBaseUrl(raw?: string): string {
  const value = (raw ?? process.env.CLAIMS_MCP_URL ?? '').trim() || 'http://localhost:4601';
  return value.replace(/\/+$/, '').replace(/\/mcp$/i, '');
}

export function knownClaimsMcpIntegrationByName(name: string) {
  return KNOWN_CLAIMS_MCP_INTEGRATIONS.find((entry) => entry.name === name);
}

export function claimsMcpIntegrationUrl(name: string, baseUrl?: string): string | null {
  const known = knownClaimsMcpIntegrationByName(name);
  if (!known) return null;
  return `${resolveClaimsMcpBaseUrl(baseUrl)}${known.path}`;
}
