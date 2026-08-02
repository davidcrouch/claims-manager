import type { SSEEvent } from './chat-types';

export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n\n');
      buffer = lines.pop() ?? '';

      for (const chunk of lines) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;

        for (const line of trimmed.split('\n')) {
          if (!line.startsWith('data: ')) continue;

          const json = line.slice(6);
          if (!json || json === '[DONE]') continue;

          try {
            const event = JSON.parse(json) as SSEEvent;
            yield event;
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.trim().split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6);
        if (!json || json === '[DONE]') continue;
        try {
          yield JSON.parse(json) as SSEEvent;
        } catch {
          // Skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
