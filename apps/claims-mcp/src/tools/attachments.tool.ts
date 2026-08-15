import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'documents' as const;

/** Entity attachments (/attachments). Register alongside generated-document tools. */
export function registerAttachmentTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_attachments',
    description: 'List attachments with pagination, or by related record when both type and ID are given.',
    path: '/attachments',
    input: {
      ...pageLimit,
      relatedRecordType: z.string().optional().describe('Related record type'),
      relatedRecordId: z.string().optional().describe('Related record UUID'),
      search: z.string().optional().describe('Search text'),
      sort: z.string().optional().describe('Sort expression'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      relatedRecordType: args.relatedRecordType as string | undefined,
      relatedRecordId: args.relatedRecordId as string | undefined,
      search: args.search as string | undefined,
      sort: args.sort as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_attachment',
    description: 'Get attachment metadata by ID.',
    path: '/attachments/{id}',
    input: {
      id: z.string().describe('Attachment UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_attachment',
    description: 'Create a new attachment record.',
    method: 'POST',
    path: '/attachments',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_attachment',
    description: 'Update an attachment record.',
    method: 'POST',
    path: '/attachments/{id}',
    input: {
      id: z.string().describe('Attachment UUID'),
      data: dataBody,
    },
  });
}
