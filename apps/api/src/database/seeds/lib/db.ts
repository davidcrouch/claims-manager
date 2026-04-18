/**
 * Shared DB connection helper for seed + flush scripts.
 * Handles DATABASE_URL parsing (incl. credential URL-encoding) and returns
 * a drizzle instance bound to the full app schema, plus the underlying pg.Pool
 * so the caller can close it when done.
 */
import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../schema';

export type SeedDb = ReturnType<typeof drizzle<typeof schema>>;

export interface DbHandle {
  db: SeedDb;
  pool: Pool;
  url: string;
}

/**
 * Re-encode user:password in a postgres URL so that special characters
 * (e.g. '#', '@') don't break parsing. If the URL is already valid or
 * can't be parsed, returns it unchanged.
 */
function buildDatabaseUrl(rawUrl: string): string {
  const match = rawUrl.match(/^postgres(?:ql)?:\/\/([^@]+)@([^/]+)(\/.*)?$/);
  if (!match) return rawUrl;
  const [, credentials, hostPart, path] = match;
  const colonIndex = credentials.indexOf(':');
  if (colonIndex === -1) return rawUrl;
  const user = credentials.slice(0, colonIndex);
  const password = credentials.slice(colonIndex + 1);
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
    password,
  )}@${hostPart}${path ?? ''}`;
}

function resolveDatabaseUrl(): string {
  const explicit = process.env.DATABASE_URL;
  if (explicit && explicit.trim() !== '') return buildDatabaseUrl(explicit);

  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  if (host && port && database && user && password !== undefined) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
      password,
    )}@${host}:${port}/${database}`;
  }
  throw new Error(
    '[seeds/lib/db.resolveDatabaseUrl] DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD) must be set',
  );
}

/** Parse a postgres URL and return the hostname (for safety checks). */
export function getDbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function openDb(): DbHandle {
  const url = resolveDatabaseUrl();
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema });
  return { db, pool, url };
}
