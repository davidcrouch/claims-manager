/**
 * InternalService
 *
 * Implements the business logic behind `/internal/*` endpoints. Kept
 * separate from the controller so both the HTTP path and any future
 * callers (e.g. an event consumer) can reuse it.
 *
 * Primary responsibility: demand-seed a newly-provisioned tenant.
 * Runs catalog-dev (DB-only); sample-data gated by SEED_SAMPLE_DATA.
 * Document template uploads are handled by first-login provisioning (ProvisioningService).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import type { SeedResult } from '../../database/seeds/lib/runner';
import { seedSampleDataForTenant } from '../../database/seeds/entries/sample-data.seed';
import { seedCatalogDevForTenant } from '../../database/seeds/entries/catalog-dev.seed';
import { seedMcpForTenant } from '../../database/seeds/entries/mcp.seed';

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

  isSampleDataEnabled(): boolean {
    const raw =
      this.config.get<string>('SEED_SAMPLE_DATA') ??
      process.env.SEED_SAMPLE_DATA ??
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

    const includeSample = this.isSampleDataEnabled();
    this.logger.log(
      `[${LOG}.${fn}] starting seed tenantId=${tenantId} name="${org.name}" sampleData=${includeSample}`,
    );

    const logger = {
      info: (msg: string) => this.logger.log(`[${LOG}.${fn}] ${msg}`),
      warn: (msg: string) => this.logger.warn(`[${LOG}.${fn}] ${msg}`),
      error: (msg: string) => this.logger.error(`[${LOG}.${fn}] ${msg}`),
    };

    try {
      const catalogResult = await seedCatalogDevForTenant({
        db: this.db,
        tenantId,
        logger,
      });

      const mcpResult = await seedMcpForTenant({
        db: this.db,
        tenantId,
        logger,
      });

      let sampleResult: SeedResult | undefined;
      if (includeSample) {
        sampleResult = await seedSampleDataForTenant({
          db: this.db,
          tenantId,
          logger,
        });
      } else {
        this.logger.log(
          `[${LOG}.${fn}] SEED_SAMPLE_DATA is not enabled — skipping sample-data tenantId=${tenantId}`,
        );
      }

      const result: SeedResult = {
        inserted:
          catalogResult.inserted +
          mcpResult.inserted +
          (sampleResult?.inserted ?? 0),
        updated:
          catalogResult.updated +
          mcpResult.updated +
          (sampleResult?.updated ?? 0),
        skipped:
          catalogResult.skipped +
          mcpResult.skipped +
          (sampleResult?.skipped ?? 0),
        notes: `tenant=${tenantId}; catalog; mcp;${includeSample ? ' sample-data' : ' no-sample'}`,
      };

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
