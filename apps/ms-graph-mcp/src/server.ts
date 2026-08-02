import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { MsGraphConfig } from './config.js';
import { registerMailTools } from './tools/mail.tool.js';
import { registerCalendarTools } from './tools/calendar.tool.js';
import { registerContactsTools } from './tools/contacts.tool.js';
import { registerFileTools } from './tools/files.tool.js';

export function createServer(config: MsGraphConfig): McpServer {
  const server = new McpServer({
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  });

  registerMailTools(server, config);
  registerCalendarTools(server, config);
  registerContactsTools(server, config);
  registerFileTools(server, config);

  return server;
}
