import type { SSEEvent } from './types';

const encoder = new TextEncoder();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function createSSEStream(
  events: AsyncIterable<SSEEvent>,
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of events) {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        const errorEvent: SSEEvent = {
          type: 'error',
          message: errorMessage(err),
        };
        const line = `data: ${JSON.stringify(errorEvent)}\n\n`;
        controller.enqueue(encoder.encode(line));
        controller.close();
      }
    },
  });
}
