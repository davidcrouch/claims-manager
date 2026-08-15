import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerProposalsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_proposals',
    description: 'List proposals with pagination and filters.',
    path: '/proposals',
    query: (args) => ({
      page: (args.page as number | undefined) ?? 1,
      limit: args.limit as number | undefined,
      jobId: args.jobId as string | undefined,
      rfqId: args.rfqId as string | undefined,
      status: args.status as string | undefined,
      vendorId: args.vendorId as string | undefined,
      sort: args.sort as string | undefined,
    }),
    input: {
      ...pageLimit,
      jobId: z.string().optional().describe('Filter by job UUID'),
      rfqId: z.string().optional().describe('Filter by RFQ UUID'),
      status: z.string().optional().describe('Filter by status'),
      vendorId: z.string().optional().describe('Filter by vendor UUID'),
      sort: z.string().optional().describe('Sort expression'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_proposal',
    description: 'Get a single proposal by ID.',
    path: '/proposals/{id}',
    input: { id: z.string().describe('Proposal UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'create_proposal',
    description: 'Create a new proposal. Pass API body fields as data.',
    method: 'POST',
    path: '/proposals',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_proposal',
    description: 'Update an existing proposal. Pass API body fields as data.',
    method: 'POST',
    path: '/proposals/{id}',
    input: {
      id: z.string().describe('Proposal UUID'),
      data: dataBody,
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_proposals_by_job',
    description: 'List proposals for a job.',
    path: '/proposals/job/{jobId}',
    input: { jobId: z.string().describe('Job UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_proposals_by_rfq',
    description: 'List proposals for an RFQ.',
    path: '/proposals/rfq/{rfqId}',
    input: { rfqId: z.string().describe('RFQ UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_proposals_by_vendor',
    description: 'List proposals for a vendor.',
    path: '/proposals/vendor/{vendorId}',
    input: { vendorId: z.string().describe('Vendor UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_proposal_line_items',
    description: 'Get line items for a proposal.',
    path: '/proposals/{id}/line-items',
    input: { id: z.string().describe('Proposal UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'accept_proposal',
    description: 'Accept a proposal.',
    method: 'POST',
    path: '/proposals/{id}/accept',
    input: { id: z.string().describe('Proposal UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'decline_proposal',
    description: 'Decline a proposal. Optionally pass reason as data.',
    method: 'POST',
    path: '/proposals/{id}/decline',
    input: {
      id: z.string().describe('Proposal UUID'),
      data: dataBody.optional(),
    },
  });
}
