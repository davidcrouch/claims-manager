export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: ChatPart[];
  parentId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export type ChatPart =
  | TextPart
  | ReasoningPart
  | ToolCallPart
  | ToolResultPart
  | FilePart
  | CitationPart
  | CanvasActionPart
  | CanvasComponentPart
  | McpAppPart;

export interface TextPart {
  type: 'text';
  text: string;
}

export interface ReasoningPart {
  type: 'reasoning';
  text: string;
}

export interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: unknown;
  state: 'pending' | 'complete' | 'error';
  /** Gemini 3.x — must be echoed back on subsequent turns when present. */
  thoughtSignature?: string;
}

export interface ToolResultPart {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export interface FilePart {
  type: 'file';
  /** Durable GCS reference — persisted in messages_jsonb */
  uri?: string;
  /** Ephemeral display URL — data:, signed HTTPS, or proxy */
  url: string;
  mediaType: string;
  filename?: string;
}

export interface CitationPart {
  type: 'citation';
  entityType: string;
  entityId: string;
  entityName: string;
  toolName: string;
}

export interface CanvasActionPart {
  type: 'canvas-action';
  action: 'open' | 'update';
  artifactId: string;
  title: string;
  contentType: string;
  content?: string;
  language?: string;
  version?: number;
}

export interface CanvasComponentPart {
  type: 'canvas-component';
  component: string;
  props: Record<string, unknown>;
  toolCallId?: string;
  toolName?: string;
}

export interface McpAppPart {
  type: 'mcp-app';
  toolCallId: string;
  toolName: string;
  resourceUri: string;
  part: unknown;
}

export type SSEEvent =
  | { type: 'text-delta'; delta: string }
  | { type: 'reasoning-delta'; delta: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown; thoughtSignature?: string }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: 'usage'; inputTokens: number; outputTokens: number; step: number }
  | { type: 'citation'; entityType: string; entityId: string; entityName: string; toolName: string }
  | { type: 'canvas-action'; action: 'open' | 'update'; artifactId: string; title: string; contentType: string; content?: string; language?: string; version?: number }
  | { type: 'canvas-component'; component: string; props: Record<string, unknown>; toolCallId?: string; toolName?: string }
  | { type: 'mcp-app'; toolCallId: string; toolName: string; resourceUri: string; part: unknown }
  | { type: 'metadata'; key: string; value: unknown }
  | { type: 'error'; message: string; code?: string }
  | { type: 'step-start'; step: number; model: string }
  | { type: 'step-end'; step: number; durationMs: number; usage: { inputTokens: number; outputTokens: number } }
  | { type: 'finish'; messageId: string; totalUsage: { inputTokens: number; outputTokens: number }; durationMs: number };

export type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

export interface CanvasArtifact {
  id: string;
  title: string;
  contentType: string;
  content: string;
  language?: string;
  version: number;
  mcpApp?: {
    part: unknown;
    resourceUri: string;
  };
}
