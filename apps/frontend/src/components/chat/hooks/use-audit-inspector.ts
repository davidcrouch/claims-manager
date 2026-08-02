'use client';

import { useState, useCallback, useRef } from 'react';
import type { ChatMessage } from '@/lib/ai/chat-types';
import type { AiAuditRecord } from '@/lib/ai/types';
import { getConversationAuditAction } from '@/app/(app)/chat/actions';

export interface ToolCallDetail {
  toolName: string;
  displayName: string;
  args: Record<string, unknown>;
  result?: unknown;
  state: string;
}

function stripMcpPrefix(name: string): string {
  const dunderIdx = name.indexOf('__');
  if (name.startsWith('mcp_') && dunderIdx !== -1) {
    return name.slice(dunderIdx + 2);
  }
  return name;
}

function formatToolDisplayName(name: string): string {
  return stripMcpPrefix(name)
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function extractToolCallDetails(message: ChatMessage): ToolCallDetail[] {
  const details: ToolCallDetail[] = [];

  for (const part of message.parts) {
    if (part.type !== 'tool-call') continue;

    const matchedResult = message.parts.find(
      (p) => p.type === 'tool-result' && p.toolCallId === part.toolCallId,
    );
    const result =
      matchedResult && matchedResult.type === 'tool-result'
        ? matchedResult.result
        : part.state === 'error'
          ? { error: 'Tool call failed' }
          : undefined;

    details.push({
      toolName: part.toolName,
      displayName: formatToolDisplayName(part.toolName),
      args: (part.args ?? {}) as Record<string, unknown>,
      result,
      state: part.state,
    });
  }

  return details;
}

export function useAuditInspector() {
  const [auditRecords, setAuditRecords] = useState<AiAuditRecord[]>([]);
  const [auditDrawerOpen, setAuditDrawerOpen] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<AiAuditRecord | null>(null);
  const [selectedReasoning, setSelectedReasoning] = useState<string | undefined>();
  const [selectedToolCalls, setSelectedToolCalls] = useState<ToolCallDetail[]>([]);
  const auditFetchedRef = useRef(false);

  const fetchAuditRecords = useCallback(async (conversationId: string) => {
    try {
      const records = await getConversationAuditAction(conversationId);
      setAuditRecords(records);
      auditFetchedRef.current = true;
      return records;
    } catch {
      return auditRecords;
    }
  }, [auditRecords]);

  const inspectMessage = useCallback(async (
    messageId: string,
    conversationId: string | undefined,
    messages: ChatMessage[],
  ) => {
    let records = auditRecords;
    if (conversationId) {
      records = await fetchAuditRecords(conversationId);
    }

    const record = records.find((r) => r.messageId === messageId);
    if (record) {
      setSelectedAudit(record);
    } else {
      const assistantMessages = messages.filter((m) => m.role === 'assistant');
      const msgIndex = assistantMessages.findIndex((m) => m.id === messageId);
      const fallback = records[msgIndex] ?? records[records.length - 1] ?? null;
      setSelectedAudit(fallback);
    }

    const msg = messages.find((m) => m.id === messageId);
    if (msg) {
      const reasoningParts = msg.parts
        .filter((p): p is { type: 'reasoning'; text: string } => p.type === 'reasoning')
        .map((p) => p.text)
        .join('\n\n');
      setSelectedReasoning(reasoningParts || undefined);
      setSelectedToolCalls(extractToolCallDetails(msg));
    } else {
      setSelectedReasoning(undefined);
      setSelectedToolCalls([]);
    }

    setAuditDrawerOpen(true);
  }, [auditRecords, fetchAuditRecords]);

  const closeInspector = useCallback(() => {
    setAuditDrawerOpen(false);
  }, []);

  return {
    auditRecords,
    auditDrawerOpen,
    selectedAudit,
    selectedReasoning,
    selectedToolCalls,
    auditFetchedRef,
    setAuditRecords,
    setAuditDrawerOpen,
    inspectMessage,
    closeInspector,
    fetchAuditRecords,
  };
}
