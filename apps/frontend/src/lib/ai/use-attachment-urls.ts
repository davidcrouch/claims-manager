'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ChatMessage, FilePart } from './chat-types';

const EMPTY_MESSAGES: ChatMessage[] = [];
const urlCache = new Map<string, string>();

function filePartUri(part: FilePart): string | undefined {
  if (part.uri?.startsWith('gs://')) return part.uri;
  if (part.url?.startsWith('gs://')) return part.url;
  return undefined;
}

function needsUrlRefresh(part: FilePart): boolean {
  const uri = filePartUri(part);
  if (!uri) return false;
  if (!part.url) return true;
  if (part.url.startsWith('gs://')) return true;
  if (part.url === uri) return true;
  return false;
}

async function resolveAttachmentUrl(uri: string): Promise<string> {
  const cached = urlCache.get(uri);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/chat/signed-url?uri=${encodeURIComponent(uri)}`);
    if (res.ok) {
      const data = (await res.json()) as { signedUrl?: string };
      if (data.signedUrl) {
        urlCache.set(uri, data.signedUrl);
        return data.signedUrl;
      }
    }
  } catch {
    // fall through
  }

  return uri;
}

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts.map((p) => ({ ...p })),
  }));
}

export function useAttachmentUrls(messages: ChatMessage[] | undefined | null): ChatMessage[] {
  const input = messages ?? EMPTY_MESSAGES;
  const [resolved, setResolved] = useState<ChatMessage[]>(input);

  const refreshKey = useMemo(
    () =>
      input
        .map(
          (m) =>
            `${m.id}:${m.parts
              .filter((p) => p.type === 'file')
              .map((p) => {
                const f = p as FilePart;
                const uri = filePartUri(f) ?? '';
                return `${uri}|${needsUrlRefresh(f)}`;
              })
              .join(',')}`,
        )
        .join(';'),
    [input],
  );

  useEffect(() => {
    if (input.length === 0) {
      setResolved((prev) => (prev.length === 0 ? prev : EMPTY_MESSAGES));
      return;
    }

    let cancelled = false;
    const next = cloneMessages(input);
    const refreshTasks: Promise<void>[] = [];

    for (const msg of next) {
      for (const part of msg.parts) {
        if (part.type !== 'file') continue;
        const filePart = part as FilePart;
        const uri = filePartUri(filePart);
        if (!uri || !needsUrlRefresh(filePart)) continue;

        refreshTasks.push(
          resolveAttachmentUrl(uri).then((url) => {
            filePart.uri = uri;
            filePart.url = url;
          }),
        );
      }
    }

    if (refreshTasks.length === 0) {
      setResolved(next);
      return;
    }

    void Promise.all(refreshTasks).then(() => {
      if (!cancelled) setResolved(next);
    });

    return () => {
      cancelled = true;
    };
  }, [refreshKey, input]);

  return resolved;
}
