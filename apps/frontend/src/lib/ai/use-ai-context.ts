'use client';

import { useMemo } from 'react';
import type { ChatMessage } from './chat-types';

export interface AIContextPayload {
  scope: string;
  entityType?: string;
  entityIds: Record<string, string>;
  formState?: Record<string, unknown>;
  summary?: string;
}

export interface BuildAIContextOptions {
  entityType?: string;
  formState?: Record<string, unknown>;
  summary?: string;
}

export function buildAIContext(
  scope: string,
  entityIds: Record<string, string>,
  options?: BuildAIContextOptions,
): AIContextPayload {
  const filteredIds = Object.fromEntries(
    Object.entries(entityIds).filter(([, value]) => value),
  );

  return {
    scope,
    entityType: options?.entityType,
    entityIds: filteredIds,
    formState: options?.formState,
    summary: options?.summary,
  };
}

export function useAIContext(
  scope: string,
  entityIds: Record<string, string>,
  formState?: Record<string, unknown>,
  options?: Omit<BuildAIContextOptions, 'formState'>,
): AIContextPayload {
  return useMemo(
    () =>
      buildAIContext(scope, entityIds, {
        ...options,
        formState,
      }),
    [scope, entityIds, formState, options?.entityType, options?.summary],
  );
}

export function formatAIContextSummary(context: AIContextPayload): string {
  const lines: string[] = [`Context scope: ${context.scope}`];

  if (context.entityType) {
    lines.push(`Entity type: ${context.entityType}`);
  }

  const ids = Object.entries(context.entityIds);
  if (ids.length > 0) {
    lines.push('Related entities:');
    for (const [key, value] of ids) {
      lines.push(`  - ${key}: ${value}`);
    }
  }

  if (context.formState && Object.keys(context.formState).length > 0) {
    lines.push('Current form state:');
    lines.push(JSON.stringify(context.formState, null, 2));
  }

  if (context.summary) {
    lines.push('', context.summary);
  }

  return lines.join('\n');
}

export function contextToInitialMessages(context: AIContextPayload): ChatMessage[] {
  return [
    {
      id: `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      role: 'system',
      parts: [{ type: 'text', text: formatAIContextSummary(context) }],
      createdAt: new Date().toISOString(),
      metadata: { aiContext: true, scope: context.scope },
    },
  ];
}
