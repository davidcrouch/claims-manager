import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, dataBody } from './_proxy.js';

const CAT = 'ai' as const;

export function registerAgentsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_agents',
    description: 'List chat agents visible to the current user.',
    path: '/agents',
    input: {
      chatEnabled: z.enum(['true', 'false']).optional().describe('Filter by chat-enabled flag'),
    },
    query: (args) => ({ chatEnabled: args.chatEnabled as string | undefined }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_agent',
    description: 'Get an agent by ID.',
    path: '/agents/{id}',
    input: { id: z.string().describe('Agent UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_agent',
    description: 'Create a chat agent. Pass API body fields as data.',
    method: 'POST',
    path: '/agents',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_agent',
    description: 'Update a chat agent. Pass API body fields as data.',
    method: 'PUT',
    path: '/agents/{id}',
    input: {
      id: z.string().describe('Agent UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_agent',
    description: 'Delete a chat agent.',
    method: 'DELETE',
    path: '/agents/{id}',
    input: { id: z.string().describe('Agent UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_skills',
    description: 'List skills visible to the current tenant.',
    path: '/skills',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_skill',
    description: 'Get a skill by ID.',
    path: '/skills/{id}',
    input: { id: z.string().describe('Skill UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_skill',
    description: 'Create a skill. Pass API body fields as data.',
    method: 'POST',
    path: '/skills',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_skill',
    description: 'Update a skill. Pass API body fields as data.',
    method: 'PUT',
    path: '/skills/{id}',
    input: {
      id: z.string().describe('Skill UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_skill',
    description: 'Delete a skill.',
    method: 'DELETE',
    path: '/skills/{id}',
    input: { id: z.string().describe('Skill UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'test_skill_match',
    description: 'Test skill matching for a sample message. Pass message and options in data.',
    method: 'POST',
    path: '/skills/test-match',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'test_skill_invoke',
    description: 'Test invoke a skill with a sample message. Pass message in data.',
    method: 'POST',
    path: '/skills/{id}/test-invoke',
    input: {
      id: z.string().describe('Skill UUID'),
      data: dataBody,
    },
  });
}
