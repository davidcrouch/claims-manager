import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsApiClient } from '../server.js';
import { proxyTool, dataBody } from './_proxy.js';

const CAT = 'organisation' as const;

export function registerOrganisationsTools(server: McpServer, api: ClaimsApiClient): void {
  proxyTool(server, api, {
    category: CAT,
    name: 'get_organisation_me',
    description: 'Get the current organisation profile.',
    path: '/organisations/me',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'update_organisation_me',
    description: 'Update the current organisation profile. Pass API body fields as data.',
    method: 'PATCH',
    path: '/organisations/me',
    input: { data: dataBody },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_organisation_ghosts',
    description: 'List ghost organisations available to claim.',
    path: '/organisations/ghosts',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'claim_organisation_ghost',
    description: 'Initiate a claim for a ghost organisation.',
    method: 'POST',
    path: '/organisations/ghosts/{id}/claim',
    input: { id: z.string().describe('Ghost organisation UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'list_organisation_claims',
    description: 'List pending organisation claim requests.',
    path: '/organisation-claims',
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'approve_organisation_claim',
    description: 'Approve an organisation claim request.',
    method: 'POST',
    path: '/organisation-claims/{id}/approve',
    input: { id: z.string().describe('Claim UUID') },
  });

  proxyTool(server, api, {
    category: CAT,
    name: 'reject_organisation_claim',
    description: 'Reject an organisation claim request. Optional notes in data.',
    method: 'POST',
    path: '/organisation-claims/{id}/reject',
    input: {
      id: z.string().describe('Claim UUID'),
      data: dataBody,
    },
  });
}
