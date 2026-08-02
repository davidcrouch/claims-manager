import { Logger } from '@nestjs/common';
import { AnthropicVertex } from '@anthropic-ai/vertex-sdk';
import type Anthropic from '@anthropic-ai/sdk';
import type {
  CompletionProvider,
  CompletionRequest,
  StreamChunk,
  GenerateResult,
  ProviderMessage,
  ProviderToolDefinition,
  ToolCall,
  TokenUsage,
} from './types';

type MessageParam = Anthropic.MessageParam;
type ContentBlockParam = Anthropic.ContentBlockParam;
type Tool = Anthropic.Tool;

export class VertexAnthropicProvider implements CompletionProvider {
  private readonly logger = new Logger('VertexAnthropicProvider');
  private readonly client: AnthropicVertex;
  private readonly model: string;

  constructor(model: string, project: string, location: string) {
    this.client = new AnthropicVertex({
      projectId: project,
      region: location,
    });
    this.model = model;
  }

  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    const messages = toAnthropicMessages(request.messages);
    const tools = request.tools ? toAnthropicTools(request.tools) : undefined;
    const thinkingConfig = request.providerOptions?.anthropicThinking;

    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: request.maxOutputTokens ?? 4096,
      system: request.instructions || undefined,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      temperature: request.temperature,
      ...(thinkingConfig
        ? {
            thinking: {
              type: thinkingConfig.type,
              budget_tokens: thinkingConfig.budgetTokens,
            },
          }
        : {}),
    });

    let currentToolCallId: string | undefined;
    let currentToolName: string | undefined;
    let toolInputJson = '';

    for await (const event of stream) {
      switch (event.type) {
        case 'content_block_start': {
          const block = event.content_block;
          if (block.type === 'tool_use') {
            currentToolCallId = block.id;
            currentToolName = block.name;
            toolInputJson = '';
          }
          break;
        }

        case 'content_block_delta': {
          const delta = event.delta;
          if (delta.type === 'text_delta') {
            yield { type: 'text-delta', delta: delta.text };
          } else if (delta.type === 'thinking_delta') {
            yield { type: 'reasoning-delta', delta: delta.thinking };
          } else if (delta.type === 'input_json_delta') {
            toolInputJson += delta.partial_json;
          }
          break;
        }

        case 'content_block_stop': {
          if (currentToolCallId && currentToolName) {
            let args: Record<string, unknown> = {};
            try {
              args = toolInputJson ? JSON.parse(toolInputJson) : {};
            } catch (err) {
              this.logger.warn(
                `[VertexAnthropicProvider.stream] failed to parse tool call args: ${String(err)}`,
              );
            }
            yield {
              type: 'tool-call',
              toolCall: {
                id: currentToolCallId,
                name: currentToolName,
                args,
              },
            };
            currentToolCallId = undefined;
            currentToolName = undefined;
            toolInputJson = '';
          }
          break;
        }

        case 'message_delta': {
          if (event.usage) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: 0,
                outputTokens: event.usage.output_tokens ?? 0,
              },
            };
          }
          if (event.delta?.stop_reason) {
            yield { type: 'finish', finishReason: event.delta.stop_reason };
          }
          break;
        }

        case 'message_start': {
          if (event.message?.usage) {
            yield {
              type: 'usage',
              usage: {
                inputTokens: event.message.usage.input_tokens ?? 0,
                outputTokens: event.message.usage.output_tokens ?? 0,
              },
            };
          }
          break;
        }
      }
    }
  }

  async generate(request: CompletionRequest): Promise<GenerateResult> {
    const messages = toAnthropicMessages(request.messages);
    const tools = request.tools ? toAnthropicTools(request.tools) : undefined;
    const thinkingConfig = request.providerOptions?.anthropicThinking;

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxOutputTokens ?? 4096,
      system: request.instructions || undefined,
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
      temperature: request.temperature,
      ...(thinkingConfig
        ? {
            thinking: {
              type: thinkingConfig.type,
              budget_tokens: thinkingConfig.budgetTokens,
            },
          }
        : {}),
    });

    let text = '';
    let reasoningText: string | undefined;
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        text += (block as { type: 'text'; text: string }).text;
      } else if (block.type === 'thinking') {
        reasoningText =
          (reasoningText ?? '') +
          (block as { type: 'thinking'; thinking: string }).thinking;
      } else if (block.type === 'tool_use') {
        const toolUse = block as { type: 'tool_use'; id: string; name: string; input: unknown };
        toolCalls.push({
          id: toolUse.id,
          name: toolUse.name,
          args: (toolUse.input ?? {}) as Record<string, unknown>,
        });
      }
    }

    const usage: TokenUsage = {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    };

    return {
      text,
      usage,
      toolCalls,
      reasoningText,
      steps: [{
        text,
        toolCalls,
        toolResults: [],
        usage,
      }],
    };
  }
}

function toAnthropicMessages(messages: ProviderMessage[]): MessageParam[] {
  const result: MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;

    const content: ContentBlockParam[] = [];

    for (const part of msg.content) {
      switch (part.type) {
        case 'text':
          content.push({ type: 'text', text: part.text });
          break;
        case 'tool-call':
          content.push({
            type: 'tool_use',
            id: part.id,
            name: part.name,
            input: part.args,
          });
          break;
        case 'tool-result':
          content.push({
            type: 'tool_result',
            tool_use_id: part.toolCallId,
            content:
              typeof part.result === 'string'
                ? part.result
                : JSON.stringify(part.result),
            is_error: part.isError,
          });
          break;
        case 'file':
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: part.mimeType as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp',
              data: part.data,
            },
          });
          break;
        case 'reasoning':
          break;
      }
    }

    if (content.length > 0) {
      result.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content,
      });
    }
  }

  return result;
}

function toAnthropicTools(tools: ProviderToolDefinition[]): Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      ...tool.inputSchema,
    },
  }));
}
