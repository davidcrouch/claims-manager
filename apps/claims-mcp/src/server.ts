import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ClaimsMcpConfig } from './config.js';
import { type CategoryId, isCategoryId } from './categories.js';
import { registerClaimsTools } from './tools/claims.tool.js';
import { registerJobsTools } from './tools/jobs.tool.js';
import { registerTasksTools } from './tools/tasks.tool.js';
import { registerContactsTools } from './tools/contacts.tool.js';
import { registerLookupsTools } from './tools/lookups.tool.js';
import { registerAssessmentsTools } from './tools/assessments.tool.js';
import { registerAppointmentsTools } from './tools/appointments.tool.js';
import { registerTransformTools } from './tools/transform.tool.js';
import { registerTemplatesTools } from './tools/templates.tool.js';
import { registerDocumentsTools } from './tools/documents.tool.js';
import { registerFilesystemDocumentTools } from './tools/fs-documents.tool.js';
import { registerAttachmentTools } from './tools/attachments.tool.js';
import { registerReportsTools } from './tools/reports.tool.js';
import { registerJournalsTools } from './tools/journals.tool.js';
import { registerQuotesTools } from './tools/quotes.tool.js';
import { registerRfqsTools } from './tools/rfqs.tool.js';
import { registerProposalsTools } from './tools/proposals.tool.js';
import { registerPurchaseOrdersTools } from './tools/purchase-orders.tool.js';
import { registerWorkOrdersTools } from './tools/work-orders.tool.js';
import { registerBillsTools } from './tools/bills.tool.js';
import { registerInvoicesTools } from './tools/invoices.tool.js';
import { registerFinanceTools } from './tools/finance.tool.js';
import { registerVendorsTools } from './tools/vendors.tool.js';
import { registerOrganisationsTools } from './tools/organisations.tool.js';
import { registerUsersTools } from './tools/users.tool.js';
import { registerNotificationsTools } from './tools/notifications.tool.js';
import { registerGuidesTools } from './tools/guides.tool.js';
import { registerDashboardTools } from './tools/dashboard.tool.js';
import { registerFilesystemTools } from './tools/filesystem.tool.js';
import { registerCatalogTools } from './tools/catalog.tool.js';
import { registerAgentsTools } from './tools/agents.tool.js';
import { registerAiTools } from './tools/ai.tool.js';
import { registerMcpAdminTools } from './tools/mcp-admin.tool.js';
import { registerMessagesTools } from './tools/messages.tool.js';
import { registerProvidersTools } from './tools/providers.tool.js';
import { cloudRunInvokerAuthorization } from './cloud-run-invoker.js';

export interface RequestContext {
  token: string;
  tenantId?: string;
}

export type ToolRegistrar = (server: McpServer, api: ClaimsApiClient) => void;

function compose(...registrars: ToolRegistrar[]): ToolRegistrar {
  return (server, api) => {
    for (const register of registrars) register(server, api);
  };
}

/**
 * Five mounts aligned to product areas (ops + admin tools co-located):
 * - operations: main-menu domains (claims…finance, etc.)
 * - documents: documents / templates / transforms / attachments
 * - filesystem: filesystem trees/templates/pipelines + catalogue
 * - ai: messages/chat ops + agents / AI settings / MCP / providers
 * - organisation: users, orgs, roles, notifications
 */
export const CATEGORY_REGISTRARS: Partial<Record<CategoryId, ToolRegistrar>> = {
  operations: compose(
    registerClaimsTools,
    registerJobsTools,
    registerTasksTools,
    registerContactsTools,
    registerAssessmentsTools,
    registerLookupsTools,
    registerAppointmentsTools,
    registerQuotesTools,
    registerRfqsTools,
    registerProposalsTools,
    registerPurchaseOrdersTools,
    registerWorkOrdersTools,
    registerBillsTools,
    registerInvoicesTools,
    registerFinanceTools,
    registerVendorsTools,
    registerJournalsTools,
    registerReportsTools,
    registerDashboardTools,
  ),
  documents: compose(
    registerTransformTools,
    registerTemplatesTools,
    registerDocumentsTools,
    registerFilesystemDocumentTools,
    registerAttachmentTools,
  ),
  filesystem: compose(registerFilesystemTools, registerCatalogTools),
  ai: compose(
    registerMessagesTools,
    registerAgentsTools,
    registerAiTools,
    registerMcpAdminTools,
    registerProvidersTools,
  ),
  organisation: compose(
    registerOrganisationsTools,
    registerUsersTools,
    registerNotificationsTools,
    registerGuidesTools,
  ),
};

export class ClaimsApiClient {
  constructor(
    private readonly config: ClaimsMcpConfig,
    private readonly getContext: () => RequestContext,
  ) {}

  async request<T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      query?: Record<string, string | number | undefined>;
      body?: unknown;
    },
  ): Promise<T> {
    const { token, tenantId } = this.getContext();
    const url = new URL(`${this.config.CLAIMS_API_URL}/api/v1${path}`);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    };

    if (options?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (tenantId) {
      headers['x-tenant-id'] = tenantId;
    }

    const invokerAuth = await cloudRunInvokerAuthorization(this.config.CLAIMS_API_URL);
    if (invokerAuth) {
      headers['X-Serverless-Authorization'] = invokerAuth;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: options?.method ?? 'GET',
        headers,
        body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      const cause =
        err instanceof Error
          ? err.message + (err.cause ? ` (${String(err.cause)})` : '')
          : String(err);
      throw new Error(
        `Claims API fetch failed ${options?.method ?? 'GET'} ${url.toString()}: ${cause}`,
      );
    }

    const text = await response.text();
    let payload: unknown = {};
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        typeof payload === 'object' &&
        payload !== null &&
        'message' in payload &&
        typeof (payload as { message: unknown }).message === 'string'
          ? (payload as { message: string }).message
          : `Claims API request failed (${response.status}) ${url.pathname}`;
      throw new Error(message);
    }

    return payload as T;
  }
}

export function toolResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[claims-mcp.toolError] ${message}`);
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  };
}

function resolveRegistrars(
  categories?: CategoryId[],
): Array<{ category: CategoryId; register: ToolRegistrar }> {
  const ids =
    categories && categories.length > 0
      ? categories
      : (Object.keys(CATEGORY_REGISTRARS) as CategoryId[]);
  const out: Array<{ category: CategoryId; register: ToolRegistrar }> = [];
  for (const id of ids) {
    if (!isCategoryId(id)) continue;
    const register = CATEGORY_REGISTRARS[id];
    if (register) out.push({ category: id, register });
  }
  return out;
}

export interface CreateClaimsMcpServerOptions {
  /** When set, only these categories' tools are registered. */
  categories?: CategoryId[];
}

export function createClaimsMcpServer(
  config: ClaimsMcpConfig,
  getContext: () => RequestContext,
  options?: CreateClaimsMcpServerOptions,
): McpServer {
  const server = new McpServer({
    name: config.MCP_SERVER_NAME,
    version: config.MCP_SERVER_VERSION,
  });

  const api = new ClaimsApiClient(config, getContext);
  for (const { register } of resolveRegistrars(options?.categories)) {
    register(server, api);
  }

  return server;
}

/** Categories that currently have at least one tool registrar. */
export function implementedCategories(): CategoryId[] {
  return Object.keys(CATEGORY_REGISTRARS) as CategoryId[];
}
