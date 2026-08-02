import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { resolveSystemAgent } from './system-agent-defs';
import { VertexGeminiProvider } from './providers/vertex-gemini.provider';
import type {
  CompletionProvider,
  ProviderContent,
  ProviderMessage,
  ProviderToolDefinition,
  SystemAgentDefinition,
} from './providers/types';

const LOG = '[SystemAgentRunner]';

type ToolFactory = (
  db: DrizzleDB,
  context: Record<string, string>,
) => Record<string, ProviderToolDefinition>;

const toolRegistry = new Map<string, ToolFactory>();

export function registerSystemAgentTools(roleOrSlug: string, factory: ToolFactory): void {
  toolRegistry.set(roleOrSlug, factory);
}

@Injectable()
export class SystemAgentRunner {
  private readonly logger = new Logger(SystemAgentRunner.name);
  private readonly provider: CompletionProvider | null;
  private readonly enabled: boolean;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    // Local/dev uses real ADC via google-auth-library (same as GCS / data_cloud).
    // Enabled whenever GCP_PROJECT_ID is set — no separate feature flag.
    const projectId = this.config.get<string>('GCP_PROJECT_ID');
    this.enabled = Boolean(projectId);
    this.provider = projectId
      ? new VertexGeminiProvider(
          projectId,
          this.config.get<string>('VERTEX_LOCATION') || 'us-central1',
        )
      : null;
  }

  isEnabled(): boolean {
    return this.enabled && !!this.provider;
  }

  async run(
    tenantId: string,
    agentRoleOrId: string,
    context: Record<string, string>,
    opts?: { prompt?: string },
  ): Promise<{ text: string; toolResults: unknown[] }> {
    if (!this.provider) {
      throw new Error(
        `${LOG}.run: Vertex provider not configured (set GCP_PROJECT_ID; local/dev uses ADC via gcloud auth application-default login)`,
      );
    }

    const agent = resolveSystemAgent(agentRoleOrId);
    if (!agent) {
      throw new Error(`${LOG}.run: unknown system agent "${agentRoleOrId}"`);
    }

    const toolFactory = toolRegistry.get(agent.role) ?? toolRegistry.get(agent.id);
    const tools = toolFactory ? toolFactory(this.db, { ...context, tenantId }) : {};
    const prompt =
      opts?.prompt ??
      `Execute agent task for tenant ${tenantId}. Context: ${JSON.stringify(context)}`;

    this.logger.log(
      `${LOG}.run agent=${agent.role} tenantId=${tenantId} tools=${Object.keys(tools).length}`,
    );

    return this.generateWithToolLoop(this.provider, agent, prompt, tools, agent.maxSteps);
  }

  private async generateWithToolLoop(
    provider: CompletionProvider,
    agent: SystemAgentDefinition,
    prompt: string,
    tools: Record<string, ProviderToolDefinition>,
    maxSteps: number,
  ): Promise<{ text: string; toolResults: unknown[] }> {
    let messages: ProviderMessage[] = [
      { role: 'user', content: [{ type: 'text', text: prompt }] },
    ];
    const allToolResults: unknown[] = [];
    let finalText = '';

    for (let step = 0; step < maxSteps; step++) {
      const result = await provider.generate({
        model: agent.model,
        instructions: agent.systemPrompt,
        messages,
        tools: Object.keys(tools).length > 0 ? Object.values(tools) : undefined,
        temperature: agent.temperature,
        maxOutputTokens: agent.maxTokens,
      });

      finalText = result.text;
      if (result.toolCalls.length === 0) {
        return { text: finalText, toolResults: allToolResults };
      }

      const assistantContent: ProviderContent[] = [];
      const toolResultContent: ProviderContent[] = [];

      for (const toolCall of result.toolCalls) {
        assistantContent.push({
          type: 'tool-call',
          id: toolCall.id,
          name: toolCall.name,
          args: toolCall.args,
        });

        const toolDef = tools[toolCall.name];
        let toolResult: unknown;
        try {
          toolResult = toolDef
            ? await toolDef.execute(toolCall.args)
            : { error: `Tool "${toolCall.name}" not found` };
        } catch (err) {
          toolResult = { error: err instanceof Error ? err.message : String(err) };
        }
        allToolResults.push(toolResult);
        toolResultContent.push({
          type: 'tool-result',
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: toolResult,
        });
      }

      messages = [
        ...messages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolResultContent },
      ];
    }

    return { text: finalText, toolResults: allToolResults };
  }
}
