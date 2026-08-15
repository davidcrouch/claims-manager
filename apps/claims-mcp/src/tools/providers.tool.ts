import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';

const CAT = 'ai' as const;

export function registerProvidersTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_providers',
    description: 'List integration providers.',
    path: '/providers',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_provider',
    description: 'Get a provider by code.',
    path: '/providers/{code}',
    input: { code: z.string().describe('Provider code') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_provider_connections',
    description: 'List connections for a provider.',
    path: '/providers/{code}/connections',
    input: { code: z.string().describe('Provider code') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_provider_connection',
    description: 'Create a connection for a provider. Pass API body fields as data.',
    method: 'POST',
    path: '/providers/{code}/connections',
    input: {
      code: z.string().describe('Provider code'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_provider_connection',
    description: 'Update a provider connection. Pass API body fields as data.',
    method: 'PUT',
    path: '/providers/{code}/connections/{connId}',
    input: {
      code: z.string().describe('Provider code'),
      connId: z.string().describe('Connection UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_provider_webhook_events',
    description: 'List webhook events for a provider.',
    path: '/providers/{code}/webhook-events',
    input: {
      code: z.string().describe('Provider code'),
      ...pageLimit,
      status: z.string().optional().describe('Filter by status'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      status: args.status as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_connections',
    description: 'List all tenant integration connections.',
    path: '/connections',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_connection',
    description: 'Get a connection by ID.',
    path: '/connections/{id}',
    input: { id: z.string().describe('Connection UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_connection',
    description: 'Update a connection by ID. Pass API body fields as data.',
    method: 'PUT',
    path: '/connections/{id}',
    input: {
      id: z.string().describe('Connection UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_connection_webhook_events',
    description: 'List webhook events for a connection.',
    path: '/connections/{id}/webhook-events',
    input: {
      id: z.string().describe('Connection UUID'),
      ...pageLimit,
      status: z.string().optional().describe('Filter by status'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      status: args.status as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_connection_docs_url',
    description: 'Get documentation URL for a connection.',
    path: '/connections/{id}/docs-url',
    input: { id: z.string().describe('Connection UUID') },
  });
}
