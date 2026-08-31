import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { toolResult } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { categoryDesc } from '../categories.js';
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
    description:
      'Create a new journal. Pass data: { name, description?, address?, latitude?, longitude?, metadata? }. metadata.visitDate is the inspection date (YYYY-MM-DD). Then call link_journal to attach it to a Job.',
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
    description: 'Link a journal to an entity. Pass data: { entityType: "Job"|"Quote"|"Invoice", entityId }.',
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

  proxyTool(server, api, {
    category: CAT,
    name: 'create_journal_site_entry',
    description:
      'Create one site-inspection journal entry from real notes. One thing looked at per call. Optional scopeOfWork is how to repair that item — plain text, no headings. Omit images unless the user asked to generate a photo. Do not invent damage or write report headings.',
    method: 'POST',
    path: '/journals/{journalId}/site-entries',
    input: {
      journalId: z.string().describe('Journal UUID'),
      name: z.string().optional().describe('Short place or item for the timeline, e.g. Entry door — not a report heading'),
      entryKind: z
        .enum(['intro', 'pre_existing', 'observation', 'scope_of_work', 'damage', 'recommendation', 'other'])
        .optional()
        .describe('Walk role: intro, pre_existing, observation (event item), recommendation. damage/scope_of_work alias observation.'),
      observation: z
        .string()
        .optional()
        .describe('Spoken inspector notes for this item only. No headings or labels.'),
      scopeOfWork: z
        .string()
        .optional()
        .describe('Optional spoken aside about likely repair for this item. Plain sentences, no "Scope of work:" heading. Omit on intro/wrap-up.'),
      additionalNotes: z
        .array(z.string())
        .optional()
        .describe('Extra note blocks after the observation'),
      images: z
        .array(
          z.object({
            prompt: z.string().describe('What the generated inspection photo should show'),
            caption: z.string().optional().describe('Caption stored on the attachment'),
          }),
        )
        .max(1)
        .optional()
        .describe(
          'Optional generated inspection photo. Omit for real inspections — review chat photos instead. Extra generated photos use generate_journal_page_image.',
        ),
      locationLabel: z.string().optional().describe('Room or area label'),
      latitude: z.number().optional(),
      longitude: z.number().optional(),
      capturedAt: z.string().optional().describe('ISO timestamp for when the inspector recorded this'),
      documentIds: z
        .array(z.string())
        .max(20)
        .optional()
        .describe('Document UUIDs from the project filesystem to attach to this entry. Use after uploading photos via the upload panel.'),
    },
    body: (args) => ({
      name: args.name,
      entryKind: args.entryKind,
      observation: args.observation,
      scopeOfWork: args.scopeOfWork,
      additionalNotes: args.additionalNotes,
      images: args.images,
      locationLabel: args.locationLabel,
      latitude: args.latitude,
      longitude: args.longitude,
      capturedAt: args.capturedAt,
      documentIds: args.documentIds,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'generate_journal_page_image',
    description:
      'Generate a photorealistic inspection photo and attach it to an existing journal page.',
    method: 'POST',
    path: '/journals/{journalId}/pages/{pageId}/generate-image',
    input: {
      journalId: z.string().describe('Journal UUID'),
      pageId: z.string().describe('Journal page UUID'),
      prompt: z.string().describe('What the generated inspection photo should show'),
      caption: z.string().optional().describe('Caption stored on the attachment'),
      fileName: z.string().optional().describe('Optional file name including extension'),
    },
    body: (args) => ({
      prompt: args.prompt,
      caption: args.caption,
      fileName: args.fileName,
    }),
  });

  server.tool(
    'open_journal_file_upload',
    categoryDesc(
      CAT,
      'Open the journal file-upload panel in canvas. When categoryId is provided, photos are saved to the project document folder (not the journal directly). The agent later references them via documentIds on create_journal_site_entry. Call resolve_project_folder first to get the categoryId.',
    ),
    {
      journalId: z
        .string()
        .optional()
        .describe('Journal UUID. Required unless the user is already on that journal page.'),
      jobId: z.string().optional().describe('Job UUID for upload context'),
      categoryId: z
        .string()
        .optional()
        .describe('Project filesystem category UUID. When set, files upload to that folder instead of creating a journal page.'),
      name: z
        .string()
        .optional()
        .describe('Entry title stored on the journal page, e.g. Inspection photos'),
      entryKind: z
        .enum(['intro', 'pre_existing', 'observation', 'recommendation', 'other'])
        .optional()
        .describe('Walk role for the created entry. Default observation.'),
      prompt: z
        .string()
        .optional()
        .describe('Short instruction shown on the panel, e.g. Upload photos of the damaged areas'),
    },
    async (args) => {
      return toolResult({
        action: 'open_drawer',
        drawer: 'JournalFileUploadDrawer',
        journalId: args.journalId,
        jobId: args.jobId,
        categoryId: args.categoryId,
        name: args.name,
        entryKind: args.entryKind,
        prompt: args.prompt,
      });
    },
  );

  server.tool(
    'show_inspection_image',
    categoryDesc(
      CAT,
      'Display a document image in the canvas so you can ask the user about it. Use after uploading photos to the project folder and listing them with list_job_documents.',
    ),
    {
      documentId: z.string().describe('Document UUID from the project filesystem'),
      journalId: z.string().optional().describe('Journal UUID for context'),
      caption: z.string().optional().describe('Caption to display below the image'),
      prompt: z.string().optional().describe('Question or instruction shown above the image'),
    },
    async (args) => {
      return toolResult({
        action: 'open_drawer',
        drawer: 'JournalImageViewerDrawer',
        documentId: args.documentId,
        journalId: args.journalId,
        caption: args.caption,
        prompt: args.prompt,
      });
    },
  );
}
