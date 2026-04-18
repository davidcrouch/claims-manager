import { registerAs } from '@nestjs/config';

/**
 * Builds a postgres URL with properly encoded user and password.
 * Handles special chars in password (e.g. #, @, :) that break standard URL parsing.
 */
function buildDatabaseUrl(rawUrl: string): string {
  try {
    const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
    if (!match) return rawUrl;

    const [, credentials, hostPart, path] = match;
    const colonIndex = credentials.indexOf(':');
    if (colonIndex === -1) return rawUrl;

    const user = credentials.slice(0, colonIndex);
    const password = credentials.slice(colonIndex + 1);
    const encodedUser = encodeURIComponent(user);
    const encodedPassword = encodeURIComponent(password);

    return `postgresql://${encodedUser}:${encodedPassword}@${hostPart}${path ?? ''}`;
  } catch {
    return rawUrl;
  }
}

const EXPECTED_DATABASE_NAME = 'claims_manager';

/**
 * Fail fast if DATABASE_URL points at a database other than the one this app
 * owns migrations for. Guards against accidental re-points to shared platform
 * databases (which previously caused tenant_id drift across services).
 */
function assertExpectedDatabase(rawUrl: string): void {
  const match = rawUrl.match(/^postgres(?:ql)?:\/\/[^@]+@[^/]+\/([^/?]+)/);
  const actual = match?.[1];
  if (!actual) {
    throw new Error(
      `[database.config] Unable to parse database name from DATABASE_URL.`,
    );
  }
  if (actual !== EXPECTED_DATABASE_NAME) {
    throw new Error(
      `[database.config] DATABASE_URL points at "${actual}" but this app ` +
        `requires "${EXPECTED_DATABASE_NAME}". Refusing to start.`,
    );
  }
}

export default registerAs('database', () => {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error('[database.config] DATABASE_URL is required.');
  }
  assertExpectedDatabase(rawUrl);
  return {
    databaseUrl: buildDatabaseUrl(rawUrl),
  };
});
