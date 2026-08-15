import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, pageLimit, dataBody } from './_proxy.js';
import { z } from 'zod';

const CAT = 'operations' as const;

export function registerVendorsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'list_vendors',
    description: 'List vendors with pagination and optional search.',
    path: '/vendors',
    input: {
      ...pageLimit,
      search: z.string().optional().describe('Search text'),
    },
    query: (args) => ({
      page: args.page as number | undefined,
      limit: args.limit as number | undefined,
      search: args.search as string | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_vendor',
    description: 'Get a single vendor by ID.',
    path: '/vendors/{id}',
    input: {
      id: z.string().describe('Vendor UUID'),
    },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_vendors_on_platform',
    description: 'List vendors that are linked to on-platform organisations.',
    path: '/vendors/on-platform',
    input: {
      limit: z.number().int().positive().optional().describe('Max results'),
    },
    query: (args) => ({
      limit: args.limit as number | undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'get_vendor_allocation',
    description: 'Get vendor allocation recommendation for a job context.',
    path: '/vendors/allocation',
    input: {
      jobType: z.string().describe('Job type'),
      account: z.string().describe('Account identifier'),
      postcode: z.string().describe('Postcode'),
      lossType: z.string().optional().describe('Loss type'),
      totalLoss: z.boolean().optional().describe('Whether this is a total loss'),
    },
    query: (args) => ({
      jobType: args.jobType as string,
      account: args.account as string,
      postcode: args.postcode as string,
      lossType: args.lossType as string | undefined,
      totalLoss: args.totalLoss === true ? 'true' : undefined,
    }),
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'link_vendor_organisation',
    description: 'Link a vendor to an on-platform organisation.',
    method: 'PATCH',
    path: '/vendors/{id}/link-organisation',
    input: {
      id: z.string().describe('Vendor UUID'),
      data: dataBody,
    },
  });
}
