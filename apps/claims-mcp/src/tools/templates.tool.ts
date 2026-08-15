import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolError, toolResult } from '../server.js';
import { categoryDesc } from '../categories.js';

const CAT = 'documents' as const;

export function registerTemplatesTools(server: McpServer, api: ClaimsApiClient): void {
  server.tool(
    'list_template_settings',
    categoryDesc(CAT, 'List template settings for all document-generation scenarios.'),
    {},
    async () => {
      try {
        return toolResult(await api.request('/document-templates'));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_templates_folder',
    categoryDesc(CAT, 'Get the company filesystem folder used for document templates.'),
    {},
    async () => {
      try {
        return toolResult(await api.request('/document-templates/folder'));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'set_templates_folder',
    categoryDesc(
      CAT,
      'Set or clear the company filesystem folder used for document templates.',
    ),
    {
      filesystemCategoryId: z
        .string()
        .nullable()
        .optional()
        .describe('Filesystem category UUID, or null/omit to clear'),
    },
    async ({ filesystemCategoryId }) => {
      try {
        return toolResult(
          await api.request('/document-templates/folder', {
            method: 'PUT',
            body: { filesystemCategoryId: filesystemCategoryId ?? null },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_template_content',
    categoryDesc(CAT, 'Get the assigned template content as base64 DOCX for a document type.'),
    {
      documentType: z.string().describe('Document type / scenario slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(await api.request(`/document-templates/${documentType}/content`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'save_template_content',
    categoryDesc(
      CAT,
      'Save template content from HTML (server converts to DOCX) for a document type.',
    ),
    {
      documentType: z.string().describe('Document type / scenario slug'),
      html: z.string().describe('HTML body to convert and save as DOCX'),
    },
    async ({ documentType, html }) => {
      try {
        return toolResult(
          await api.request(`/document-templates/${documentType}/content`, {
            method: 'PUT',
            body: { html },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'get_template_tags',
    categoryDesc(CAT, 'Extract merge tags from the assigned template for a document type.'),
    {
      documentType: z.string().describe('Document type / scenario slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(await api.request(`/document-templates/${documentType}/tags`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'assign_template',
    categoryDesc(
      CAT,
      'Assign a filesystem .docx as the template for a scenario (omit id to clear).',
    ),
    {
      documentType: z.string().describe('Document type / scenario slug'),
      filesystemDocumentId: z
        .string()
        .optional()
        .describe('Filesystem document UUID; omit or empty to clear assignment'),
    },
    async ({ documentType, filesystemDocumentId }) => {
      try {
        return toolResult(
          await api.request(`/document-templates/${documentType}`, {
            method: 'PUT',
            body: { filesystemDocumentId: filesystemDocumentId || undefined },
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    'clear_template',
    categoryDesc(CAT, 'Clear the template assignment for a document-generation scenario.'),
    {
      documentType: z.string().describe('Document type / scenario slug'),
    },
    async ({ documentType }) => {
      try {
        return toolResult(
          await api.request(`/document-templates/${documentType}`, {
            method: 'DELETE',
          }),
        );
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
