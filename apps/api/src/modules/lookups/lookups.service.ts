import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';
import { LookupsRepository } from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { seedLookupsForTenant } from '../../database/seeds/entries/lookups.seed';
import { TenantContext } from '../../tenant/tenant-context';

const LOG = 'LookupsService';

@Injectable()
export class LookupsService {
  private readonly logger = new Logger(LOG);

  constructor(
    private readonly lookupsRepo: LookupsRepository,
    private readonly tenantContext: TenantContext,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async findByDomain(params: { domain: string; providerCode?: string }) {
    if (!this.tenantContext.hasTenant()) {
      return [];
    }
    const tenantId = this.tenantContext.getTenantId();
    const query = {
      tenantId,
      domain: params.domain,
      providerCode: params.providerCode,
    };
    let rows = await this.lookupsRepo.findByDomain(query);
    if (params.domain === 'group_label' && rows.length === 0) {
      this.logger.log(
        `${LOG}.findByDomain — no group labels for tenantId=${tenantId}, seeding`,
      );
      try {
        await seedLookupsForTenant({
          db: this.db,
          tenantId,
          logger: {
            info: (msg) => this.logger.log(`${LOG}.findByDomain ${msg}`),
            warn: (msg) => this.logger.warn(`${LOG}.findByDomain ${msg}`),
            error: (msg) => this.logger.error(`${LOG}.findByDomain ${msg}`),
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `${LOG}.findByDomain — group label seed failed tenantId=${tenantId}: ${message}`,
        );
      }
      rows = await this.lookupsRepo.findByDomain(query);
    }
    return rows;
  }

  async findOne(params: { id: string }) {
    if (!this.tenantContext.hasTenant()) {
      return null;
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findOne({ id: params.id, tenantId });
  }

  async ensureByName(params: { domain: string; name: string }) {
    if (!this.tenantContext.hasTenant()) {
      throw new BadRequestException('Tenant context required');
    }
    if (!params.domain?.trim() || !params.name?.trim()) {
      throw new BadRequestException('domain and name are required');
    }
    const tenantId = this.tenantContext.getTenantId();
    return this.lookupsRepo.findOrCreateByName({
      tenantId,
      domain: params.domain.trim(),
      name: params.name.trim(),
    });
  }
}
