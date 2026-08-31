import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  AiMessageAuditRepository,
  type AiMessageAuditRow,
} from '../../database/repositories/ai-message-audit.repository';
import { AiUserMemoryRepository } from '../../database/repositories/ai-user-memory.repository';
import type {
  McpConnectionRow,
  McpIntegrationRow,
} from '../../database/repositories/mcp-integration.repository';
import { TenantContext } from '../../tenant/tenant-context';
import { mcpConnection, mcpIntegration } from '../../database/schema';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { Inject } from '@nestjs/common';
import { AgentService } from '../agents/agent.service';
import type { AgentConfig } from '../agents/agent.types';
import { ConversationsService } from '../conversations/conversations.service';
import { SkillMatcherService } from '../skills/skill-matcher.service';
import { buildSkillPromptBlock } from '../skills/skill-prompt-builder.js';
import type { SkillConfig, SkillMatchResult } from '../skills/skill.types';
import {
  createNativeMCPClient,
  splitMCPAppTools,
  toolsFromDefinitions,
} from '../mcp-integration/mcp-client';
import type { McpAuthConfig, ApiKeyAuthConfig } from '../mcp-integration/mcp-integration.types';
import {
  buildNamespacedToolId,
  parseNamespacedToolId,
} from '../mcp-integration/mcp-integration.types';
import { McpIntegrationService } from '../mcp-integration/mcp-integration.service';
import { adaptMCPTools } from './mcp-tool-adapter';
import {
  createProvider,
  getSupportedModelOptions,
  resolveModelLocation,
  type ChatProviderId,
} from './providers/model-router';
import type { ProviderOptions, ProviderToolDefinition, ToolCall, TokenUsage } from './providers/types';
import { streamCompletion } from './stream/stream-completion';
import { toProviderMessages } from './stream/message-converter';
import {
  ACTIVATE_SKILL_TOOL_NAME,
  createActivateSkillTool,
} from './stream/skill-activation';
import type { SSEEvent } from './stream/types';
import type { ChatMessage, PageContext, StreamChatParams } from './ai-chat.types';
import { resolvePageContextBlock, type PageDataFetcher } from './page-context';
import { DocumentGenerationService } from '../document-generation/document-generation.service';
import { GuideService } from '../guides/guide.service';

const LOG_PREFIX = 'AiChatService';

const CANVAS_TOOL_MAP: Record<string, string> = {
  create_estimate: 'QuoteFormDrawer',
  create_quote: 'QuoteFormDrawer',
  create_task: 'TaskFormDrawer',
  create_contact: 'ContactFormDrawer',
  open_create_assessment: 'AssessmentCreateDrawer',
  fill_create_assessment: 'AssessmentCreateDrawer',
  open_assessment_attendance: 'AssessmentAttendanceDrawer',
  fill_assessment_attendance: 'AssessmentAttendanceDrawer',
  open_assessment_building: 'AssessmentBuildingTabDrawer',
  fill_assessment_building: 'AssessmentBuildingTabDrawer',
  open_assessment_habitability: 'AssessmentHabitabilityDrawer',
  fill_assessment_habitability: 'AssessmentHabitabilityDrawer',
  open_assessment_hazards: 'AssessmentHazardsTabDrawer',
  fill_assessment_hazards: 'AssessmentHazardsTabDrawer',
  open_assessment_damage: 'AssessmentDamageDrawer',
  fill_assessment_damage: 'AssessmentDamageDrawer',
  open_assessment_makeSafe: 'AssessmentMakeSafeDrawer',
  fill_assessment_makeSafe: 'AssessmentMakeSafeDrawer',
  open_assessment_tempAccommodation: 'AssessmentTempAccommodationDrawer',
  fill_assessment_tempAccommodation: 'AssessmentTempAccommodationDrawer',
  open_assessment_specialists: 'AssessmentSpecialistsDrawer',
  fill_assessment_specialists: 'AssessmentSpecialistsDrawer',
  open_assessment_recommendation: 'AssessmentRecommendationDrawer',
  fill_assessment_recommendation: 'AssessmentRecommendationDrawer',
  open_print_assessment: 'AssessmentPrintDrawer',
  open_catalog: 'CatalogFormDrawer',
  fill_catalog: 'CatalogFormDrawer',
  open_catalog_item: 'CatalogItemFormDrawer',
  fill_catalog_item: 'CatalogItemFormDrawer',
  open_catalog_category: 'CatalogCategoriesDrawer',
  fill_catalog_category: 'CatalogCategoriesDrawer',
  open_catalog_bom: 'CatalogBomDrawer',
  fill_catalog_bom: 'CatalogBomDrawer',
  open_journal_file_upload: 'JournalFileUploadDrawer',
  show_inspection_image: 'JournalImageViewerDrawer',
};

interface ResolvedMcpTools {
  tools: Record<string, unknown>;
  clients: Array<{ close: () => Promise<void> }>;
  degradedServers: string[];
}

@Injectable()
export class AiChatService {
  private readonly logger = new Logger(AiChatService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly skillMatcher: SkillMatcherService,
    private readonly conversationsService: ConversationsService,
    private readonly mcpService: McpIntegrationService,
    private readonly auditRepo: AiMessageAuditRepository,
    private readonly memoryRepo: AiUserMemoryRepository,
    private readonly tenantContext: TenantContext,
    private readonly configService: ConfigService,
    private readonly documentGenService: DocumentGenerationService,
    private readonly guideService: GuideService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  getModels() {
    return getSupportedModelOptions();
  }

  async listAudit(filters: {
    userId?: string;
    model?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.auditRepo.findAuditLog({ tenantId, ...filters });
    return {
      rows: result.rows.map((row) => this.toAuditRecord(row)),
      total: result.total,
    };
  }

  async getAuditDetail(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.auditRepo.findById({ tenantId, id });
    return row ? this.toAuditRecord(row) : null;
  }

  async listConversationAudit(conversationId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const rows = await this.auditRepo.findByConversation({
      tenantId,
      conversationId,
    });
    return rows.map((row) => this.toAuditRecord(row));
  }

  private toAuditRecord(row: AiMessageAuditRow) {
    return {
      id: row.id,
      conversationId: row.conversationId,
      messageId: null,
      agentId: row.agentId,
      agentName: row.agentName,
      agentAvatarColor: null,
      agentAvatarUrl: null,
      provider: row.provider,
      model: row.model,
      temperature: null,
      maxTokens: null,
      systemPrompt: row.systemPromptSnapshot,
      enabledTools: row.toolNames ?? [],
      inputTokens: row.promptTokens,
      outputTokens: row.completionTokens,
      totalTokens: row.totalTokens,
      toolsInvoked: (row.toolNames ?? []).map((name) => ({
        name,
        argsKeys: [] as string[],
      })),
      dataEntitiesAccessed: {} as Record<string, number>,
      requestDurationMs: row.durationMs,
      status: row.status,
      errorMessage: row.errorMessage,
      createdAt:
        row.createdAt instanceof Date
          ? row.createdAt.toISOString()
          : String(row.createdAt),
    };
  }

  async *streamChat(params: StreamChatParams): AsyncGenerator<SSEEvent> {
    const tenantId = this.tenantContext.getTenantId();
    const startTime = Date.now();

    await this.agentService.ensureDefaultAgent(tenantId);
    const agent = await this.agentService.resolveAgentById(
      params.dto.agentId,
      params.user,
    );

    const { tools: mcpTools, clients, degradedServers } =
      await this.resolveMcpTools(params.user, params.bearerToken, agent);

    const aiConfig = this.configService.get('ai', { infer: true });
    const project = aiConfig?.vertexProject ?? '';
    const locations = {
      primary: aiConfig?.vertexLocation ?? 'global',
      extended: aiConfig?.vertexLocation ?? 'global',
    };

    const modelName = agent.model;
    const resolvedLocation = resolveModelLocation(
      agent.provider as ChatProviderId,
      modelName,
      locations,
    );

    const provider = createProvider(
      agent.provider as ChatProviderId,
      modelName,
      project,
      resolvedLocation,
    );

    const adaptedTools = adaptMCPTools(mcpTools);
    const allowlist = agent.enabledTools ?? [];
    const tools: Record<string, ProviderToolDefinition> =
      allowlist.length > 0
        ? Object.fromEntries(
            Object.entries(adaptedTools).filter(([name]) =>
              allowlist.includes(name),
            ),
          )
        : { ...adaptedTools };
    if (allowlist.length > 0) {
      this.logger.log(
        `[${LOG_PREFIX}.streamChat] tool allowlist active: ${Object.keys(tools).length}/${Object.keys(adaptedTools).length}`,
      );
    }
    const rawMessages = (params.dto.messages ?? []) as ChatMessage[];
    const providerMessages = toProviderMessages(rawMessages);

    const pageContext = params.dto.pageContext;
    const skillMatches = await this.matchSkillsForTurn(
      agent,
      rawMessages,
      params.user,
      pageContext?.entityType,
      pageContext?.activeTab,
    );
    let systemPrompt = await this.buildSystemInstructions(
      agent,
      rawMessages,
      params.user,
      skillMatches,
      pageContext,
    );

    if (skillMatches.length > 0) {
      const skillsById = new Map<string, SkillConfig>();
      for (const match of skillMatches) {
        skillsById.set(match.skill.id, match.skill);
      }
      tools[ACTIVATE_SKILL_TOOL_NAME] = createActivateSkillTool({
        skillsById,
        parentModel: modelName,
        getInstructions: () => systemPrompt,
        setInstructions: (next) => {
          systemPrompt = next;
        },
        parentTools: tools,
        allTools: adaptedTools,
        isolated: {
          gcpProjectId: project,
          vertexLocation: resolvedLocation,
          parentModel: modelName,
          parentProvider: agent.provider,
          tools: adaptedTools,
        },
        historyMessages: providerMessages,
        extractLastUserMessage: () => extractLastUserMessage(rawMessages),
      });
      this.logger.log(
        `[${LOG_PREFIX}.streamChat] activate_skill enabled for ${skillsById.size} matched skill(s)`,
      );
    }

    const messageId =
      params.dto.messageId ??
      `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const toolCallArgs = new Map<
      string,
      { args: Record<string, unknown>; originalName: string }
    >();
    const toolNamesInvoked = new Set<string>();
    let assistantText = '';
    let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };
    let streamError: string | undefined;
    let streamStatus: 'success' | 'error' = 'success';

    if (degradedServers.length > 0) {
      this.logger.warn(
        `[${LOG_PREFIX}.streamChat] degraded MCP servers: ${degradedServers.join(', ')}`,
      );
    }

    try {
      const events = streamCompletion({
        provider,
        request: {
          model: modelName,
          instructions: systemPrompt,
          messages: providerMessages,
          temperature: agent.temperature,
          maxOutputTokens: agent.maxTokens,
          providerOptions: buildProviderOptions(agent.provider),
        },
        tools,
        maxSteps: agent.maxSteps ?? 10,
        autonomousMode: agent.autonomousMode ?? false,
        pauseAfterToolSteps: agent.pauseAfterToolSteps ?? 4,
        maxDurationMs: (agent.maxDurationSeconds ?? 120) * 1000,
        messageId,
        getInstructions: () => systemPrompt,
        onToolCall: (toolCall: ToolCall) => {
          toolNamesInvoked.add(resolveOriginalToolName(toolCall.name));
          toolCallArgs.set(toolCall.id, {
            args: toolCall.args,
            originalName: resolveOriginalToolName(toolCall.name),
          });
        },
      });

      for await (const event of events) {
        if (event.type === 'text-delta') {
          assistantText += event.delta;
        }

        if (event.type === 'tool-call') {
          const originalName = resolveOriginalToolName(event.toolName);
          toolCallArgs.set(event.toolCallId, {
            args: (event.args ?? {}) as Record<string, unknown>,
            originalName,
          });
        }

        if (event.type === 'tool-result') {
          const canvasEvent = this.buildCanvasComponentEvent(
            event.toolCallId,
            event.toolName,
            toolCallArgs,
            pageContext,
          );
          if (canvasEvent) {
            yield canvasEvent;
          }

          const guideCanvas = await this.buildGuideCanvasEvent(event);
          if (guideCanvas) {
            yield guideCanvas;
          }
        }

        if (event.type === 'finish') {
          totalUsage = event.totalUsage;
        }

        if (event.type === 'error') {
          streamError = event.message;
          streamStatus = 'error';
        }

        yield event;
      }
    } catch (err) {
      streamStatus = 'error';
      streamError = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${LOG_PREFIX}.streamChat] stream failed: ${streamError}`,
      );
      yield { type: 'error', message: streamError };
    } finally {
      await this.closeMcpClients(clients);
    }

    if (params.dto.conversationId) {
      try {
        await this.persistConversationMessages(
          params.user.sub,
          params.dto.conversationId,
          rawMessages,
          assistantText,
          messageId,
          agent.id,
        );
      } catch (err) {
        this.logger.warn(
          `[${LOG_PREFIX}.streamChat] failed to persist conversation: ${String(err)}`,
        );
      }
    }

    try {
      await this.auditRepo.create({
        tenantId,
        userId: params.user.sub,
        conversationId: params.dto.conversationId ?? null,
        agentId: agent.id,
        agentName: agent.name,
        model: modelName,
        provider: agent.provider,
        promptTokens: totalUsage.inputTokens,
        completionTokens: totalUsage.outputTokens,
        totalTokens: totalUsage.inputTokens + totalUsage.outputTokens,
        toolCallsCount: toolNamesInvoked.size,
        toolNames: [...toolNamesInvoked],
        systemPromptSnapshot: systemPrompt,
        durationMs: Date.now() - startTime,
        status: streamStatus,
        errorMessage: streamError ?? null,
      });
    } catch (err) {
      this.logger.warn(
        `[${LOG_PREFIX}.streamChat] failed to write audit: ${String(err)}`,
      );
    }
  }

  private buildCanvasComponentEvent(
    toolCallId: string,
    namespacedToolName: string,
    toolCallArgs: Map<string, { args: Record<string, unknown>; originalName: string }>,
    pageContext?: PageContext,
  ): SSEEvent | null {
    const tracked = toolCallArgs.get(toolCallId);
    const originalName =
      tracked?.originalName ?? resolveOriginalToolName(namespacedToolName);
    const component = resolveCanvasComponent(originalName);
    if (!component) return null;

    const args = { ...(tracked?.args ?? {}) };
    const argJobId = typeof args.jobId === 'string' ? args.jobId.trim() : '';
    if (!argJobId && pageContext?.jobId) {
      args.jobId = pageContext.jobId;
    }
    const argJournalId = typeof args.journalId === 'string' ? args.journalId.trim() : '';
    if (!argJournalId && pageContext?.entityType === 'journal' && pageContext.entityId) {
      args.journalId = pageContext.entityId;
    }

    return {
      type: 'canvas-component',
      component,
      props: args,
      toolCallId,
      toolName: originalName,
    };
  }

  /**
   * When open_help_guide (or a successful search_help_guides) returns a guide,
   * open it as a canvas artifact so the user can read the full guide beside chat.
   */
  private async buildGuideCanvasEvent(event: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
  }): Promise<SSEEvent | null> {
    if (event.isError) return null;

    const originalName = resolveOriginalToolName(event.toolName);

    if (originalName === 'open_help_guide') {
      const payload = unwrapGuideToolResult(event.result);
      if (!payload?.content) return null;
      const title = payload.title?.trim() || payload.slug || 'Help Guide';
      const artifactId = `guide_${payload.slug ?? event.toolCallId}`;
      this.logger.log(
        `[${LOG_PREFIX}.buildGuideCanvasEvent] opening guide canvas title=${title}`,
      );
      return {
        type: 'canvas-action',
        action: 'open',
        artifactId,
        title,
        contentType: 'markdown',
        content: payload.content,
        version: 1,
      };
    }

    if (originalName !== 'search_help_guides') return null;

    const hits = unwrapGuideSearchHits(event.result);
    const top = hits[0];
    if (!top?.slug) return null;

    try {
      const tenantId = this.tenantContext.getTenantId();
      const doc = await this.guideService.getGuideContent(tenantId, top.slug);
      if (!doc?.content) return null;
      this.logger.log(
        `[${LOG_PREFIX}.buildGuideCanvasEvent] opening top search hit slug=${doc.slug}`,
      );
      return {
        type: 'canvas-action',
        action: 'open',
        artifactId: `guide_${doc.slug}`,
        title: doc.title,
        contentType: 'markdown',
        content: doc.content,
        version: 1,
      };
    } catch (err) {
      this.logger.warn(
        `[${LOG_PREFIX}.buildGuideCanvasEvent] failed to open search hit: ${String(err)}`,
      );
      return null;
    }
  }

  private async matchSkillsForTurn(
    agent: AgentConfig,
    messages: ChatMessage[],
    user: AuthenticatedUser,
    pageEntityType?: string,
    activeTab?: string,
  ): Promise<SkillMatchResult[]> {
    const lastUserMessage = extractLastUserMessage(messages);
    if (!lastUserMessage.trim()) return [];
    try {
      return await this.skillMatcher.findMatches(lastUserMessage, agent, user, pageEntityType, activeTab);
    } catch (err) {
      this.logger.warn(
        `[${LOG_PREFIX}.matchSkillsForTurn] skill matching failed: ${String(err)}`,
      );
      return [];
    }
  }

  private async buildSystemInstructions(
    agent: AgentConfig,
    _messages: ChatMessage[],
    user: AuthenticatedUser,
    skillMatches: SkillMatchResult[] = [],
    pageContext?: PageContext,
  ): Promise<string> {
    const basePrompt = agent.systemPrompt;
    let enrichedPrompt = basePrompt;

    const fetcher: PageDataFetcher = (docType, entityId) =>
      this.fetchPageData(docType, entityId);

    const { contextBlock } = await resolvePageContextBlock(pageContext, fetcher, {
      tenantId: this.tenantContext.getTenantId(),
    });
    if (contextBlock) {
      enrichedPrompt += contextBlock;
    }

    if (skillMatches.length > 0) {
      enrichedPrompt += buildSkillPromptBlock(skillMatches);
    }

    if (pageContext?.pathname) {
      try {
        const tenantId = this.tenantContext.getTenantId();
        const guides = await this.guideService.getGuidesByRoute(tenantId, pageContext.pathname);
        if (guides.length > 0) {
          const guideList = guides.map(
            (g) =>
              `- **${g.title}** (slug: \`${g.slug}\`, routes: ${(g.routes ?? []).join(', ')}): ${g.description ?? ''}`,
          );
          enrichedPrompt += `\n\n## Available Help Guides\nCurrent pathname: \`${pageContext.pathname}\`\nCall \`get_guides_for_route\` with route=\`${pageContext.pathname}\` (not the page label), then \`open_help_guide\` with the guide slug so it opens in the canvas.\n${guideList.join('\n')}`;
        }
      } catch (err) {
        this.logger.warn(
          `[${LOG_PREFIX}.buildSystemInstructions] guide lookup failed: ${String(err)}`,
        );
      }
    }

    try {
      const tenantId = this.tenantContext.getTenantId();
      const memories = await this.memoryRepo.findByTenantAndUser({
        tenantId,
        userId: user.sub,
        limit: 50,
      });
      if (memories.length > 0) {
        const memoryLines = memories.map((m) => `- ${m.key}: ${m.value}`);
        enrichedPrompt += `\n\n## User Preferences\n${memoryLines.join('\n')}`;
      }
    } catch (err) {
      this.logger.warn(
        `[${LOG_PREFIX}.buildSystemInstructions] memory loading failed: ${String(err)}`,
      );
    }

    return enrichedPrompt;
  }

  private async fetchPageData(
    documentType: string,
    entityId: string,
  ): Promise<Record<string, unknown> | null> {
    try {
      const data = await this.documentGenService.getSampleData({
        documentType: documentType as import('../document-generation/types/document-types').DocumentType,
        entityId,
      });
      return data;
    } catch (err) {
      this.logger.debug(
        `[${LOG_PREFIX}.fetchPageData] mapper not available for ${documentType}/${entityId}: ${String(err)}`,
      );
      return null;
    }
  }

  private async persistConversationMessages(
    userId: string,
    conversationId: string,
    incomingMessages: ChatMessage[],
    assistantText: string,
    messageId: string,
    agentId: string,
  ): Promise<void> {
    const messages = [...incomingMessages];

    if (assistantText.trim()) {
      messages.push({
        id: messageId,
        role: 'assistant',
        parts: [{ type: 'text', text: assistantText }],
      });
    }

    await this.conversationsService.update(userId, conversationId, {
      messages,
      agentId,
    });
  }

  private async resolveMcpTools(
    user: AuthenticatedUser,
    bearerToken: string,
    agent: AgentConfig,
  ): Promise<ResolvedMcpTools> {
    const tenantId = this.tenantContext.getTenantId();
    const connections = await this.resolveConnections(tenantId, user.sub);

    let filtered = agent.connectionIds?.length
      ? connections.filter(({ connection }) =>
          agent.connectionIds!.includes(connection.id),
        )
      : connections;

    filtered = filtered.filter(
      ({ connection }) =>
        connection.enabled &&
        ['connected', 'reauth_required'].includes(connection.status),
    );

    if (filtered.length === 0) {
      this.logger.log(
        `[${LOG_PREFIX}.resolveMcpTools] no MCP connections — chat proceeds without tools`,
      );
      return { tools: {}, clients: [], degradedServers: [] };
    }

    const mcpTools: Record<string, unknown> = {};
    const clients: Array<{ close: () => Promise<void> }> = [];
    const degradedServers: string[] = [];

    for (const { integration, connection } of filtered) {
      try {
        const credential = await this.mcpService.resolveCredential(
          connection,
          integration,
          bearerToken,
        );

        const headers: Record<string, string> = {
          'X-Effective-Tenant-Id': tenantId,
        };

        if (
          connection.authType === 'bearer_passthrough' &&
          integration.trustedServer &&
          credential.token
        ) {
          headers.Authorization = `Bearer ${credential.token}`;
        } else if (connection.authType === 'api_key' && credential.apiKey) {
          const authConfig = (integration.authConfig as McpAuthConfig)?.api_key as
            | ApiKeyAuthConfig
            | undefined;
          const headerName = authConfig?.headerName ?? 'Authorization';
          const prefix = authConfig?.headerPrefix;
          headers[headerName] = prefix
            ? `${prefix} ${credential.apiKey}`
            : credential.apiKey;
        } else if (connection.authType === 'oauth' && credential.token) {
          headers.Authorization = `Bearer ${credential.token}`;
        }

        const mcpClient = await createNativeMCPClient({
          transportType: integration.transportType as 'http' | 'sse',
          url: integration.url,
          headers,
        });
        clients.push(mcpClient);

        const definitions = await mcpClient.listTools();
        const { modelVisible } = splitMCPAppTools(definitions);
        const discovered = toolsFromDefinitions(modelVisible, mcpClient);

        for (const [toolName, tool] of Object.entries(discovered)) {
          const namespacedId = buildNamespacedToolId(connection.id, toolName);
          mcpTools[namespacedId] = tool;
        }
      } catch (err) {
        degradedServers.push(integration.name);
        this.logger.warn(
          `[${LOG_PREFIX}.resolveMcpTools] MCP connection failed for ${integration.name}: ${String(err)}`,
        );
      }
    }

    return { tools: mcpTools, clients, degradedServers };
  }

  private async resolveConnections(
    tenantId: string,
    userId: string,
  ): Promise<Array<{ integration: McpIntegrationRow; connection: McpConnectionRow }>> {
    return this.db
      .select({
        integration: mcpIntegration,
        connection: mcpConnection,
      })
      .from(mcpConnection)
      .innerJoin(mcpIntegration, eq(mcpConnection.integrationId, mcpIntegration.id))
      .where(
        and(
          eq(mcpConnection.tenantId, tenantId),
          eq(mcpConnection.enabled, true),
          isNull(mcpConnection.deletedAt),
          inArray(mcpConnection.status, ['connected', 'reauth_required']),
          inArray(mcpIntegration.status, ['active']),
          or(
            eq(mcpConnection.visibility, 'org'),
            and(
              eq(mcpConnection.visibility, 'private'),
              eq(mcpConnection.userId, userId),
            ),
          ),
        ),
      );
  }

  private async closeMcpClients(
    clients: Array<{ close: () => Promise<void> }>,
  ): Promise<void> {
    for (const client of clients) {
      try {
        await client.close();
      } catch (err) {
        this.logger.warn(
          `[${LOG_PREFIX}.closeMcpClients] client close error: ${String(err)}`,
        );
      }
    }
  }
}

function buildProviderOptions(provider: string): ProviderOptions | undefined {
  switch (provider) {
    case 'google':
    case 'vertex-gemini':
      return { thinkingConfig: { includeThoughts: true } };
    case 'anthropic':
    case 'vertex-anthropic':
      return { anthropicThinking: { type: 'enabled', budgetTokens: 8192 } };
    default:
      return undefined;
  }
}

function resolveOriginalToolName(namespacedToolName: string): string {
  const [, originalName] = parseNamespacedToolId(namespacedToolName);
  return originalName ?? namespacedToolName;
}

function resolveCanvasComponent(originalToolName: string): string | null {
  if (CANVAS_TOOL_MAP[originalToolName]) {
    return CANVAS_TOOL_MAP[originalToolName];
  }

  for (const [suffix, component] of Object.entries(CANVAS_TOOL_MAP)) {
    if (originalToolName.endsWith(suffix)) {
      return component;
    }
  }

  return null;
}

function extractLastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== 'user') continue;

    if (typeof message.content === 'string' && message.content.trim()) {
      return message.content;
    }

    const parts = message.parts ?? [];
    const text = parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join(' ')
      .trim();
    if (text) return text;
  }

  return '';
}

function unwrapGuideToolResult(
  result: unknown,
): { content?: string; title?: string; slug?: string } | null {
  if (!result) return null;

  if (typeof result === 'object' && result !== null && 'content' in result) {
    const obj = result as {
      content?: unknown;
      title?: string;
      slug?: string;
    };

    // Direct API shape: { content, title, slug }
    if (typeof obj.content === 'string') {
      return { content: obj.content, title: obj.title, slug: obj.slug };
    }

    // MCP content envelope: { content: [{ type: 'text', text: '...' }] }
    if (Array.isArray(obj.content)) {
      const textPart = obj.content.find(
        (part): part is { type: string; text: string } =>
          !!part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type: string }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      );
      if (textPart?.text) {
        try {
          const parsed = JSON.parse(textPart.text) as {
            content?: string;
            title?: string;
            slug?: string;
          };
          if (parsed?.content) return parsed;
        } catch {
          return { content: textPart.text };
        }
      }
    }
  }

  if (typeof result === 'string') {
    try {
      return unwrapGuideToolResult(JSON.parse(result));
    } catch {
      return null;
    }
  }

  return null;
}

function unwrapGuideSearchHits(
  result: unknown,
): Array<{ slug?: string; title?: string }> {
  const parsed = unwrapJsonValue(result);
  if (Array.isArray(parsed)) {
    return parsed.filter(
      (item): item is { slug?: string; title?: string } =>
        !!item && typeof item === 'object',
    );
  }
  return [];
}

function unwrapJsonValue(result: unknown): unknown {
  if (!result) return null;

  if (Array.isArray(result)) return result;

  if (typeof result === 'object' && result !== null && 'content' in result) {
    const obj = result as { content?: unknown };
    if (Array.isArray(obj.content)) {
      const textPart = obj.content.find(
        (part): part is { type: string; text: string } =>
          !!part &&
          typeof part === 'object' &&
          'type' in part &&
          (part as { type: string }).type === 'text' &&
          typeof (part as { text?: unknown }).text === 'string',
      );
      if (textPart?.text) {
        try {
          return JSON.parse(textPart.text);
        } catch {
          return null;
        }
      }
    }
  }

  if (typeof result === 'string') {
    try {
      return JSON.parse(result);
    } catch {
      return null;
    }
  }

  return result;
}
