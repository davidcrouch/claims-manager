import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { organizations } from '../../../database/schema';
import type { EventHandler } from '../pubsub-subscriber.service';
import type { DomainEventEnvelope } from '../envelope';

@Injectable()
export class OrganisationEventHandler implements EventHandler {
  readonly entityType = 'organisation';
  readonly eventTypes = [
    'organisation.claim_approved',
    'organisation.identity_updated',
  ];

  private readonly logger = new Logger('OrganisationEventHandler');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(envelope: DomainEventEnvelope): Promise<void> {
    const logPrefix = 'OrganisationEventHandler.handle';
    const { eventType } = envelope;

    this.logger.log(
      `${logPrefix} — processing ${eventType} for entity=${envelope.entityId}`,
    );

    switch (eventType) {
      case 'organisation.claim_approved': {
        await this.handleClaimApproved(envelope);
        break;
      }
      case 'organisation.identity_updated': {
        await this.handleIdentityUpdated(envelope);
        break;
      }
      default:
        this.logger.debug(`${logPrefix} — unhandled eventType=${eventType}`);
    }
  }

  private async handleClaimApproved(envelope: DomainEventEnvelope) {
    const logPrefix = 'OrganisationEventHandler.handleClaimApproved';
    const { payload } = envelope;
    const ghostOrgId = payload.ghostOrganisationId as string | undefined;
    const claimingTenantId = payload.claimingTenantId as string | undefined;

    if (!ghostOrgId) {
      this.logger.warn(`${logPrefix} — missing ghostOrganisationId in payload`);
      return;
    }

    await this.db
      .update(organizations)
      .set({
        subscriptionStatus: 'claimed',
        modified: new Date().toISOString(),
      })
      .where(eq(organizations.id, ghostOrgId));

    this.logger.log(
      `${logPrefix} — marked ghost org=${ghostOrgId} as claimed by tenant=${claimingTenantId}`,
    );
  }

  private async handleIdentityUpdated(envelope: DomainEventEnvelope) {
    const logPrefix = 'OrganisationEventHandler.handleIdentityUpdated';
    const { payload, entityId } = envelope;
    const updates = payload.updates as Record<string, unknown> | undefined;

    if (!updates || Object.keys(updates).length === 0) {
      this.logger.debug(`${logPrefix} — no updates in payload for org=${entityId}`);
      return;
    }

    await this.db
      .update(organizations)
      .set({ ...updates, modified: new Date().toISOString() })
      .where(eq(organizations.id, entityId));

    this.logger.log(
      `${logPrefix} — updated org=${entityId} fields: ${Object.keys(updates).join(', ')}`,
    );
  }
}
