/**
 * Path-mounted MCP categories. URL: `/{slug}/mcp`.
 * Aggregate `/mcp` registers every category that has a tool registrar (see server.ts).
 *
 * Partitioned by product area (ops + admin tools live together):
 * - operations   — main menu work (except Documents / Filesystem / AI chat)
 * - documents    — Documents product (runtime + templates/transforms)
 * - filesystem   — Filesystem product (runtime + catalogue / templates)
 * - ai           — AI chat ops + agents/skills/MCP/providers admin
 * - organisation — Users, organisations, roles, notifications, tenant settings
 */
export const MCP_CATEGORIES = [
  'operations',
  'documents',
  'filesystem',
  'ai',
  'organisation',
] as const;

export type CategoryId = (typeof MCP_CATEGORIES)[number];

/** Display names for seed integrations / healthz. */
export const CATEGORY_LABELS: Record<CategoryId, string> = {
  operations: 'Operations',
  documents: 'Documents',
  filesystem: 'Filesystem',
  ai: 'AI',
  organisation: 'Organisation',
};

/**
 * Domain tool modules → mount category.
 * Used for docs and to keep registrar wiring consistent.
 */
export const DOMAIN_CATEGORY: Record<string, CategoryId> = {
  // Main menu → operations
  claims: 'operations',
  jobs: 'operations',
  tasks: 'operations',
  contacts: 'operations',
  assessments: 'operations',
  lookups: 'operations',
  appointments: 'operations',
  quotes: 'operations',
  rfqs: 'operations',
  proposals: 'operations',
  'purchase-orders': 'operations',
  'work-orders': 'operations',
  bills: 'operations',
  invoices: 'operations',
  finance: 'operations',
  vendors: 'operations',
  journals: 'operations',
  reports: 'operations',
  dashboard: 'operations',

  // Documents (ops + admin)
  transform: 'documents',
  templates: 'documents',
  documents: 'documents',

  // Filesystem (ops + admin)
  filesystem: 'filesystem',
  catalog: 'filesystem',

  // AI (ops chat + admin)
  messages: 'ai',
  agents: 'ai',
  ai: 'ai',
  'mcp-admin': 'ai',
  providers: 'ai',

  // Organisation
  organisations: 'organisation',
  users: 'organisation',
  notifications: 'organisation',
  guides: 'organisation',
};

/** Categories seeded as separate trusted integrations. */
export const SEEDED_CATEGORY_INTEGRATIONS: readonly CategoryId[] = [
  'operations',
  'documents',
  'filesystem',
  'ai',
  'organisation',
] as const;

export function isCategoryId(value: string): value is CategoryId {
  return (MCP_CATEGORIES as readonly string[]).includes(value);
}

export function parseCategoryList(raw: string | undefined): CategoryId[] | undefined {
  if (!raw?.trim()) return undefined;
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const invalid = parts.filter((p) => !isCategoryId(p));
  if (invalid.length) {
    throw new Error(
      `[claims-mcp.categories.parseCategoryList] unknown categories: ${invalid.join(', ')}`,
    );
  }
  return parts as CategoryId[];
}

/** Prefix tool descriptions for aggregate `/mcp` so platform can parse categories. */
export function categoryDesc(category: CategoryId, description: string): string {
  return `[Category: ${category}] ${description}`;
}

/**
 * Resolve claims-mcp base URL (without trailing /mcp) from CLAIMS_MCP_URL.
 * Accepts either `http://host:4601` or `http://host:4601/mcp`.
 */
export function resolveClaimsMcpBaseUrl(raw?: string): string {
  const value = (raw ?? '').trim() || 'http://localhost:4601';
  return value.replace(/\/+$/, '').replace(/\/mcp$/i, '');
}

export function claimsMcpAggregateUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/mcp`;
}

export function claimsMcpCategoryUrl(baseUrl: string, category: CategoryId): string {
  return `${baseUrl.replace(/\/+$/, '')}/${category}/mcp`;
}
