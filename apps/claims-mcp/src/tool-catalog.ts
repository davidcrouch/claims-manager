import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export interface CatalogTool {
  name: string;
  description: string;
  inputSchema: unknown;
  outputSchema?: unknown;
}

type RegisteredTool = {
  description?: string;
};

export function catalogFromServer(server: McpServer): CatalogTool[] {
  const registered = (
    server as unknown as { _registeredTools: Record<string, RegisteredTool> }
  )._registeredTools;

  return Object.entries(registered)
    .map(([name, tool]) => ({
      name,
      description: tool.description ?? '',
      inputSchema: {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
