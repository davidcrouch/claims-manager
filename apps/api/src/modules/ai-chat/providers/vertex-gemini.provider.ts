import { Logger } from '@nestjs/common';
import { GoogleGenAI, type Content, type Part, type FunctionDeclaration, Type } from '@google/genai';
import type {
  CompletionProvider,
  CompletionRequest,
  StreamChunk,
  GenerateResult,
  ProviderMessage,
  ProviderContent,
  ProviderToolDefinition,
  ToolCall,
  TokenUsage,
} from './types';

export class VertexGeminiProvider implements CompletionProvider {
  private readonly logger = new Logger('VertexGeminiProvider');
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(model: string, project: string, location: string) {
    this.client = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });
    this.model = model;
  }

  /**
   * When tools are present, use non-streaming generateContent under the hood.
   * Gemini 3.x attaches `thoughtSignature` to functionCall parts; streaming
   * chunks often omit it, which causes a 400 on the next tool-loop turn.
   */
  async *stream(request: CompletionRequest): AsyncIterable<StreamChunk> {
    if (request.tools && request.tools.length > 0) {
      this.logger.log(
        '[VertexGeminiProvider.stream] using non-stream generate for tool turn (thoughtSignature safe)',
      );
      const result = await this.generate(request);
      if (result.reasoningText) {
        yield { type: 'reasoning-delta', delta: result.reasoningText };
      }
      if (result.text) {
        yield { type: 'text-delta', delta: result.text };
      }
      for (const toolCall of result.toolCalls) {
        yield { type: 'tool-call', toolCall };
      }
      yield { type: 'usage', usage: result.usage };
      yield { type: 'finish', finishReason: result.toolCalls.length > 0 ? 'TOOL_CALLS' : 'STOP' };
      return;
    }

    const contents = toGeminiContents(this.logger, request.messages);
    const response = await this.client.models.generateContentStream({
      model: this.model,
      contents,
      config: {
        systemInstruction: request.instructions || undefined,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        ...(request.providerOptions?.thinkingConfig
          ? { thinkingConfig: request.providerOptions.thinkingConfig }
          : {}),
      },
    });

    for await (const chunk of response) {
      const candidates = chunk.candidates;
      if (!candidates?.length) continue;

      const candidate = candidates[0];
      if (!candidate.content?.parts) continue;

      for (const part of candidate.content.parts) {
        if (part.thought && part.text) {
          yield { type: 'reasoning-delta', delta: part.text };
        } else if (part.text) {
          yield { type: 'text-delta', delta: part.text };
        }
      }

      if (chunk.usageMetadata) {
        yield {
          type: 'usage',
          usage: {
            inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
            outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
          },
        };
      }

      if (candidate.finishReason) {
        yield { type: 'finish', finishReason: candidate.finishReason };
      }
    }
  }

  async generate(request: CompletionRequest): Promise<GenerateResult> {
    const contents = toGeminiContents(this.logger, request.messages);
    const tools = request.tools ? toGeminiFunctionDeclarations(request.tools) : undefined;

    const response = await this.client.models.generateContent({
      model: this.model,
      contents,
      config: {
        systemInstruction: request.instructions || undefined,
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
        ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
        ...(request.providerOptions?.thinkingConfig
          ? { thinkingConfig: request.providerOptions.thinkingConfig }
          : {}),
      },
    });

    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];
    let reasoningText: string | undefined;

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const finishReason = response.candidates?.[0]?.finishReason ?? null;
    for (const part of parts) {
      if (part.thought && part.text) {
        reasoningText = (reasoningText ?? '') + part.text;
      } else if (part.text) {
        textParts.push(part.text);
      }
      if (part.functionCall) {
        const thoughtSignature = extractThoughtSignature(part);
        const callId =
          (typeof part.functionCall.id === 'string' && part.functionCall.id.length > 0
            ? part.functionCall.id
            : undefined) ??
          `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        toolCalls.push({
          id: callId,
          name: part.functionCall.name!,
          args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          thoughtSignature,
        });
      }
    }

    if (toolCalls.length === 0 && textParts.length === 0) {
      this.logger.warn(
        `[VertexGeminiProvider.generate] empty model response (finishReason=${finishReason})`,
      );
    }

    if (toolCalls.length > 0 && !toolCalls.some((t) => t.thoughtSignature)) {
      this.logger.warn(
        '[VertexGeminiProvider.generate] functionCalls missing thoughtSignature — tool loop may 400',
      );
    }

    const usage: TokenUsage = {
      inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
    };

    const text = textParts.join('');
    const finalText = text || (toolCalls.length === 0 ? (response.text ?? '') : '');

    return {
      text: finalText,
      usage,
      toolCalls,
      reasoningText,
      steps: [{
        text: finalText,
        toolCalls,
        toolResults: [],
        usage,
      }],
    };
  }
}

function extractThoughtSignature(part: Part): string | undefined {
  const direct = part.thoughtSignature;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  const raw = part as unknown as Record<string, unknown>;
  const snake = raw.thought_signature;
  if (typeof snake === 'string' && snake.length > 0) return snake;

  return undefined;
}

function toGeminiContents(logger: Logger, messages: ProviderMessage[]): Content[] {
  const sanitized = summarizeUnsignedToolTurns(logger, messages);
  const contents: Content[] = [];

  for (const msg of sanitized) {
    if (msg.role === 'system') continue;

    const parts: Part[] = [];
    for (const content of msg.content) {
      switch (content.type) {
        case 'text':
          parts.push({ text: content.text });
          break;
        case 'tool-call':
          parts.push({
            functionCall: {
              id: content.id,
              name: content.name,
              args: content.args,
            },
            ...(content.thoughtSignature
              ? { thoughtSignature: content.thoughtSignature }
              : {}),
          });
          break;
        case 'tool-result':
          parts.push({
            functionResponse: {
              id: content.toolCallId,
              name: content.name,
              response: normalizeFunctionResponse(content.result, content.isError),
            },
          });
          break;
        case 'file':
          parts.push({
            inlineData: {
              mimeType: content.mimeType,
              data: content.data,
            },
          });
          break;
        case 'reasoning':
          break;
      }
    }

    if (parts.length > 0) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts,
      });
    }
  }

  return contents;
}

function normalizeFunctionResponse(
  result: unknown,
  isError?: boolean,
): Record<string, unknown> {
  if (isError) {
    const message =
      result && typeof result === 'object' && 'message' in (result as object)
        ? String((result as { message: unknown }).message)
        : typeof result === 'string'
          ? result
          : JSON.stringify(result);
    return { error: message };
  }
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const obj = result as Record<string, unknown>;
    if ('output' in obj || 'error' in obj) return obj;
    return { output: obj };
  }
  return { output: result };
}

const REDACT_ARG_KEYS = /password|secret|token|credential|mfa|otp|code/i;

function summarizeUnsignedToolTurns(messages: ProviderMessage[]): ProviderMessage[];
function summarizeUnsignedToolTurns(logger: Logger, messages: ProviderMessage[]): ProviderMessage[];
function summarizeUnsignedToolTurns(
  loggerOrMessages: Logger | ProviderMessage[],
  maybeMessages?: ProviderMessage[],
): ProviderMessage[] {
  const logger = maybeMessages ? (loggerOrMessages as Logger) : undefined;
  const messages = maybeMessages ?? (loggerOrMessages as ProviderMessage[]);
  const result: ProviderMessage[] = [];
  let summarized = 0;

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const toolCalls = msg.content.filter(
      (c): c is Extract<ProviderContent, { type: 'tool-call' }> => c.type === 'tool-call',
    );

    if (msg.role === 'assistant' && toolCalls.length > 0) {
      const missingSig = toolCalls.some((c) => !c.thoughtSignature);
      if (missingSig) {
        const inlineResults = msg.content.filter(
          (c): c is Extract<ProviderContent, { type: 'tool-result' }> => c.type === 'tool-result',
        );
        const next = messages[i + 1];
        const followingResults =
          next?.role === 'user' &&
          next.content.length > 0 &&
          next.content.every((c) => c.type === 'tool-result')
            ? (next.content as Extract<ProviderContent, { type: 'tool-result' }>[])
            : [];
        const toolResults = inlineResults.length > 0 ? inlineResults : followingResults;

        const lines = toolCalls.map((call) => {
          const shortName = shortToolName(call.name);
          const matched = toolResults.find(
            (r) => r.toolCallId === call.id || r.name === call.name || shortToolName(r.name) === shortName,
          );
          return formatToolHistoryLine(shortName, call.args, matched?.result, matched?.isError);
        });

        const textParts = msg.content.filter(
          (c): c is Extract<ProviderContent, { type: 'text' }> => c.type === 'text',
        );
        const summaryText = [
          ...textParts.map((t) => t.text),
          '[Prior tool activity in this conversation — continue from this state; do not repeat completed steps]',
          ...lines,
        ]
          .filter(Boolean)
          .join('\n');

        result.push({
          role: 'assistant',
          content: [{ type: 'text', text: summaryText }],
        });

        if (followingResults.length > 0 && inlineResults.length === 0) {
          i++;
        }
        summarized++;
        continue;
      }
    }

    if (
      msg.role === 'user' &&
      msg.content.length > 0 &&
      msg.content.every((c) => c.type === 'tool-result')
    ) {
      const prev = result[result.length - 1];
      const prevNeedsResults =
        prev?.role === 'assistant' &&
        prev.content.some((c) => c.type === 'tool-call');
      if (!prevNeedsResults) {
        continue;
      }
    }

    result.push(msg);
  }

  if (summarized > 0) {
    logger?.log(
      `[VertexGeminiProvider.summarizeUnsignedToolTurns] rewrote ${summarized} unsigned tool turns as text`,
    );
  }

  return result;
}

function shortToolName(name: string): string {
  const idx = name.lastIndexOf('__');
  return idx >= 0 ? name.slice(idx + 2) : name;
}

function formatToolHistoryLine(
  toolName: string,
  args: Record<string, unknown>,
  result: unknown,
  isError?: boolean,
): string {
  const safeArgs: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args ?? {})) {
    safeArgs[k] = REDACT_ARG_KEYS.test(k) ? '[redacted]' : v;
  }
  const argStr = Object.keys(safeArgs).length > 0 ? ` args=${compactJson(safeArgs)}` : '';
  const resultStr =
    result === undefined
      ? ''
      : isError
        ? ` error=${compactJson(result)}`
        : ` result=${compactJson(result)}`;
  return `- ${toolName}${argStr}${resultStr}`;
}

function compactJson(value: unknown): string {
  try {
    const s = JSON.stringify(value);
    return s.length > 400 ? `${s.slice(0, 400)}…` : s;
  } catch {
    return String(value);
  }
}

function toGeminiFunctionDeclarations(tools: ProviderToolDefinition[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: convertJsonSchemaToGemini(tool.inputSchema ?? {}),
  }));
}

function convertJsonSchemaToGemini(schema: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (schema.type) {
    const typeMap: Record<string, string> = {
      string: Type.STRING,
      number: Type.NUMBER,
      integer: Type.INTEGER,
      boolean: Type.BOOLEAN,
      array: Type.ARRAY,
      object: Type.OBJECT,
    };
    result.type = typeMap[schema.type as string] ?? Type.STRING;
  }

  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;
  if (schema.required) result.required = schema.required;

  if (schema.properties && typeof schema.properties === 'object') {
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(schema.properties as Record<string, unknown>)) {
      if (value && typeof value === 'object') {
        properties[key] = convertJsonSchemaToGemini(value as Record<string, unknown>);
      }
    }
    result.properties = properties;
  }

  if (schema.items && typeof schema.items === 'object' && !Array.isArray(schema.items)) {
    result.items = convertJsonSchemaToGemini(schema.items as Record<string, unknown>);
  }

  if (!result.type) {
    if (result.properties || schema.additionalProperties !== undefined || Object.keys(schema).length === 0) {
      result.type = Type.OBJECT;
    } else if (result.items) {
      result.type = Type.ARRAY;
    } else {
      result.type = Type.STRING;
    }
  }

  if (result.type === Type.OBJECT && !result.properties) {
    result.properties = {};
  }

  if (result.type === Type.ARRAY && !result.items) {
    result.items = { type: Type.STRING };
  }

  return result;
}
