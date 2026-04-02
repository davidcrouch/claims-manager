import { Injectable, Logger } from '@nestjs/common';
import {
  JobsRepository,
  ExternalLinksRepository,
  ExternalObjectsRepository,
  type JobInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';
import { NestedEntityExtractor } from '../nested-entity-extractor.service';

@Injectable()
export class CrunchworkJobMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkJobMapper');

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly externalObjectService: ExternalObjectService,
    private readonly nestedEntityExtractor: NestedEntityExtractor,
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
      `CrunchworkJobMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
    });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'job');

    if (existingLink) {
      await this.jobsRepo.update({
        id: existingLink.internalEntityId,
        data: {
          apiPayload: payload,
          externalReference: payload.id as string,
        },
      });

      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'job',
      };
    }

    const nested = await this.nestedEntityExtractor.extractFromJobPayload({
      jobPayload: payload,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
    });

    const jobData: JobInsert = {
      tenantId: params.tenantId,
      claimId: nested.claimId ?? '',
      externalReference: payload.id as string,
      jobTypeLookupId: '',
      apiPayload: payload,
      vendorId: nested.vendorId,
    };

    const created = await this.jobsRepo.create({ data: jobData });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });

    return {
      internalEntityId: created.id,
      internalEntityType: 'job',
    };
  }
}
