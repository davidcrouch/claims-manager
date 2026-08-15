import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'documents' as const;

/** Filesystem-stored documents (/documents). Register alongside generated-document tools. */
export function registerFilesystemDocumentTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_fs_documents',
    description: 'List filesystem documents with filters and pagination.',
    path: '/documents',
    input: {
      ...pageLimit,
      search: z.string().optional().describe('Search text'),
      categoryId: z.string().optional().describe('Filter by category UUID'),
      uncategorised: z.boolean().optional().describe('When true, only uncategorised documents'),
      relatedRecordType: z.string().optional().describe('Related record type'),
      relatedRecordId: z.string().optional().describe('Related record UUID'),
      filesystemId: z.string().optional().describe('Filesystem UUID'),
      jobId: z.string().optional().describe('Job UUID'),
      uploadStatus: z.string().optional().describe('Upload status filter'),
      sort: z.string().optional().describe('Sort expression'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      search: args.search as string | undefined,
      categoryId: args.categoryId as string | undefined,
      uncategorised: args.uncategorised === true ? 'true' : undefined,
      relatedRecordType: args.relatedRecordType as string | undefined,
      relatedRecordId: args.relatedRecordId as string | undefined,
      filesystemId: args.filesystemId as string | undefined,
      jobId: args.jobId as string | undefined,
      uploadStatus: args.uploadStatus as string | undefined,
      sort: args.sort as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document_counts',
    description: 'Get document counts grouped by category.',
    path: '/documents/counts',
    input: {
      filesystemId: z.string().optional().describe('Filesystem UUID'),
    },
    query: (args) => ({
      filesystemId: args.filesystemId as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document',
    description: 'Get a filesystem document by ID.',
    path: '/documents/{id}',
    input: {
      id: z.string().describe('Document UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document_upload_url',
    description: 'Get a presigned upload URL for a new filesystem document.',
    method: 'POST',
    path: '/documents/upload-url',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document_upload_urls',
    description: 'Get presigned upload URLs for a batch of documents.',
    method: 'POST',
    path: '/documents/upload-urls',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'mark_fs_document_upload_complete',
    description: 'Mark a filesystem document upload as complete.',
    method: 'POST',
    path: '/documents/upload-complete',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'mark_fs_document_upload_failed',
    description: 'Mark a filesystem document upload as failed.',
    method: 'POST',
    path: '/documents/upload-failed',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'assign_fs_document_category',
    description: 'Assign a filesystem document to a category.',
    method: 'PATCH',
    path: '/documents/{id}/category',
    input: {
      id: z.string().describe('Document UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'bulk_assign_fs_document_category',
    description: 'Bulk-assign documents to a category.',
    method: 'POST',
    path: '/documents/bulk-category',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document_download_url',
    description: 'Get a presigned download URL for a filesystem document (not the binary stream).',
    path: '/documents/{id}/download-url',
    input: {
      id: z.string().describe('Document UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_fs_document_thumbnail_url',
    description: 'Get a presigned thumbnail URL for a filesystem document.',
    path: '/documents/{id}/thumbnail',
    input: {
      id: z.string().describe('Document UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'archive_fs_document',
    description: 'Archive a filesystem document.',
    method: 'POST',
    path: '/documents/{id}/archive',
    input: {
      id: z.string().describe('Document UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_fs_document',
    description: 'Permanently delete a filesystem document.',
    method: 'DELETE',
    path: '/documents/{id}',
    input: {
      id: z.string().describe('Document UUID'),
    },
  });
}
