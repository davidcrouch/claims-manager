/**
 * Detect and retry transient upstream connection failures (e.g. Nest restart).
 * Uses Connection: close on retries to avoid sticky undici keep-alive sockets.
 */

const LOG = 'frontend:transient-network';

const TRANSIENT_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

const RETRY_DELAYS_MS = [200, 500] as const;

function collectErrorCodes(err: unknown, into: Set<string>, depth = 0): void {
  if (depth > 4 || err == null) return;
  if (typeof err === 'object') {
    const rec = err as { code?: unknown; cause?: unknown; errors?: unknown };
    if (typeof rec.code === 'string') into.add(rec.code);
    if (rec.cause) collectErrorCodes(rec.cause, into, depth + 1);
    if (Array.isArray(rec.errors)) {
      for (const nested of rec.errors) {
        collectErrorCodes(nested, into, depth + 1);
      }
    }
  }
}

export function isTransientNetworkError(err: unknown): boolean {
  if (err == null) return false;

  const codes = new Set<string>();
  collectErrorCodes(err, codes);
  for (const code of codes) {
    if (TRANSIENT_CODES.has(code)) return true;
  }

  const message = (
    err instanceof Error ? err.message : String(err)
  ).toLowerCase();
  if (
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('socket hang up') ||
    message.includes('other side closed')
  ) {
    return true;
  }

  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type FetchWithTransientRetryOptions = {
  /** Max attempts including the first try. Default 3 (1 + 2 retries). */
  maxAttempts?: number;
  logLabel?: string;
};

/**
 * fetch() with short backoff on transient connection errors.
 * After a connect failure, retries send Connection: close.
 */
export async function fetchWithTransientRetry(
  input: string | URL,
  init?: RequestInit,
  options?: FetchWithTransientRetryOptions,
): Promise<Response> {
  const maxAttempts = options?.maxAttempts ?? RETRY_DELAYS_MS.length + 1;
  const logLabel = options?.logLabel ?? LOG;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const headers = new Headers(init?.headers);
    if (attempt > 0) {
      headers.set('Connection', 'close');
    }

    try {
      return await fetch(input, {
        ...init,
        headers,
      });
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < maxAttempts - 1 && isTransientNetworkError(err);
      if (!canRetry) throw err;

      const delay = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)]!;
      console.warn(
        `${logLabel} — transient failure attempt=${attempt + 1}/${maxAttempts}, retry in ${delay}ms:`,
        err instanceof Error ? err.message : err,
      );
      await sleep(delay);
    }
  }

  throw lastError;
}
