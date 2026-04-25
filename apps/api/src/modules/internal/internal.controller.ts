/**
 * InternalController
 *
 * Service-to-service surface protected by a shared-secret header
 * (`x-internal-token`). Only auth-server is expected to call these
 * routes. Never expose publicly; Caddy does not route `/internal/*` by
 * default, and the compose stack only exposes api-server on the internal
 * network.
 *
 * The prefix is `/api/v1/internal` (the global API prefix applies).
 */
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { InternalTokenGuard } from './internal-token.guard';
import { InternalService, type SeedTenantOutcome } from './internal.service';
import { SeedTenantDto } from './seed-tenant.dto';

const LOG = 'InternalController';

@Controller('internal')
@UseGuards(InternalTokenGuard)
@Public()
export class InternalController {
  private readonly logger = new Logger(LOG);

  constructor(private readonly internalService: InternalService) {}

  /**
   * Seed sample data for a tenant. Intended to be called by auth-server
   * immediately after a new organization is provisioned on signup.
   *
   * Fire-and-forget semantics: returns 202 as soon as the work is
   * dispatched. Failures are logged server-side, not returned to the
   * caller — signup must never fail because of a seed hiccup.
   *
   * If `SEED_NEW_TENANTS` is not enabled, returns 202 with status
   * `disabled` — lets the caller (and ops) see the toggle state without
   * needing extra probes.
   */
  @Post('seed-tenant')
  @HttpCode(HttpStatus.ACCEPTED)
  seedTenant(@Body() dto: SeedTenantDto): {
    status: SeedTenantOutcome['status'];
    tenantId: string;
  } {
    const fn = 'seedTenant';
    this.logger.log(`[${LOG}.${fn}] request tenantId=${dto.tenantId}`);

    if (!this.internalService.isSeedTenantsEnabled()) {
      this.logger.warn(
        `[${LOG}.${fn}] SEED_NEW_TENANTS is not enabled — skipping tenantId=${dto.tenantId}`,
      );
      return { status: 'disabled', tenantId: dto.tenantId };
    }

    void this.internalService
      .seedTenant({ tenantId: dto.tenantId })
      .then((outcome) => {
        this.logger.log(
          `[${LOG}.${fn}] completed tenantId=${dto.tenantId} status=${outcome.status}`,
        );
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `[${LOG}.${fn}] background seed failed tenantId=${dto.tenantId} error=${message}`,
        );
      });

    return { status: 'seeded', tenantId: dto.tenantId };
  }
}
