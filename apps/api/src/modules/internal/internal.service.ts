/**
 * InternalService
 *
 * Implements the business logic behind `/internal/*` endpoints. Kept
 * separate from the controller so both the HTTP path and any future
 * callers (e.g. an event consumer) can reuse it.
 *
 * Primary responsibility: demand-seed sample data for a newly-provisioned
 * tenant. Wraps `seedSampleDataForTenant` from the seed framework and
 * guards it with tenant-existence + feature-flag checks.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import type { SeedResult } from '../../database/seeds/lib/runner';
import { seedSampleDataForTenant } from '../../database/seeds/entries/sample-data.seed';

const LOG = 'InternalService';

export type SeedTenantStatus = 'seeded' | 'disabled' | 'not-found';

export interface SeedTenantOutcome {
  status: SeedTenantStatus;
  tenantId: string;
  result?: SeedResult;
  error?: string;
}

@Injectable()
export class InternalService {
  private readonly logger = new Logger(LOG);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  isSeedTenantsEnabled(): boolean {
    const raw =
      this.config.get<string>('SEED_NEW_TENANTS') ??
      process.env.SEED_NEW_TENANTS ??
      '';
    return raw.trim().toLowerCase() === 'true';
  }

  async seedTenant(params: { tenantId: string }): Promise<SeedTenantOutcome> {
    const { tenantId } = params;
    const fn = 'seedTenant';

    if (!this.isSeedTenantsEnabled()) {
      this.logger.warn(
        `[${LOG}.${fn}] SEED_NEW_TENANTS is not enabled — refusing to seed tenantId=${tenantId}`,
      );
      return { status: 'disabled', tenantId };
    }

    const [org] = await this.db
      .select({ id: organizations.id, name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      this.logger.warn(`[${LOG}.${fn}] tenant not found tenantId=${tenantId}`);
      return { status: 'not-found', tenantId };
    }

    this.logger.log(
      `[${LOG}.${fn}] starting seed tenantId=${tenantId} name="${org.name}"`,
    );

    try {
      const result = await seedSampleDataForTenant({
        db: this.db,
        tenantId,
        logger: {
          info: (msg: string) => this.logger.log(`[${LOG}.${fn}] ${msg}`),
          warn: (msg: string) => this.logger.warn(`[${LOG}.${fn}] ${msg}`),
          error: (msg: string) => this.logger.error(`[${LOG}.${fn}] ${msg}`),
        },
      });

      this.logger.log(
        `[${LOG}.${fn}] done tenantId=${tenantId} inserted=${result.inserted} skipped=${result.skipped}`,
      );
      return { status: 'seeded', tenantId, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${LOG}.${fn}] failed tenantId=${tenantId} error=${message}`,
      );
      throw err;
    }
  }
}
