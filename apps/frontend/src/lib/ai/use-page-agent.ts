import type { PageContext } from './use-page-context';
import type { Agent } from './types';

/**
 * Maps entityType (from PageContext) to the preferred agent slug
 * that should be auto-selected when chat opens on that page.
 */
const PAGE_AGENT_MAP: Record<string, string> = {
  catalog: 'catalog-assistant',
  assessment: 'assessment-assistant',
  quote: 'estimator',
  report: 'report-builder',
};

export function resolvePageAgentSlug(ctx: PageContext): string | undefined {
  if (!ctx.entityType) return undefined;
  return PAGE_AGENT_MAP[ctx.entityType];
}

export function resolvePageAgent(
  ctx: PageContext,
  agents: Agent[],
): Agent | undefined {
  const slug = resolvePageAgentSlug(ctx);
  if (!slug) return undefined;
  return agents.find((a) => a.slug === slug);
}
