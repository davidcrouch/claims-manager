import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GraphClient } from '../graph/graph-client.js';
import { requireAccessToken } from '../auth/token-extract.js';
import type { MsGraphConfig } from '../config.js';

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  webUrl?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  lastModifiedBy?: { user?: { displayName?: string } };
  parentReference?: { path?: string };
}

function formatDriveItem(item: DriveItem) {
  return {
    id: item.id,
    name: item.name,
    type: item.file ? 'file' : item.folder ? 'folder' : 'unknown',
    mimeType: item.file?.mimeType,
    size: item.size,
    createdDateTime: item.createdDateTime,
    lastModifiedDateTime: item.lastModifiedDateTime,
    webUrl: item.webUrl,
    lastModifiedBy: item.lastModifiedBy?.user?.displayName,
    path: item.parentReference?.path,
  };
}

function formatToolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[files.tool] ${message}`);
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function registerFileTools(server: McpServer, config: MsGraphConfig): void {
  server.tool(
    'list_files',
    'List files and folders in a OneDrive directory.',
    {
      folderId: z.string().optional().describe('Folder item ID (default: root of OneDrive)'),
      top: z.number().int().min(1).max(50).optional().describe('Number of items to return (default: 25, max: 50)'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });
        const top = params.top ?? 25;

        const endpoint = params.folderId
          ? `/me/drive/items/${encodeURIComponent(params.folderId)}/children`
          : '/me/drive/root/children';

        const data = await client.get<{ value: DriveItem[] }>(endpoint, {
          $top: String(top),
          $select: 'id,name,size,createdDateTime,lastModifiedDateTime,webUrl,file,folder,lastModifiedBy,parentReference',
        });

        const items = (data.value ?? []).map(formatDriveItem);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: items.length, items }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'get_file_content',
    'Get metadata for a specific file. Returns text content for text files; metadata only for binary files.',
    {
      fileId: z.string().describe('The ID of the file'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const item = await client.get<DriveItem>(
          `/me/drive/items/${encodeURIComponent(params.fileId)}`,
          { $select: 'id,name,size,file,folder,createdDateTime,lastModifiedDateTime,webUrl,lastModifiedBy,parentReference' },
        );

        const result: Record<string, unknown> = formatDriveItem(item);

        const mimeType = item.file?.mimeType;
        const isText = mimeType && (
          mimeType.startsWith('text/') ||
          mimeType.includes('json') ||
          mimeType.includes('xml') ||
          mimeType.includes('javascript') ||
          mimeType.includes('csv')
        );

        if (!isText) {
          result.note = 'Binary file — content not returned. Use webUrl to access.';
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );

  server.tool(
    'search_files',
    'Search for files in your OneDrive by name or content keyword.',
    {
      query: z.string().describe('Search query (file name or keyword)'),
      top: z.number().int().min(1).max(25).optional().describe('Number of results (default: 10, max: 25)'),
    },
    async (params) => {
      try {
        const client = new GraphClient({ accessToken: requireAccessToken(), baseUrl: config.GRAPH_API_BASE_URL });

        const data = await client.get<{ value: DriveItem[] }>(
          `/me/drive/root/search(q='${params.query.replace(/'/g, "''")}')`,
          { $top: String(params.top ?? 10) },
        );

        const files = (data.value ?? []).map(formatDriveItem);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ count: files.length, files }, null, 2) }],
        };
      } catch (err) {
        return formatToolError(err);
      }
    },
  );
}
