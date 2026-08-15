import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'documents' as const;

export function registerDocumentsTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'generate_document',
    categoryDesc(CAT, 'Start async PDF/DOCX generation for an entity and document type.'),
    {
      documentType: z.string().describe('Document type slug'),
      entityId: z.string().optional().describe('Entity UUID (required for most detail reports)'),
      templateId: z.string().optional().describe('Optional template assignment UUID'),
      filesystemDocumentId: z
        .string()
        .optional()
        .describe('Optional filesystem .docx to use instead of assigned template'),
      destinationCategoryId: z
        .string()
        .optional()
        .describe('Optional filesystem folder to save the generated file into'),
    },
    async ({
      documentType,
      entityId,
      templateId,
      filesystemDocumentId,
      destinationCategoryId,
    }) => {
      try {
        return toolResult(
          await api.request('/generated-documents/generate', {
            method: 'POST',
            body: {
              documentType,
              entityId,
              templateId,
              filesystemDocumentId,
              destinationCategoryId,
            },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'list_generated_documents',
    categoryDesc(CAT, 'List generated documents for the current tenant.'),
    {
      documentType: z.string().optional().describe('Filter by document type'),
      page: z.number().int().positive().optional().describe('Page number'),
      limit: z.number().int().positive().optional().describe('Page size'),
    },
    async ({ documentType, page, limit }) => {
      try {
        return toolResult(
          await api.request('/generated-documents', {
            query: { documentType, page, limit },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_generated_document',
    categoryDesc(CAT, 'Get a generated document record by ID (status, metadata).'),
    {
      id: z.string().describe('Generated document UUID'),
    },
    async ({ id }) => {
      try {
        return toolResult(await api.request(`/generated-documents/${id}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_generated_document_download',
    categoryDesc(
      CAT,
      'Get a presigned download URL (or metadata) for a generated document — not the binary body.',
    ),
    {
      id: z.string().describe('Generated document UUID'),
      format: z.enum(['pdf', 'docx']).optional().describe('Preferred format'),
    },
    async ({ id, format }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/${id}/download`, {
            query: { format },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'regenerate_document',
    categoryDesc(CAT, 'Regenerate a document with the same or a new template.'),
    {
      id: z.string().describe('Generated document UUID'),
      templateId: z.string().optional().describe('Optional new template assignment UUID'),
    },
    async ({ id, templateId }) => {
      try {
        return toolResult(
          await api.request(`/generated-documents/${id}/regenerate`, {
            method: 'POST',
            body: templateId ? { templateId } : {},
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
