import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerReportsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_reports',
    description: 'List reports with filters and pagination.',
    path: '/reports',
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      claimId: z.string().optional().describe('Filter by claim UUID'),
      status: z.string().optional().describe('Filter by status'),
      reportTypeId: z.string().optional().describe('Filter by report type UUID'),
      sort: z.string().optional().describe('Sort expression'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      claimId: args.claimId as string | undefined,
      status: args.status as string | undefined,
      reportTypeId: args.reportTypeId as string | undefined,
      sort: args.sort as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_report',
    description: 'Get a single report by ID.',
    path: '/reports/{id}',
    input: {
      id: z.string().describe('Report UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_report',
    description: 'Create a new report.',
    method: 'POST',
    path: '/reports',
    input: {
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_report',
    description: 'Update an existing report.',
    method: 'POST',
    path: '/reports/{id}',
    input: {
      id: z.string().describe('Report UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_reports_by_job',
    description: 'List reports for a job.',
    path: '/reports/job/{jobId}',
    input: {
      jobId: z.string().describe('Job UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_reports_by_claim',
    description: 'List reports for a claim.',
    path: '/reports/claim/{claimId}',
    input: {
      claimId: z.string().describe('Claim UUID'),
    },
  });
}
