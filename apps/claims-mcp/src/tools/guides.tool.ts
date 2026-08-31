import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool } from './_proxy.js';
import { toolResult, toolError } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'organisation' as const;

export function registerGuidesTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_help_guides',
    description: 'List all available help guides for the current tenant.',
    path: '/guides',
  });

  server.tool(
    'search_help_guides',
    categoryDesc(CAT, 'Search help guides by natural language query. Returns matching guides with slug, title, excerpt, and similarity. After calling this, always call open_help_guide with the top result slug so the full guide opens in the canvas.'),
    {
      query: z.string().describe('Natural language search query, e.g. "how do I create a custom role"'),
      route: z.string().optional().describe('Current page route for context boosting, e.g. "/admin/roles"'),
      topK: z.number().optional().describe('Max results to return (default 5)'),
    },
    async (args) => {
      try {
        const params: Record<string, string | number | undefined> = { q: args.query };
        if (args.route) params.route = args.route;
        if (args.topK) params.topK = args.topK;
        return toolResult(
          await api.request('/guides/search', { query: params }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'open_help_guide',
    categoryDesc(CAT, 'Open a help guide by slug and return its full content for display in a canvas artifact. Use this when a user wants to read the complete guide.'),
    {
      slug: z.string().describe('Guide slug, e.g. "roles-and-permissions"'),
    },
    async (args) => {
      try {
        return toolResult(
          await api.request(`/guides/${encodeURIComponent(args.slug)}/content`),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  proxyTool(server, api, {
    category: CAT,
    name: 'get_guides_for_route',
    description: 'Get help guides relevant to a specific page route. Pass the URL pathname only (e.g. "/admin/roles"), not the page title.',
    path: '/guides/by-route',
    input: {
      route: z
        .string()
        .describe('URL pathname starting with /, e.g. "/admin/roles". Do not pass page labels.'),
    },
    query: (args) => ({ route: args.route as string }),
  });
}
