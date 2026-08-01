import { registerAs } from '@nestjs/config';

function buildDatabaseUrl(rawUrl: string): string {
  try {
    const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
    if (!match) return rawUrl;

    const [, credentials, hostPart, path] = match;
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) return rawUrl;

    const user = credentials.slice(0, colonIndex);
    const password = credentials.slice(colonIndex + 1);
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostPart}${path ?? ''}`;
  } catch {
    return rawUrl;
  }
}

const EXPECTED_DATABASE_NAME = 'claims_manager';

function assertExpectedDatabase(rawUrl: string): void {
  const match = rawUrl.match(/^postgres(?:ql)?:\/\/[^@]+@[^/]+\/([^/?]+)/);
  const actual = match?.[1];
  if (!actual) {
    throw new Error(
      '[provider.database.config] Unable to parse database name from DATABASE_URL.',
    );
  }
  if (actual !== EXPECTED_DATABASE_NAME) {
    throw new Error(
      `[provider.database.config] DATABASE_URL points at "${actual}" but provider-server ` +
        `requires "${EXPECTED_DATABASE_NAME}". Refusing to start.`,
    );
  }
}

export default registerAs('database', () => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('[provider.database.config] DATABASE_URL is required.');
  }
  assertExpectedDatabase(rawUrl);
  return {
    databaseUrl: buildDatabaseUrl(rawUrl),
  };
});
