import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { InternalTokenGuard } from './internal-token.guard';
import { InternalService, type SeedTenantOutcome } from './internal.service';
import { SeedTenantDto } from './seed-tenant.dto';
import { EnsureUserContactDto } from './ensure-user-contact.dto';
import { ProcessWebhookEventDto } from './process-webhook-event.dto';
import { ContactsService } from '../contacts/contacts.service';
import { WebhooksService } from '../webhooks/webhooks.service';

const LOG = 'InternalController';

@Controller('internal')
@UseGuards(InternalTokenGuard)
@Public()
export class InternalController {
  private readonly logger = new Logger(LOG);

  constructor(
    private readonly internalService: InternalService,
    private readonly contactsService: ContactsService,
    private readonly webhooksService: WebhooksService,
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
   * Process an inbound webhook event already persisted by provider-server.
   * Runs the api-server pipeline (inproc by default) so claims/jobs land
   * without depending on More0 being reachable.
   */
  @Post('webhooks/process-event')
  @HttpCode(HttpStatus.OK)
  async processWebhookEvent(@Body() dto: ProcessWebhookEventDto): Promise<{
    status: 'ok' | 'skipped' | 'error';
    eventId: string;
    reason?: string;
  }> {
    const fn = 'processWebhookEvent';
    this.logger.log(`[${LOG}.${fn}] eventId=${dto.eventId}`);

    const event = await this.webhooksService.webhookRepo.findById({
      id: dto.eventId,
    });
    if (!event) {
      throw new NotFoundException(`inbound webhook event ${dto.eventId} not found`);
    }

    if (!event.connectionId || !event.tenantId) {
      this.logger.warn(
        `[${LOG}.${fn}] eventId=${dto.eventId} missing connection/tenant — skipped`,
      );
      return {
        status: 'skipped',
        eventId: dto.eventId,
        reason: 'missing_connection',
      };
    }

    try {
      await this.webhooksService.processEventAsync({
        eventId: event.id,
        tenantId: event.tenantId,
        connectionId: event.connectionId,
        providerCode: event.providerCode ?? 'crunchwork',
        eventType: event.eventType,
        providerEntityId: event.payloadEntityId ?? '',
        eventTimestamp: event.eventTimestamp ?? undefined,
      });
      this.logger.log(`[${LOG}.${fn}] completed eventId=${dto.eventId}`);
      return { status: 'ok', eventId: dto.eventId };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${LOG}.${fn}] failed eventId=${dto.eventId} error=${message}`,
      );
      return { status: 'error', eventId: dto.eventId, reason: message };
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
