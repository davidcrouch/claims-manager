import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerJournalsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_journals',
    description: 'List journals with pagination and optional filters.',
    path: '/journals',
    input: {
      ...pageLimit,
      status: z.string().optional().describe('Filter by status'),
      jobId: z.string().optional().describe('Filter by job UUID'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      status: args.status as string | undefined,
      jobId: args.jobId as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_journal',
    description: 'Get a single journal by ID.',
    path: '/journals/{id}',
    input: {
      id: z.string().describe('Journal UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_journal',
    description: 'Create a new journal.',
    method: 'POST',
    path: '/journals',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_journal',
    description: 'Update an existing journal.',
    method: 'PATCH',
    path: '/journals/{id}',
    input: {
      id: z.string().describe('Journal UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_journal',
    description: 'Soft-delete a journal.',
    method: 'DELETE',
    path: '/journals/{id}',
    input: {
      id: z.string().describe('Journal UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_journals_by_entity',
    description: 'List journals linked to an entity.',
    path: '/journals/entity/{entityType}/{entityId}',
    input: {
      entityType: z.string().describe('Entity type (e.g. job, claim)'),
      entityId: z.string().describe('Entity UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'link_journal',
    description: 'Link a journal to an entity.',
    method: 'POST',
    path: '/journals/{journalId}/link',
    input: {
      journalId: z.string().describe('Journal UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'unlink_journal',
    description: 'Unlink a journal from an entity.',
    method: 'DELETE',
    path: '/journals/{journalId}/link/{entityType}/{entityId}',
    input: {
      journalId: z.string().describe('Journal UUID'),
      entityType: z.string().describe('Entity type'),
      entityId: z.string().describe('Entity UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_journal_pages',
    description: 'List pages in a journal.',
    path: '/journals/{journalId}/pages',
    input: {
      journalId: z.string().describe('Journal UUID'),
      limit: z.number().int().positive().optional().describe('Page size'),
      offset: z.number().int().min(0).optional().describe('Offset'),
    },
    query: (args) => ({
      limit: args.limit as number | undefined,
      offset: args.offset as number | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_journal_page',
    description: 'Get a single journal page.',
    path: '/journals/{journalId}/pages/{pageId}',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_journal_page',
    description: 'Create a new page in a journal.',
    method: 'POST',
    path: '/journals/{journalId}/pages',
    input: {
      journalId: z.string().describe('Journal UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_journal_page',
    description: 'Update a journal page.',
    method: 'PATCH',
    path: '/journals/{journalId}/pages/{pageId}',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_journal_page',
    description: 'Delete a journal page.',
    method: 'DELETE',
    path: '/journals/{journalId}/pages/{pageId}',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'reorder_journal_pages',
    description: 'Reorder pages within a journal.',
    method: 'POST',
    path: '/journals/{journalId}/pages/reorder',
    input: {
      journalId: z.string().describe('Journal UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_journal_page_attachment',
    description: 'Create attachment metadata for a journal page (after upload).',
    method: 'POST',
    path: '/journals/{journalId}/pages/{pageId}/attachments',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_journal_page_attachment',
    description: 'Delete a journal page attachment.',
    method: 'DELETE',
    path: '/journals/{journalId}/pages/{pageId}/attachments/{attachmentId}',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
      attachmentId: z.string().describe('Attachment UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_journal_page_upload_url',
    description: 'Get a presigned upload URL for a journal page file.',
    method: 'POST',
    path: '/journals/{journalId}/pages/{pageId}/upload-url',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_journal_page_attachment_download',
    description: 'Get a presigned download URL for a journal page attachment (not the binary stream).',
    path: '/journals/{journalId}/pages/{pageId}/attachments/{attachmentId}/download',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Page UUID'),
      attachmentId: z.string().describe('Attachment UUID'),
    },
  });
}
