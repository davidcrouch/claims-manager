/**
 * auth-server local DB client – Drizzle + Postgres.
 * Uses DATABASE_URL (preferred). Fallback: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD, DB_SSL.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import { createLogger, LoggerType } from '../lib/logger.js';

const log = createLogger('auth-server:db:client', LoggerType.NODEJS);

export interface DatabaseConfig {
  connectionUrl: string;
}

function buildDatabaseUrl(): string {
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const ssl = (process.env.DB_SSL ?? 'false').toLowerCase() === 'true' || (process.env.DB_SSL ?? 'false').toLowerCase() === '1';
  if (host && port && database && user && password !== undefined) {
    const protocol = ssl ? 'postgres' : 'postgres';
    const sslMode = ssl ? 'sslmode=require' : 'sslmode=disable';
    return `${protocol}://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}?${sslMode}`;
  }
  throw new Error(
    'auth-server:db:client - Set DATABASE_URL or all of DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD'
  );
}

const EXPECTED_DATABASE_NAME = 'claims_manager';

/** Returns the database connection URL (from DATABASE_URL or built from DB_*). */
export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL ?? buildDatabaseUrl();
  if (!url || url.trim() === '') {
    throw new Error('auth-server:db:client - DATABASE_URL is not set and DB_* fallback is incomplete');
  }
  assertExpectedDatabase(url);
  return url;
}

/**
 * Fail fast if the resolved connection URL points at a database other than
 * the one this app is expected to share with the claims-manager API. Guards
 * against the auth-server silently reverting to a legacy platform database.
 */
function assertExpectedDatabase(connectionUrl: string): void {
  const match = connectionUrl.match(
    /^postgres(?:ql)?:\/\/[^@]+@[^/]+\/([^/?]+)/,
  );
  const actual = match?.[1];
  if (!actual) {
    throw new Error(
      'auth-server:db:client - unable to parse database name from connection URL.',
    );
  }
  if (actual !== EXPECTED_DATABASE_NAME) {
    throw new Error(
      `auth-server:db:client - connection URL points at database "${actual}" ` +
        `but this app requires "${EXPECTED_DATABASE_NAME}". Refusing to start.`,
    );
  }
}

export function loadDatabaseConfig(): DatabaseConfig {
  return {
    connectionUrl: getDatabaseUrl(),
  };
}

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const config = loadDatabaseConfig();
    _client = postgres(config.connectionUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 60,
      transform: { undefined: null },
    });
    _db = drizzle(_client, { schema });
    try {
      const url = new URL(config.connectionUrl.replace(/^postgres:\/\//, 'https://'));
      const dbName = url.pathname?.replace(/^\//, '').replace(/\?.*$/, '') || 'postgres';
      log.info({ host: url.hostname, database: dbName }, 'auth-server:db:client - DB client initialized');
    } catch {
      log.info('auth-server:db:client - DB client initialized');
    }
  }
  return _db;
}

/** For backwards compatibility: db is a getter that returns the Drizzle instance when called. */
export const db = getDb;

export type Db = ReturnType<typeof getDb>;
export type DbGetter = () => Db;
