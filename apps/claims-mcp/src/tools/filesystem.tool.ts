import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'filesystem' as const;

export function registerFilesystemTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_filesystems',
    description: 'Get the tenant filesystem (deprecated; prefer get_company_filesystem).',
    path: '/filesystems',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_company_filesystem',
    description: 'Get the company-level filesystem with categories.',
    path: '/filesystems/company',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_filesystem_overview',
    description: 'Get filesystem overview stats across company and jobs.',
    path: '/filesystems/overview',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'search_filesystem_categories',
    description: 'Search filesystem categories by name.',
    path: '/filesystems/categories/search',
    input: {
      q: z.string().optional().describe('Search query'),
    },
    query: (args) => ({
      q: args.q as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_filesystem_defaults',
    description: 'Get filesystem default settings.',
    path: '/filesystems/defaults',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_filesystem_defaults',
    description: 'Update filesystem default settings.',
    method: 'PATCH',
    path: '/filesystems/defaults',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_job_filesystem',
    description: 'Get (and optionally ensure) the filesystem for a job.',
    path: '/filesystems/jobs/{jobId}',
    input: {
      jobId: z.string().describe('Job UUID'),
      ensure: z.boolean().optional().describe('When false, do not auto-create filesystem'),
    },
    query: (args) => ({
      ensure: args.ensure === false ? 'false' : undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'setup_job_filesystem',
    description: 'Set up a job filesystem from a template.',
    method: 'POST',
    path: '/filesystems/jobs/{jobId}/setup',
    input: {
      jobId: z.string().describe('Job UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'setup_filesystem',
    description: 'Set up a filesystem from a template.',
    method: 'POST',
    path: '/filesystems/setup',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'setup_default_filesystem',
    description: 'Set up a filesystem from the tenant default template.',
    method: 'POST',
    path: '/filesystems/setup-default',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_filesystem',
    description: 'Update filesystem metadata (e.g. name).',
    method: 'PUT',
    path: '/filesystems/{id}',
    input: {
      id: z.string().describe('Filesystem UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_filesystem_categories',
    description: 'Replace all categories on a filesystem.',
    method: 'PUT',
    path: '/filesystems/{id}/categories',
    input: {
      id: z.string().describe('Filesystem UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'add_filesystem_category',
    description: 'Add a category to a filesystem.',
    method: 'POST',
    path: '/filesystems/{id}/categories',
    input: {
      id: z.string().describe('Filesystem UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_filesystem_category',
    description: 'Update a filesystem category.',
    method: 'PATCH',
    path: '/filesystems/{id}/categories/{categoryId}',
    input: {
      id: z.string().describe('Filesystem UUID'),
      categoryId: z.string().describe('Category UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'archive_filesystem_category',
    description: 'Archive a filesystem category.',
    method: 'DELETE',
    path: '/filesystems/{id}/categories/{categoryId}',
    input: {
      id: z.string().describe('Filesystem UUID'),
      categoryId: z.string().describe('Category UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_artifact_export',
    description: 'Get artifact export settings.',
    path: '/filesystems/artifact-export',
    input: {
      scope: z.enum(['company', 'job']).optional().describe('Export scope'),
    },
    query: (args) => ({
      scope: args.scope as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_artifact_export',
    description: 'Update artifact export settings.',
    method: 'PATCH',
    path: '/filesystems/artifact-export',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_filesystem_templates',
    description: 'List filesystem templates.',
    path: '/filesystem-templates',
    input: {
      kind: z.string().optional().describe('Template kind filter'),
    },
    query: (args) => ({
      kind: args.kind as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_filesystem_template',
    description: 'Get a filesystem template by ID.',
    path: '/filesystem-templates/{id}',
    input: {
      id: z.string().describe('Template UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_filesystem_template',
    description: 'Create a filesystem template.',
    method: 'POST',
    path: '/filesystem-templates',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_filesystem_template',
    description: 'Update a filesystem template.',
    method: 'PUT',
    path: '/filesystem-templates/{id}',
    input: {
      id: z.string().describe('Template UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_filesystem_template',
    description: 'Archive a filesystem template.',
    method: 'DELETE',
    path: '/filesystem-templates/{id}',
    input: {
      id: z.string().describe('Template UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'clone_filesystem_template',
    description: 'Clone a filesystem template for the current tenant.',
    method: 'POST',
    path: '/filesystem-templates/{id}/clone',
    input: {
      id: z.string().describe('Template UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_template_categories',
    description: 'Replace all categories on a filesystem template.',
    method: 'PUT',
    path: '/filesystem-templates/{id}/categories',
    input: {
      id: z.string().describe('Template UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_template_pipelines',
    description: 'List pipelines defined on a filesystem template.',
    path: '/filesystem-templates/{id}/pipelines',
    input: {
      id: z.string().describe('Template UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_template_pipeline',
    description: 'Create a pipeline on a filesystem template.',
    method: 'POST',
    path: '/filesystem-templates/{id}/pipelines',
    input: {
      id: z.string().describe('Template UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_template_pipeline',
    description: 'Get a pipeline on a filesystem template.',
    path: '/filesystem-templates/{id}/pipelines/{pipelineId}',
    input: {
      id: z.string().describe('Template UUID'),
      pipelineId: z.string().describe('Pipeline UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_template_pipeline',
    description: 'Update a pipeline on a filesystem template.',
    method: 'PUT',
    path: '/filesystem-templates/{id}/pipelines/{pipelineId}',
    input: {
      id: z.string().describe('Template UUID'),
      pipelineId: z.string().describe('Pipeline UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_template_pipeline',
    description: 'Delete a pipeline from a filesystem template.',
    method: 'DELETE',
    path: '/filesystem-templates/{id}/pipelines/{pipelineId}',
    input: {
      id: z.string().describe('Template UUID'),
      pipelineId: z.string().describe('Pipeline UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_template_pipeline_steps',
    description: 'Replace steps on a template pipeline.',
    method: 'PUT',
    path: '/filesystem-templates/{id}/pipelines/{pipelineId}/steps',
    input: {
      id: z.string().describe('Template UUID'),
      pipelineId: z.string().describe('Pipeline UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_pipelines',
    description: 'List pipelines for a filesystem instance.',
    path: '/pipelines/filesystem/{filesystemId}',
    input: {
      filesystemId: z.string().describe('Filesystem UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_pipeline',
    description: 'Get a pipeline with its steps.',
    path: '/pipelines/{id}',
    input: {
      id: z.string().describe('Pipeline UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_pipeline',
    description: 'Create a pipeline on a filesystem.',
    method: 'POST',
    path: '/pipelines',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_pipeline',
    description: 'Update a pipeline.',
    method: 'PUT',
    path: '/pipelines/{id}',
    input: {
      id: z.string().describe('Pipeline UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'delete_pipeline',
    description: 'Delete a pipeline.',
    method: 'DELETE',
    path: '/pipelines/{id}',
    input: {
      id: z.string().describe('Pipeline UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'replace_pipeline_steps',
    description: 'Replace all steps on a pipeline.',
    method: 'PUT',
    path: '/pipelines/{id}/steps',
    input: {
      id: z.string().describe('Pipeline UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_document_pipeline_runs',
    description: 'List pipeline runs for a filesystem document.',
    path: '/pipelines/document/{documentId}/runs',
    input: {
      documentId: z.string().describe('Filesystem document UUID'),
    },
  });
}
