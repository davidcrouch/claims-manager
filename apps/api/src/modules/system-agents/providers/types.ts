export interface ProviderToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>) => Promise<unknown>;
}

export type ProviderContent =
  | { type: 'text'; text: string }
  | {
      type: 'tool-call';
      id: string;
      name: string;
      args: Record<string, unknown>;
    }
  | {
      type: 'tool-result';
      toolCallId: string;
      name: string;
      result: unknown;
    };

export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: ProviderContent[];
}

export interface GenerateResult {
  text: string;
  toolCalls: Array<{
    id: string;
    name: string;
    args: Record<string, unknown>;
  }>;
}

export interface CompletionProvider {
  generate(params: {
    model: string;
    instructions?: string;
    messages: ProviderMessage[];
    tools?: ProviderToolDefinition[];
    temperature?: number;
    maxOutputTokens?: number;
  }): Promise<GenerateResult>;
}

export interface SystemAgentDefinition {
  id: string;
  role: string;
  name: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxSteps: number;
}
