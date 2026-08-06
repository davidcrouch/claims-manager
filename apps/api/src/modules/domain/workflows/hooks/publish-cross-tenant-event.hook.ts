import { Injectable, Logger } from '@nestjs/common';
import { OutboundSyncService } from '../../outbound/outbound-sync.service';
import { buildDomainEventEnvelope } from '../../../pubsub/envelope';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

const CROSS_TENANT_ENTITY_TYPES = new Set([
  'purchase_order',
  'work_order',
  'invoice',
  'bill',
  'quote',
  'proposal',
]);

@Injectable()
export class PublishCrossTenantEventHook implements OnEnterHook {
  name = 'publishCrossTenantEvent';
  private readonly logger = new Logger('PublishCrossTenantEventHook');

  constructor(private readonly outboundSync: OutboundSyncService) {}

  async execute(context: WorkflowContext): Promise<void> {
    const logPrefix = 'PublishCrossTenantEventHook.execute';

    if (!CROSS_TENANT_ENTITY_TYPES.has(context.entityType)) {
      return;
    }

    const entity = context.entity;
    const sourceTenantId = (entity.sourceTenantId as string) ?? undefined;
    const recipientTenantId = (entity.recipientOrganisationId as string) ?? undefined;

    if (!sourceTenantId && !recipientTenantId) {
      this.logger.debug(
        `${logPrefix} — no cross-tenant relationship on ${context.entityType}:${context.entityId}, skipping`,
      );
      return;
    }

    const eventType = `${context.entityType}.${context.action}`;
    const idempotencyKey = `${context.entityId}:${context.action}:${context.targetStep}`;

    const envelope = buildDomainEventEnvelope({
      eventType,
      entityType: context.entityType,
      entityId: context.entityId,
      tenantId: context.tenantId,
      sourceTenantId,
      targetTenantId: recipientTenantId,
      idempotencyKey,
      payload: {
        action: context.action,
        fromStep: context.currentStep,
        toStep: context.targetStep,
        entitySnapshot: {
          id: entity.id,
          status: entity.status,
          totalAmount: entity.totalAmount,
          name: entity.name,
        },
      },
    });

    this.logger.log(
      `${logPrefix} — queuing pubsub event=${eventType} entity=${context.entityId} target=${recipientTenantId ?? sourceTenantId}`,
    );

    await this.outboundSync.enqueuePubsub({
      tenantId: context.tenantId,
      entityType: context.entityType,
      entityId: context.entityId,
      action: context.action,
      payload: envelope as unknown as Record<string, unknown>,
      sourceEvent: eventType,
      idempotencyKey,
      tx: context.tx,
    });
  }
}
