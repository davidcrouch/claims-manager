/**
 * InternalService
 *
 * Implements the business logic behind `/internal/*` endpoints. Kept
 * separate from the controller so both the HTTP path and any future
 * callers (e.g. an event consumer) can reuse it.
 *
 * Primary responsibility: demand-seed a newly-provisioned tenant.
 * Always runs catalog-dev, MCP, and lookups. When the tenant is
 * Ensure Construction, also upserts the Crunchwork staging connection.
 * Document template uploads are handled by first-login provisioning (ProvisioningService).
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import type { SeedResult } from '../../database/seeds/lib/runner';
import { seedCatalogDevForTenant } from '../../database/seeds/entries/catalog-dev.seed';
import { seedMcpForTenant } from '../../database/seeds/entries/mcp.seed';
import { seedLookupsForTenant } from '../../database/seeds/entries/lookups.seed';
import {
  isEnsureConstructionOrg,
  seedCrunchworkStagingConnection,
} from '../../database/seeds/entries/ensure-construction.seed';

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
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      this.logger.warn(`[${LOG}.${fn}] tenant not found tenantId=${tenantId}`);
      return { status: 'not-found', tenantId };
    }

    const attachCrunchwork = isEnsureConstructionOrg({
      name: org.name,
      slug: org.slug,
    });
    this.logger.log(
      `[${LOG}.${fn}] starting seed tenantId=${tenantId} name="${org.name}" crunchwork=${attachCrunchwork}`,
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

      const lookupsResult = await seedLookupsForTenant({
        db: this.db,
        tenantId,
        logger,
      });

      let connectionInserted = 0;
      let connectionSkipped = 0;
      if (attachCrunchwork) {
        const conn = await seedCrunchworkStagingConnection({
          db: this.db,
          tenantId,
          logger,
        });
        connectionInserted = conn.inserted;
        connectionSkipped = conn.skipped;
      }

      const result: SeedResult = {
        inserted:
          catalogResult.inserted +
          mcpResult.inserted +
          lookupsResult.inserted +
          connectionInserted,
        updated:
          catalogResult.updated +
          mcpResult.updated +
          lookupsResult.updated,
        skipped:
          catalogResult.skipped +
          mcpResult.skipped +
          lookupsResult.skipped +
          connectionSkipped,
        notes: `tenant=${tenantId}; catalog; mcp; lookups${attachCrunchwork ? '; crunchwork-staging' : ''}`,
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
