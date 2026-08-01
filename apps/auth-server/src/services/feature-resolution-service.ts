/**
 * Feature resolution service.
 * Hierarchy: platform default → organisation → user.
 * Uses raw postgres client (independent lifecycle).
 * 60-second in-memory catalogue cache.
 * Fail-closed: returns empty features on error in production.
 */

import postgres from 'postgres';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getDatabaseUrl } from '../db/client.js';

const baseLogger = createLogger('auth-server:feature-resolution', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'feature-resolution', 'FeatureResolution', 'auth-server');

const isProduction = process.env.NODE_ENV === 'production';

export interface ResolvedFeatures {
  features: string[];
}

interface CatalogueEntry {
  id: string;
  feature_key: string;
  default_enabled: boolean;
}

interface GrantRow {
  feature_id: string;
  scope: string;
  scope_id: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Catalogue cache (60 seconds)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000;
let _catalogueCache: CatalogueEntry[] | null = null;
let _catalogueCacheAt = 0;

export function clearFeatureCatalogueCache(): void {
  _catalogueCache = null;
  _catalogueCacheAt = 0;
}

// ---------------------------------------------------------------------------
// Postgres client
// ---------------------------------------------------------------------------

let _sql: ReturnType<typeof postgres> | null = null;

function getSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(getDatabaseUrl(), {
      max: 5,
      idle_timeout: 30,
      connect_timeout: 10,
      transform: { undefined: null },
    });
  }
  return _sql;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

async function fetchCatalogue(): Promise<CatalogueEntry[]> {
  const now = Date.now();
  if (_catalogueCache && now - _catalogueCacheAt < CACHE_TTL_MS) {
    return _catalogueCache;
  }
  const sql = getSql();
  const rows = await sql`SELECT id, feature_key, default_enabled FROM features`;
  _catalogueCache = rows as unknown as CatalogueEntry[];
  _catalogueCacheAt = now;
  return _catalogueCache;
}

async function fetchGrants(organizationId: string, userId: string): Promise<GrantRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT feature_id, scope, scope_id, enabled
    FROM feature_grants
    WHERE (scope = 'organisation' AND scope_id = ${organizationId})
       OR (scope = 'user' AND scope_id = ${userId})
  `;
  return rows as unknown as GrantRow[];
}

/**
 * Pure function: applies precedence (platform default → org → user).
 */
export function applyFeaturePrecedence(
  catalogue: CatalogueEntry[],
  grants: GrantRow[],
): string[] {
  const enabled = new Set<string>();

  // Start with platform defaults
  for (const f of catalogue) {
    if (f.default_enabled) {
      enabled.add(f.feature_key);
    }
  }

  // Build maps for quick lookup
  const featureIdToKey = new Map(catalogue.map((f) => [f.id, f.feature_key]));

  // Organisation-scoped grants override platform defaults
  for (const g of grants) {
    if (g.scope !== 'organisation') continue;
    const key = featureIdToKey.get(g.feature_id);
    if (!key) continue;
    if (g.enabled) {
      enabled.add(key);
    } else {
      enabled.delete(key);
    }
  }

  // User-scoped grants override everything
  for (const g of grants) {
    if (g.scope !== 'user') continue;
    const key = featureIdToKey.get(g.feature_id);
    if (!key) continue;
    if (g.enabled) {
      enabled.add(key);
    } else {
      enabled.delete(key);
    }
  }

  return Array.from(enabled).sort();
}

/**
 * Resolve enabled feature keys for a user within an organization.
 */
export async function resolveFeatures(params: {
  organizationId: string;
  userId: string;
}): Promise<ResolvedFeatures> {
  try {
    const catalogue = await fetchCatalogue();
    const grants = await fetchGrants(params.organizationId, params.userId);
    const resolved = applyFeaturePrecedence(catalogue, grants);

    log.debug(
      { functionName: 'resolveFeatures', userId: params.userId, organizationId: params.organizationId, count: resolved.length },
      'auth-server:feature-resolution:resolveFeatures - Resolved features',
    );

    return { features: resolved };
  } catch (err: any) {
    if (isProduction) {
      log.error(
        { functionName: 'resolveFeatures', error: err.message },
        'auth-server:feature-resolution:resolveFeatures - Failed, returning empty (fail-closed)',
      );
    } else {
      log.warn(
        { functionName: 'resolveFeatures', error: err.message },
        'auth-server:feature-resolution:resolveFeatures - Failed, returning empty',
      );
    }
    return { features: [] };
  }
}
