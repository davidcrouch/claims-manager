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
import { EnsureUserContactDto } from './ensure-user-contact.dto';
import { ContactsService } from '../contacts/contacts.service';

const LOG = 'InternalController';

@Controller('internal')
@UseGuards(InternalTokenGuard)
@Public()
export class InternalController {
  private readonly logger = new Logger(LOG);

  constructor(
    private readonly internalService: InternalService,
    private readonly contactsService: ContactsService,
  ) {}

  /**
   * Seed a newly provisioned tenant. Intended to be called by auth-server
   * immediately after a new organization is created on signup.
   *
   * Always runs catalog-dev, MCP, and lookups when enabled. When the
   * tenant is Ensure Construction, also upserts the Crunchwork staging
   * connection.
   *
   * Awaits completion before responding so Cloud Run keeps CPU allocated
   * for the whole seed (request-based CPU throttles fire-and-forget work).
   * Auth-server still treats this as best-effort / non-blocking for signup.
   *
   * If `SEED_NEW_TENANTS` is not enabled, returns 202 with status
   * `disabled` — lets the caller (and ops) see the toggle state without
   * needing extra probes.
   */
  @Post('seed-tenant')
  @HttpCode(HttpStatus.ACCEPTED)
  async seedTenant(@Body() dto: SeedTenantDto): Promise<{
    status: SeedTenantOutcome['status'];
    tenantId: string;
  }> {
    const fn = 'seedTenant';
    this.logger.log(`[${LOG}.${fn}] request tenantId=${dto.tenantId}`);

    if (!this.internalService.isSeedTenantsEnabled()) {
      this.logger.warn(
        `[${LOG}.${fn}] SEED_NEW_TENANTS is not enabled — skipping tenantId=${dto.tenantId}`,
      );
      return { status: 'disabled', tenantId: dto.tenantId };
    }

    try {
      const outcome = await this.internalService.seedTenant({
        tenantId: dto.tenantId,
      });
      this.logger.log(
        `[${LOG}.${fn}] completed tenantId=${dto.tenantId} status=${outcome.status}`,
      );
      return { status: outcome.status, tenantId: dto.tenantId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${LOG}.${fn}] seed failed tenantId=${dto.tenantId} error=${message}`,
      );
      // Still 202 — signup must not fail because of a seed hiccup.
      return { status: 'seeded', tenantId: dto.tenantId };
    }
  }

  /**
   * Ensure a contacts row exists for a user after signup / invite accept.
   * Best-effort: never fails the auth-server caller hard — returns 202.
   */
  @Post('ensure-user-contact')
  @HttpCode(HttpStatus.ACCEPTED)
  async ensureUserContact(@Body() dto: EnsureUserContactDto): Promise<{
    status: 'ok' | 'error';
    contactId?: string;
  }> {
    const fn = 'ensureUserContact';
    this.logger.log(
      `[${LOG}.${fn}] tenantId=${dto.tenantId} email=${dto.email}`,
    );
    try {
      const contact = await this.contactsService.ensureFromPerson({
        tenantId: dto.tenantId,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        name: dto.name,
      });
      return { status: 'ok', contactId: contact.id };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${LOG}.${fn}] failed tenantId=${dto.tenantId} error=${message}`,
      );
      return { status: 'error' };
    }
  }
}
