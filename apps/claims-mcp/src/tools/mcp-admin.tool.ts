import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, dataBody } from './_proxy.js';

const CAT = 'ai' as const;

export function registerMcpAdminTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_mcp_integrations',
    description: 'List MCP integrations visible to the caller.',
    path: '/mcp-integrations',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_mcp_integration',
    description: 'Create an MCP integration. Pass API body fields as data.',
    method: 'POST',
    path: '/mcp-integrations',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'discover_mcp_server',
    description: 'Discover MCP server auth requirements. Pass server URL and options in data.',
    method: 'POST',
    path: '/mcp-integrations/discover',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'test_mcp_connection_stateless',
    description: 'Test connection to an MCP URL (stateless probe). Pass URL and credentials in data.',
    method: 'POST',
    path: '/mcp-integrations/test-connection',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_mcp_integration',
    description: 'Get MCP integration details by ID.',
    path: '/mcp-integrations/{id}',
    input: { id: z.string().describe('Integration UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_mcp_integration',
    description: 'Update an MCP integration. Pass API body fields as data.',
    method: 'PATCH',
    path: '/mcp-integrations/{id}',
    input: {
      id: z.string().describe('Integration UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_mcp_integration',
    description: 'Delete an MCP integration.',
    method: 'DELETE',
    path: '/mcp-integrations/{id}',
    input: { id: z.string().describe('Integration UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_mcp_connections',
    description: 'List MCP connections for the tenant.',
    path: '/mcp-connections',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'initiate_mcp_oauth',
    description: 'Generate OAuth authorize URL and store PKCE state. Pass API body fields as data.',
    method: 'POST',
    path: '/mcp-connections/initiate-oauth',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_mcp_connection',
    description: 'Create an MCP connection. Pass API body fields as data.',
    method: 'POST',
    path: '/mcp-connections',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'test_mcp_connection',
    description: 'Test an existing MCP connection and refresh manifest.',
    method: 'POST',
    path: '/mcp-connections/{id}/test',
    input: { id: z.string().describe('Connection UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'disconnect_mcp_connection',
    description: 'Disconnect (soft-delete) an MCP connection.',
    method: 'POST',
    path: '/mcp-connections/{id}/disconnect',
    input: { id: z.string().describe('Connection UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_mcp_tools',
    description: 'List tools from cached manifests for active MCP connections.',
    path: '/mcp-tools',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'refresh_mcp_tools',
    description: 'Force re-discovery for a specific MCP connection. Pass connectionId in data.',
    method: 'POST',
    path: '/mcp-tools/refresh',
    input: { data: dataBody },
  });
}
