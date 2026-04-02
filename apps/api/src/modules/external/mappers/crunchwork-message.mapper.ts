import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../../../database/drizzle.module';
import type { DrizzleDB } from '../../../database/drizzle.module';
import { messages } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';

@Injectable()
export class CrunchworkMessageMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkMessageMapper');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;

    this.logger.log(`CrunchworkMessageMapper.map — externalObjectId=${externalObjectId}`);

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'message');

    const fromJobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: (payload.fromJob as Record<string, unknown>)?.id as string,
      internalEntityType: 'job',
    });

    const toJobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: (payload.toJob as Record<string, unknown>)?.id as string,
      internalEntityType: 'job',
    });

    const fromClaimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: (payload.fromClaim as Record<string, unknown>)?.id as string,
      internalEntityType: 'claim',
    });

    const toClaimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: (payload.toClaim as Record<string, unknown>)?.id as string,
      internalEntityType: 'claim',
    });

    const messageData = {
      tenantId: params.tenantId,
      subject: payload.subject as string ?? undefined,
      body: payload.body as string ?? undefined,
      fromJobId: fromJobId ?? undefined,
      toJobId: toJobId ?? undefined,
      fromClaimId: fromClaimId ?? undefined,
      toClaimId: toClaimId ?? undefined,
      acknowledgementRequired: (payload.acknowledgementRequired as boolean) ?? false,
      messagePayload: payload,
      updatedAt: new Date(),
    };

    if (existingLink) {
      await this.db
        .update(messages)
        .set(messageData)
        .where(eq(messages.id, existingLink.internalEntityId));
      return { internalEntityId: existingLink.internalEntityId, internalEntityType: 'message' };
    }

    const [created] = await this.db
      .insert(messages)
      .values({ ...messageData, createdAt: new Date() })
      .returning();

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'message',
        internalEntityId: created!.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });

    return { internalEntityId: created!.id, internalEntityType: 'message' };
  }

  private async resolveFK(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string | undefined;
    internalEntityType: string;
  }): Promise<string | null> {
    if (!params.providerEntityId) return null;
    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      internalEntityType: params.internalEntityType,
    });
  }
}
