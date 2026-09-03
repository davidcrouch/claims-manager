import type { ProviderMessage, ProviderContent } from '../providers/types';

interface ChatMessagePart {
  type: string;
  text?: string;
  toolCallId?: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
  output?: unknown;
  result?: unknown;
  state?: string;
  url?: string;
  mediaType?: string;
  filename?: string;
  data?: string;
  mimeType?: string;
  thoughtSignature?: string;
  thought_signature?: string;
  isError?: boolean;
  [key: string]: unknown;
}

interface ChatMessage {
  id: string;
  role: string;
  parts: ChatMessagePart[];
  content?: string;
}

export function toProviderMessages(messages: ChatMessage[]): ProviderMessage[] {
  const result: ProviderMessage[] = [];

  for (const msg of messages) {
    const role = normalizeRole(msg.role);
    if (role === 'system') continue;

    const content = convertParts(msg);
    if (content.length > 0) {
      result.push({ role, content });
    }
  }

  return result;
}

function normalizeRole(role: string): 'user' | 'assistant' | 'system' {
  switch (role) {
    case 'user':
      return 'user';
    case 'assistant':
      return 'assistant';
    case 'system':
      return 'system';
    default:
      return 'user';
  }
}

function convertParts(msg: ChatMessage): ProviderContent[] {
  const parts: ProviderContent[] = [];

  if (msg.parts && msg.parts.length > 0) {
    for (const part of msg.parts) {
      const converted = convertPart(part, msg.role);
      if (converted) parts.push(converted);
    }
  } else if (msg.content && typeof msg.content === 'string') {
    parts.push({ type: 'text', text: msg.content });
  }

  return parts;
}

function convertPart(part: ChatMessagePart, role: string): ProviderContent | null {
  switch (part.type) {
    case 'text':
      if (part.text) {
        return { type: 'text', text: part.text };
      }
      return null;

    case 'reasoning':
      if (part.text) {
        return { type: 'reasoning', text: part.text };
      }
      return null;

    case 'file': {
      const mimeType = part.mediaType ?? part.mimeType ?? 'application/octet-stream';
      if (part.data && typeof part.data === 'string') {
        return { type: 'file', mimeType, data: part.data };
      }
      const url = part.url ?? part.data;
      if (url && typeof url === 'string' && url.startsWith('data:')) {
        const base64 = url.split(',')[1];
        if (base64) {
          return { type: 'file', mimeType, data: base64 };
        }
      }
      return null;
    }

    default: {
      if (part.type.startsWith('tool-') || part.type === 'dynamic-tool') {
        return convertToolPart(part, role);
      }
      return null;
    }
  }
}

function convertToolPart(part: ChatMessagePart, role: string): ProviderContent | null {
  const isExplicitToolCall = part.type === 'tool-call';
  const isExplicitToolResult = part.type === 'tool-result';

  const toolName =
    part.type === 'dynamic-tool' || isExplicitToolCall || isExplicitToolResult
      ? (part.toolName as string | undefined)
      : part.type.replace(/^tool-/, '');

  if (!toolName) return null;

  const callId = (part.toolCallId as string) ?? `call_${toolName}`;

  const isResult =
    isExplicitToolResult ||
    (!isExplicitToolCall && (
      part.state === 'output-available' ||
      part.state === 'result' ||
      part.state === 'complete' ||
      part.state === 'error'
    )) ||
    (role === 'user' && !isExplicitToolCall);

  if (!isResult && (role === 'assistant' || isExplicitToolCall)) {
    const args = (part.args ?? part.input ?? {}) as Record<string, unknown>;
    const thoughtSignature =
      typeof part.thoughtSignature === 'string' && part.thoughtSignature.length > 0
        ? part.thoughtSignature
        : typeof part.thought_signature === 'string' &&
            (part.thought_signature as string).length > 0
          ? (part.thought_signature as string)
          : undefined;
    return {
      type: 'tool-call',
      id: callId,
      name: toolName,
      args,
      thoughtSignature,
    };
  }

  if (isResult) {
    return {
      type: 'tool-result',
      toolCallId: callId,
      name: toolName,
      result: part.output ?? part.result ?? {},
      isError: part.state === 'error' || part.isError === true || undefined,
    };
  }

  return null;
}
