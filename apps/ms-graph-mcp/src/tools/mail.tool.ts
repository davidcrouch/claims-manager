import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphClient } from '../graph/graph-client.js';
import { requireAccessToken } from '../auth/token-extract.js';
import type { MsGraphConfig } from '../config.js';

const MAX_BODY_LENGTH = 4000;

interface MailMessage {
  id: string;
  subject: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  receivedDateTime?: string;
  bodyPreview?: string;
  isRead?: boolean;
  importance?: string;
  hasAttachments?: boolean;
  body?: { contentType?: string; content?: string };
}

function formatMessageSummary(msg: MailMessage) {
  return {
    id: msg.id,
    subject: msg.subject,
    from: msg.from?.emailAddress?.address
      ? `${msg.from.emailAddress.name ?? ''} <${msg.from.emailAddress.address}>`
      : undefined,
    to: (msg.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean),
    receivedDateTime: msg.receivedDateTime,
    bodyPreview: msg.bodyPreview,
    isRead: msg.isRead,
    importance: msg.importance,
    hasAttachments: msg.hasAttachments,
  };
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateBody(body: { contentType?: string; content?: string } | undefined): string | undefined {
  if (!body?.content) return undefined;
  const text = body.contentType === 'html' ? stripHtml(body.content) : body.content;
  if (text.length <= MAX_BODY_LENGTH) return text;
  return text.slice(0, MAX_BODY_LENGTH) + '\n\n[... truncated — full email is longer]';
}

function formatToolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[mail.tool] ${message}`);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerMailTools(server: McpServer, config: MsGraphConfig): void {
  server.tool(
    'list_emails',
    'List recent emails from your inbox or a specified folder. Returns subject, sender, date, and preview.',
    {
      folder: z.string().optional().describe('Mail folder to list from (default: Inbox). Examples: Inbox, SentItems, Drafts, Archive'),
      top: z.number().int().min(1).max(50).optional().describe('Number of emails to return (default: 10, max: 50)'),
      filter: z.enum(['all', 'unread', 'flagged']).optional().describe('Filter emails: all (default), unread only, or flagged only'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });
        const folder = params.folder ?? 'Inbox';
        const top = params.top ?? 10;

        const queryParams: Record<string, string> = {
          $top: String(top),
          $orderby: 'receivedDateTime desc',
          $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance,hasAttachments',
        };

        if (params.filter === 'unread') {
          queryParams.$filter = 'isRead eq false';
        } else if (params.filter === 'flagged') {
          queryParams.$filter = "flag/flagStatus eq 'flagged'";
        }

        const data = await client.get<{ value: MailMessage[] }>(
          `/me/mailFolders/${encodeURIComponent(folder)}/messages`,
          queryParams,
        );

        const messages = (data.value ?? []).map(formatMessageSummary);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: messages.length, messages }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'read_email',
    'Read the full content of a specific email by its ID. Returns the email body as plain text.',
    {
      messageId: z.string().describe('The ID of the email message to read'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const msg = await client.get<MailMessage>(
          `/me/messages/${encodeURIComponent(params.messageId)}`,
          { $select: 'id,subject,from,toRecipients,receivedDateTime,body,importance,hasAttachments' },
        );

        const result = {
          id: msg.id,
          subject: msg.subject,
          from: msg.from?.emailAddress?.address
            ? `${msg.from.emailAddress.name ?? ''} <${msg.from.emailAddress.address}>`
            : undefined,
          to: (msg.toRecipients ?? []).map((r) => r.emailAddress?.address).filter(Boolean),
          receivedDateTime: msg.receivedDateTime,
          importance: msg.importance,
          body: truncateBody(msg.body),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'search_emails',
    'Search emails using a keyword query (KQL syntax supported). Searches across subject, body, and sender.',
    {
      query: z.string().describe("Search query (KQL syntax). Examples: 'from:john@example.com', 'subject:invoice', 'budget report'"),
      top: z.number().int().min(1).max(25).optional().describe('Number of results to return (default: 10, max: 25)'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const data = await client.get<{ value: MailMessage[] }>('/me/messages', {
          $search: `"${params.query}"`,
          $top: String(params.top ?? 10),
          $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,importance,hasAttachments',
        });

        const messages = (data.value ?? []).map(formatMessageSummary);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: messages.length, messages }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
