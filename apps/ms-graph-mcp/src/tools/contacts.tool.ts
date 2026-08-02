import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphClient } from '../graph/graph-client.js';
import { requireAccessToken } from '../auth/token-extract.js';
import type { MsGraphConfig } from '../config.js';

interface Contact {
  id: string;
  displayName?: string;
  givenName?: string;
  surname?: string;
  emailAddresses?: Array<{ address?: string; name?: string }>;
  businessPhones?: string[];
  mobilePhone?: string;
  companyName?: string;
  jobTitle?: string;
}

function formatContact(contact: Contact) {
  return {
    id: contact.id,
    displayName: contact.displayName,
    givenName: contact.givenName,
    surname: contact.surname,
    emails: contact.emailAddresses?.map((e) => e.address).filter(Boolean),
    businessPhones: contact.businessPhones,
    mobilePhone: contact.mobilePhone,
    companyName: contact.companyName,
    jobTitle: contact.jobTitle,
  };
}

function formatToolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[contacts.tool] ${message}`);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerContactsTools(server: McpServer, config: MsGraphConfig): void {
  server.tool(
    'list_contacts',
    'List personal contacts from your address book.',
    {
      top: z.number().int().min(1).max(50).optional().describe('Number of contacts to return (default: 25, max: 50)'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });
        const top = params.top ?? 25;

        const data = await client.get<{ value: Contact[] }>('/me/contacts', {
          $top: String(top),
          $orderby: 'displayName',
          $select: 'id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle',
        });

        const contacts = (data.value ?? []).map(formatContact);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: contacts.length, contacts }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'get_contact',
    'Get full details of a specific contact by ID.',
    {
      contactId: z.string().describe('The ID of the contact'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const contact = await client.get<Contact>(
          `/me/contacts/${encodeURIComponent(params.contactId)}`,
          { $select: 'id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle' },
        );

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(formatContact(contact), null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
