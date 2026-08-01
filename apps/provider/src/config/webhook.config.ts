import { registerAs } from '@nestjs/config';

function parseProcessingMode(
  value: string | undefined,
  fallback: 'more0' | 'none',
): 'more0' | 'none' {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'more0' || raw === 'none') return raw;
  return fallback;
}

export default registerAs('webhook', () => ({
  /** provider-server only supports more0 dispatch (or none / persist-only). */
  processingMode: parseProcessingMode(
    process.env.WEBHOOK_PROCESSING_MODE,
    'more0',
  ),
}));
