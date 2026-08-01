/**
 * Feature catalogue + grant CRUD.
 * Uses Drizzle ORM via getDb().
 */

import { eq, and } from 'drizzle-orm';
import type { Db } from '../client.js';
import { features, featureGrants } from '../schema.js';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:feature-definitions', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'feature-definitions', 'FeatureDefinitions', 'auth-server');

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type GrantScope = 'organisation' | 'user';
export type Feature = typeof features.$inferSelect;
export type FeatureGrant = typeof featureGrants.$inferSelect;

// ---------------------------------------------------------------------------
// Feature catalogue
// ---------------------------------------------------------------------------

export async function listFeatures(db: Db): Promise<Feature[]> {
  log.debug({ functionName: 'listFeatures' }, 'auth-server:feature-definitions:listFeatures - Listing all features');
  return db.select().from(features).orderBy(features.featureKey);
}

export async function getFeatureById(db: Db, featureId: string): Promise<Feature | null> {
  log.debug({ functionName: 'getFeatureById', featureId }, 'auth-server:feature-definitions:getFeatureById - Getting feature');
  const [row] = await db.select().from(features).where(eq(features.id, featureId));
  return row ?? null;
}

export async function createFeature(
  db: Db,
  params: {
    featureKey: string;
    defaultEnabled?: boolean;
    label?: string;
    description?: string;
  },
): Promise<Feature> {
  log.info({ functionName: 'createFeature', featureKey: params.featureKey }, 'auth-server:feature-definitions:createFeature - Creating feature');
  const [row] = await db.insert(features).values(params).returning();
  return row;
}

export async function updateFeature(
  db: Db,
  featureId: string,
  params: Partial<{
    featureKey: string;
    defaultEnabled: boolean;
    label: string | null;
    description: string | null;
  }>,
): Promise<Feature | null> {
  log.info({ functionName: 'updateFeature', featureId }, 'auth-server:feature-definitions:updateFeature - Updating feature');
  const setValues: Record<string, unknown> = { ...params, updatedAt: new Date() };
  const [row] = await db
    .update(features)
    .set(setValues as any)
    .where(eq(features.id, featureId))
    .returning();
  return row ?? null;
}

export async function deleteFeature(db: Db, featureId: string): Promise<boolean> {
  log.info({ functionName: 'deleteFeature', featureId }, 'auth-server:feature-definitions:deleteFeature - Deleting feature');
  const result = await db.delete(features).where(eq(features.id, featureId)).returning({ id: features.id });
  return result.length > 0;
}

// ---------------------------------------------------------------------------
// Feature grants
// ---------------------------------------------------------------------------

export async function listGrants(
  db: Db,
  options?: { scope?: string; scopeId?: string },
): Promise<FeatureGrant[]> {
  log.debug({ functionName: 'listGrants', options }, 'auth-server:feature-definitions:listGrants - Listing grants');

  const conditions: ReturnType<typeof eq>[] = [];
  if (options?.scope) conditions.push(eq(featureGrants.scope, options.scope));
  if (options?.scopeId) conditions.push(eq(featureGrants.scopeId, options.scopeId));

  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  return db.select().from(featureGrants).where(where);
}

/**
 * Upsert a feature grant (insert or update on conflict).
 */
export async function setGrant(
  db: Db,
  params: {
    featureId: string;
    scope: string;
    scopeId: string;
    enabled: boolean;
  },
): Promise<FeatureGrant> {
  log.info(
    { functionName: 'setGrant', featureId: params.featureId, scope: params.scope, scopeId: params.scopeId },
    'auth-server:feature-definitions:setGrant - Upserting grant',
  );

  const [row] = await db
    .insert(featureGrants)
    .values(params)
    .onConflictDoUpdate({
      target: [featureGrants.featureId, featureGrants.scope, featureGrants.scopeId],
      set: { enabled: params.enabled },
    })
    .returning();
  return row;
}

export async function removeGrant(db: Db, grantId: string): Promise<boolean> {
  log.info({ functionName: 'removeGrant', grantId }, 'auth-server:feature-definitions:removeGrant - Removing grant');
  const result = await db.delete(featureGrants).where(eq(featureGrants.id, grantId)).returning({ id: featureGrants.id });
  return result.length > 0;
}
