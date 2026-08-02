import { Logger } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const logger = new Logger('McpClient');

export interface McpClientConfig {
  transportType: 'http' | 'sse';
  url: string;
  headers?: Record<string, string>;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface SplitTools {
  modelVisible: McpToolDefinition[];
  appVisible: McpToolDefinition[];
}

export interface NativeMcpClient {
  listTools(): Promise<McpToolDefinition[]>;
  callTool(params: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<unknown>;
  readResource(uri: string): Promise<{
    uri: string;
    mimeType?: string;
    text?: string;
  }>;
  close(): Promise<void>;
}

export async function createNativeMCPClient(
  config: McpClientConfig,
): Promise<NativeMcpClient> {
  const client = new Client({ name: 'claims-api', version: '1.0.0' });

  const url = new URL(config.url);

  const transportHeaders = config.headers
    ? new Headers(Object.entries(config.headers))
    : undefined;

  let transport: StreamableHTTPClientTransport | SSEClientTransport;

  if (config.transportType === 'sse') {
    transport = new SSEClientTransport(url, {
      requestInit: transportHeaders ? { headers: transportHeaders } : undefined,
    });
  } else {
    transport = new StreamableHTTPClientTransport(url, {
      requestInit: transportHeaders ? { headers: transportHeaders } : undefined,
    });
  }

  await client.connect(transport);

  return {
    async listTools(): Promise<McpToolDefinition[]> {
      const allTools: McpToolDefinition[] = [];
      let cursor: string | undefined;

      do {
        const result = await client.listTools({ cursor });
        for (const tool of result.tools) {
          allTools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema as Record<string, unknown>,
            _meta: (tool as Record<string, unknown>)._meta as
              | Record<string, unknown>
              | undefined,
          });
        }
        cursor = result.nextCursor;
      } while (cursor);

      return allTools;
    },

    async callTool(params: {
      name: string;
      arguments: Record<string, unknown>;
    }): Promise<unknown> {
      const result = await client.callTool(params);
      return result;
    },

    async readResource(uri: string): Promise<{
      uri: string;
      mimeType?: string;
      text?: string;
    }> {
      if (typeof client.readResource !== 'function') {
        throw new Error(
          `MCP server does not support resources (requested: ${uri}). ` +
            'Ensure the widget has been built and the server re-started.',
        );
      }
      const result = await client.readResource({ uri });
      const content = result.contents?.[0];
      return {
        uri: content?.uri ?? uri,
        mimeType: content?.mimeType,
        text: (content as { text?: string })?.text,
      };
    },

    async close(): Promise<void> {
      try {
        await client.close();
      } catch (err) {
        logger.warn('[McpClient.close] close error', { error: String(err) });
      }
    },
  };
}

/**
 * Separate MCP tool definitions into model-visible and app-only tools.
 * App-only tools have `_meta.ui.visibility` that includes "app" but not "model".
 */
export function splitMCPAppTools(tools: McpToolDefinition[]): SplitTools {
  const modelVisible: McpToolDefinition[] = [];
  const appVisible: McpToolDefinition[] = [];

  for (const tool of tools) {
    const visibility = getVisibility(tool);

    if (visibility.includes('app')) {
      appVisible.push(tool);
    }

    if (!visibility.length || visibility.includes('model')) {
      modelVisible.push(tool);
    }
  }

  return { modelVisible, appVisible };
}

function getVisibility(tool: McpToolDefinition): string[] {
  const meta = tool._meta;
  if (!meta) return [];
  const ui = meta.ui as { visibility?: string[] } | undefined;
  return ui?.visibility ?? [];
}

export type McpToolExecutor = {
  description?: string;
  parameters?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  resourceUri?: string;
};

/**
 * Convert native tool definitions into a tool map compatible with the provider adapter.
 * Returns an object keyed by tool name with execute functions that call via the MCP client.
 */
export function toolsFromDefinitions(
  tools: McpToolDefinition[],
  client: NativeMcpClient,
): Record<string, McpToolExecutor> {
  const result: Record<string, McpToolExecutor> = {};

  for (const tool of tools) {
    const uiMeta = tool._meta?.ui as { resourceUri?: string } | undefined;

    result[tool.name] = {
      description: tool.description,
      parameters: tool.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const callResult = await client.callTool({
          name: tool.name,
          arguments: args,
        });
        return callResult;
      },
      resourceUri: uiMeta?.resourceUri,
    };
  }

  return result;
}
