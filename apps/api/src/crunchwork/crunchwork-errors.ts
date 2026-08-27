/**
 * Crunchwork often returns HTTP 500 for application/business-rule failures
 * (plain-text body). Those must not be retried as if the service were down.
 */
export function isRetryableCrunchworkFailure(params: {
  status?: number;
  body?: string;
}): boolean {
  const status = params.status;
  if (status === 429) return true;
  if (!status || status < 500) return false;

  const text = (params.body ?? '').trim();
  if (!text) return true;
  if (/^</.test(text) || /<!doctype/i.test(text)) return true;
  return false;
}
