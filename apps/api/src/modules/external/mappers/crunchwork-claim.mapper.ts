import { Injectable, Logger } from '@nestjs/common';
import {
  ClaimsRepository,
  ExternalLinksRepository,
  type ClaimInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';

@Injectable()
export class CrunchworkClaimMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkClaimMapper');

  constructor(
    private readonly claimsRepo: ClaimsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;

    this.logger.log(
      `CrunchworkClaimMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
    });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'claim');

    if (existingLink) {
      await this.claimsRepo.update({
        id: existingLink.internalEntityId,
        data: {
          apiPayload: payload,
          externalReference: payload.id as string,
          claimNumber: payload.claimNumber as string | undefined,
        },
      });

      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'claim',
      };
    }

    const claimData: ClaimInsert = {
      tenantId: params.tenantId,
      claimNumber: payload.claimNumber as string | undefined,
      externalReference: payload.id as string,
      apiPayload: payload,
    };

    const created = await this.claimsRepo.create({ data: claimData });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'claim',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });

    return {
      internalEntityId: created.id,
      internalEntityType: 'claim',
    };
  }
}
