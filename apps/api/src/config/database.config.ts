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

export default registerAs('database', () => {
  const rawUrl =
    process.env.DATABASE_URL || 'postgresql://localhost:5432/claims_manager';
  return {
    databaseUrl: buildDatabaseUrl(rawUrl),
  };
});
