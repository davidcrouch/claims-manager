import type { PageContext } from './use-page-context';
import type { Agent } from './types';

export const HELP_AGENT_SLUG = 'help-assistant';

/**
 * Maps entityType (from PageContext) to the preferred agent slug
 * that should be auto-selected when chat opens on that page.
 */
const PAGE_AGENT_MAP: Record<string, string> = {
  catalog: 'catalog-assistant',
  assessment: 'assessment-assistant',
  quote: 'estimator',
  report: 'report-builder',
  role: HELP_AGENT_SLUG,
  user: HELP_AGENT_SLUG,
  dashboard: HELP_AGENT_SLUG,
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

export function resolveHelpAgent(agents: Agent[]): Agent | undefined {
  return (
    agents.find((a) => a.slug === HELP_AGENT_SLUG) ??
    agents.find((a) => a.name.trim().toLowerCase() === 'help assistant')
  );
}

/** User message auto-sent when the header Help (?) control opens chat. */
export function buildPageHelpMessage(ctx: PageContext): string {
  const page = ctx.pageLabel?.trim() || ctx.pathname || 'this page';
  const route = ctx.pathname?.trim() || '';
  const routeHint = route
    ? ` Call get_guides_for_route with route="${route}" (pathname, not the page label), then open_help_guide.`
    : '';
  return (
    `Help me with this page: ${page}.` +
    routeHint +
    ` Use the help-with-current-page skill: open the matching guide in the canvas and briefly explain the key steps.`
  );
}
