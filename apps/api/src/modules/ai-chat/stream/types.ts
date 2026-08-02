import type { TokenUsage } from '../providers/types';

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
  | { type: 'step-end'; step: number; durationMs: number; usage: TokenUsage }
  | { type: 'finish'; messageId: string; totalUsage: TokenUsage; durationMs: number };
