export function validate(config: Record<string, unknown>) {
  if (!config.DATABASE_URL) {
    throw new Error('[provider.env.validation] DATABASE_URL is required');
  }
  if (!config.CREDENTIALS_ENCRYPTION_KEY) {
    throw new Error(
      '[provider.env.validation] CREDENTIALS_ENCRYPTION_KEY is required',
    );
  }
  return config;
}
