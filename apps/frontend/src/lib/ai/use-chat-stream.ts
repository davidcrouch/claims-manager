'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  ChatMessage,
  ChatPart,
  SSEEvent,
  ChatStatus,
  FilePart,
  CanvasArtifact,
  CanvasComponentPart,
} from './chat-types';
import { parseSSEStream } from './sse-parser';

export interface ToolResultEvent {
  toolCallId: string;
  toolName: string;
  result: unknown;
  isError?: boolean;
}

export interface CanvasComponentEvent {
  component: string;
  props: Record<string, unknown>;
  toolCallId?: string;
  toolName?: string;
}

export interface UseChatStreamOptions {
  api: string;
  initialMessages?: ChatMessage[];
  body?: () => Record<string, unknown>;
  onCanvasAction?: (artifact: CanvasArtifact) => void;
  onCanvasComponent?: (event: CanvasComponentEvent) => void;
  onMcpApp?: (mcpApp: {
    toolCallId: string;
    toolName: string;
    resourceUri: string;
    part: unknown;
  }) => void;
  onToolResult?: (event: ToolResultEvent) => void;
  onUsage?: (usage: { inputTokens: number; outputTokens: number; step: number }) => void;
  onFinish?: (data: {
    messageId: string;
    totalUsage: { inputTokens: number; outputTokens: number };
    durationMs: number;
  }) => void;
  onError?: (error: Error) => void;
  onResponseHeaders?: (headers: Headers) => void;
}

export interface UseChatStreamReturn {
  messages: ChatMessage[];
  sendMessage: (opts: { text: string; files?: FilePart[] }) => void;
  stop: () => void;
  status: ChatStatus;
  error: Error | null;
  setMessages: (msgs: ChatMessage[]) => void;
  injectMessage: (msg: ChatMessage) => void;
}

export function useChatStream(opts: UseChatStreamOptions): UseChatStreamReturn {
  const [messages, setMessages] = useState<ChatMessage[]>(opts.initialMessages ?? []);
  const [status, setStatus] = useState<ChatStatus>('ready');
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const incoming = opts.initialMessages;
    if (!incoming?.length) return;

    setMessages((current) => {
      if (current.length > 0) return current;
      return incoming;
    });
  }, [opts.initialMessages]);

  const messagesRef = useRef<ChatMessage[]>(opts.initialMessages ?? []);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const startStreamRef = useRef<(msgs: ChatMessage[], o: UseChatStreamOptions) => void>(() => {});

  const sendMessage = useCallback((input: { text: string; files?: FilePart[] }) => {
    const currentOpts = optsRef.current;
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      parts: buildUserParts(input.text, input.files),
      createdAt: new Date().toISOString(),
    };

    const updatedMessages = [...messagesRef.current, userMessage];
    messagesRef.current = updatedMessages;
    setMessages(updatedMessages);
    setStatus('submitted');
    setError(null);

    startStreamRef.current(updatedMessages, currentOpts);
  }, []);

  const startStream = useCallback(async (
    currentMessages: ChatMessage[],
    currentOpts: UseChatStreamOptions,
  ) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      parts: [],
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const extraBody = currentOpts.body?.() ?? {};
      const serialisedMessages = currentMessages.map((m) => ({
        id: m.id,
        role: m.role,
        parts: m.parts,
        createdAt: m.createdAt,
      }));

      const response = await fetch(currentOpts.api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: serialisedMessages,
          ...extraBody,
        }),
        signal: controller.signal,
      });

      currentOpts.onResponseHeaders?.(response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Chat request failed (${response.status}): ${errorText}`);
      }

      if (!response.body) {
        throw new Error('Response body is empty');
      }

      setStatus('streaming');

      const events = parseSSEStream(response.body);
      let streamError: Error | null = null;

      for await (const event of events) {
        if (controller.signal.aborted) break;

        setMessages((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx < 0 || updated[lastIdx].role !== 'assistant') return prev;

          const prevMsg = updated[lastIdx];
          const clonedParts = prevMsg.parts.map((p) => ({ ...p }));
          const msg: ChatMessage = { ...prevMsg, parts: clonedParts };
          updated[lastIdx] = msg;

          applyEvent(msg, event);
          return updated;
        });

        if (event.type === 'error') {
          streamError = new Error(event.message);
        }

        dispatchCallbacks(event, currentOpts);
      }

      if (streamError && !controller.signal.aborted) {
        setError(streamError);
        setStatus('error');
        currentOpts.onError?.(streamError);
      } else if (!controller.signal.aborted) {
        setStatus('ready');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setStatus('ready');
        return;
      }
      const streamErr = err instanceof Error ? err : new Error(String(err));
      setError(streamErr);
      setStatus('error');
      currentOpts.onError?.(streamErr);
    }
  }, []);

  startStreamRef.current = startStream;

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus('ready');
  }, []);

  const injectMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  return {
    messages,
    sendMessage,
    stop,
    status,
    error,
    setMessages,
    injectMessage,
  };
}

function buildUserParts(text: string, files?: FilePart[]): ChatPart[] {
  const parts: ChatPart[] = [];
  if (text) parts.push({ type: 'text', text });
  if (files) {
    for (const file of files) parts.push(file);
  }
  return parts;
}

function applyEvent(msg: ChatMessage, event: SSEEvent): void {
  switch (event.type) {
    case 'text-delta': {
      const lastPart = msg.parts[msg.parts.length - 1];
      if (lastPart && lastPart.type === 'text') {
        (lastPart as { type: 'text'; text: string }).text += event.delta;
      } else {
        msg.parts.push({ type: 'text', text: event.delta });
      }
      break;
    }

    case 'reasoning-delta': {
      const lastPart = msg.parts[msg.parts.length - 1];
      if (lastPart && lastPart.type === 'reasoning') {
        (lastPart as { type: 'reasoning'; text: string }).text += event.delta;
      } else {
        msg.parts.push({ type: 'reasoning', text: event.delta });
      }
      break;
    }

    case 'tool-call': {
      msg.parts.push({
        type: 'tool-call',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        args: event.args,
        state: 'pending',
        thoughtSignature: event.thoughtSignature,
      });
      break;
    }

    case 'tool-result': {
      const callPart = msg.parts.find(
        (p): p is import('./chat-types').ToolCallPart =>
          p.type === 'tool-call' && p.toolCallId === event.toolCallId,
      );
      if (callPart) {
        callPart.state = event.isError ? 'error' : 'complete';
      }
      msg.parts.push({
        type: 'tool-result',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      });
      break;
    }

    case 'canvas-action': {
      msg.parts.push({
        type: 'canvas-action',
        action: event.action,
        artifactId: event.artifactId,
        title: event.title,
        contentType: event.contentType,
        content: event.content,
        language: event.language,
        version: event.version,
      });
      break;
    }

    case 'canvas-component': {
      msg.parts.push({
        type: 'canvas-component',
        component: event.component,
        props: event.props,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });
      break;
    }

    case 'mcp-app': {
      msg.parts.push({
        type: 'mcp-app',
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        resourceUri: event.resourceUri,
        part: event.part,
      });
      break;
    }

    case 'citation': {
      msg.parts.push({
        type: 'citation',
        entityType: event.entityType,
        entityId: event.entityId,
        entityName: event.entityName,
        toolName: event.toolName,
      });
      break;
    }

    case 'finish': {
      msg.id = event.messageId;
      break;
    }

    case 'error': {
      msg.metadata = { ...msg.metadata, error: true, errorMessage: event.message };
      msg.parts.push({ type: 'text', text: event.message });
      break;
    }
  }
}

function dispatchCallbacks(event: SSEEvent, opts: UseChatStreamOptions): void {
  switch (event.type) {
    case 'tool-result': {
      opts.onToolResult?.({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        result: event.result,
        isError: event.isError,
      });
      break;
    }

    case 'canvas-action': {
      opts.onCanvasAction?.({
        id: event.artifactId,
        title: event.title,
        contentType: event.contentType,
        content: event.content ?? '',
        language: event.language,
        version: event.version ?? 1,
      });
      break;
    }

    case 'canvas-component': {
      opts.onCanvasComponent?.({
        component: event.component,
        props: event.props,
        toolCallId: event.toolCallId,
        toolName: event.toolName,
      });
      break;
    }

    case 'mcp-app': {
      opts.onMcpApp?.({
        toolCallId: event.toolCallId,
        toolName: event.toolName,
        resourceUri: event.resourceUri,
        part: event.part,
      });
      break;
    }

    case 'usage': {
      opts.onUsage?.({
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        step: event.step,
      });
      break;
    }

    case 'finish': {
      opts.onFinish?.({
        messageId: event.messageId,
        totalUsage: event.totalUsage,
        durationMs: event.durationMs,
      });
      break;
    }

    case 'error': {
      opts.onError?.(new Error(event.message));
      break;
    }
  }
}

export type { CanvasComponentPart };
