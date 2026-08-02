export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  /**
   * Gemini 3.x thought signature. Must be echoed back on the same
   * functionCall part in subsequent turns or the API returns 400.
   */
  thoughtSignature?: string;
}

export interface ToolResult {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: ProviderContent[];
}

export type ProviderContent =
  | { type: 'text'; text: string }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      args: Record<string, unknown>;
      /** Gemini 3.x — echo back on functionCall parts. */
      thoughtSignature?: string;
    }
  | { type: 'tool-result'; toolCallId: string; name: string; result: unknown; isError?: boolean }
  | { type: 'file'; mimeType: string; data: string }
  | { type: 'reasoning'; text: string };

export interface ProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  resourceUri?: string;
}

export interface ProviderOptions {
  thinkingConfig?: { includeThoughts: boolean };
  anthropicThinking?: { type: 'enabled'; budgetTokens: number };
}

export interface CompletionRequest {
  model: string;
  instructions: string;
  messages: ProviderMessage[];
  tools?: ProviderToolDefinition[];
  temperature?: number;
  maxOutputTokens?: number;
  providerOptions?: ProviderOptions;
}

export type StreamChunk =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call'; toolCall: ToolCall }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'finish'; finishReason: string };

export interface GenerateResult {
  text: string;
  usage: TokenUsage;
  toolCalls: ToolCall[];
  reasoningText?: string;
  steps: GenerateStep[];
}

export interface GenerateStep {
  text: string;
  toolCalls: ToolCall[];
  toolResults: unknown[];
  usage: TokenUsage;
}

export interface CompletionProvider {
  stream(request: CompletionRequest): AsyncIterable<StreamChunk>;
  generate(request: CompletionRequest): Promise<GenerateResult>;
}
