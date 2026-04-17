import { registerAs } from '@nestjs/config';

function parseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseInt32(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntList(
  value: string | undefined,
  fallback: readonly number[],
): readonly number[] {
  if (!value) return fallback;
  const parts = value
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return parts.length > 0 ? parts : fallback;
}

export default registerAs('webhook', () => ({
  inProcMappingEnabled: parseBool(
    process.env.WEBHOOK_INPROC_MAPPING_ENABLED,
    true,
  ),
  /**
   * Backoff schedule (ms) for retrying in-process projections that failed
   * because a parent entity had not been projected yet. One delay per
   * attempt; when the list is exhausted the event is marked failed.
   * Default: 1s → 5s → 30s → 2m → 5m.
   */
  parentRetryBackoffMs: parseIntList(
    process.env.WEBHOOK_PARENT_RETRY_BACKOFF_MS,
    [1_000, 5_000, 30_000, 120_000, 300_000],
  ),
  /**
   * When true, on a ParentNotProjectedError the orchestrator first tries an
   * inline fetch-and-project of the parent before scheduling a deferred
   * retry. Recommended — it typically avoids the retry entirely.
   */
  parentInlineRecoveryEnabled: parseBool(
    process.env.WEBHOOK_PARENT_INLINE_RECOVERY_ENABLED,
    true,
  ),
  maxParentRetryAttempts: parseInt32(
    process.env.WEBHOOK_MAX_PARENT_RETRY_ATTEMPTS,
    5,
  ),
}));
