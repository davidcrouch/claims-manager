import { Injectable, Logger } from '@nestjs/common';
import {
  JobsRepository,
  ExternalLinksRepository,
  ExternalObjectsRepository,
  type JobInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { ExternalObjectService } from '../external-object.service';
import { NestedEntityExtractor } from '../nested-entity-extractor.service';
import { LookupResolver } from '../lookup-resolver.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

@Injectable()
export class CrunchworkJobMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkJobMapper');

  constructor(
    private readonly jobsRepo: JobsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly externalObjectService: ExternalObjectService,
    private readonly nestedEntityExtractor: NestedEntityExtractor,
    private readonly lookupResolver: LookupResolver,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ internalEntityId: string; internalEntityType: string }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const tx = params.tx;

    this.logger.log(
      `CrunchworkJobMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'job',
    );

    if (existingLink) {
      await this.jobsRepo.update({
        id: existingLink.internalEntityId,
        data: {
          apiPayload: payload,
          externalReference: payload.id as string,
        },
        tx,
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
      tx,
    });

    if (!nested.claimId) {
      throw new Error(
        `CrunchworkJobMapper.map — cannot create job ${externalObjectId}: no claimId could be resolved from payload ` +
          `(payload.claim?.id is missing or the nested claim extractor returned nothing). ` +
          `Refusing to insert a job with an empty claim_id.`,
      );
    }

    if (!payload.id) {
      throw new Error(
        `CrunchworkJobMapper.map — cannot create job ${externalObjectId}: payload.id is missing; ` +
          `the fetched payload is likely not a job object (possible HTML/SPA response or wrong entity type).`,
      );
    }

    const jobTypeLookupId = await this.resolveJobTypeLookupId({
      payload,
      tenantId: params.tenantId,
      tx,
    });

    if (!jobTypeLookupId) {
      throw new Error(
        `CrunchworkJobMapper.map — cannot create job ${externalObjectId}: ` +
          `jobType.externalReference is missing from the payload and jobs.job_type_lookup_id is NOT NULL. ` +
          `Crunchwork payload must include a jobType object.`,
      );
    }

    const jobData: JobInsert = {
      tenantId: params.tenantId,
      claimId: nested.claimId,
      externalReference: payload.id as string,
      jobTypeLookupId,
      apiPayload: payload,
      vendorId: nested.vendorId,
    };

    const created = await this.jobsRepo.createIfNotExists({ data: jobData, tx });

    let jobId: string;
    if (created) {
      jobId = created.id;
    } else {
      const raced = await this.jobsRepo.findByExternalReference({
        tenantId: params.tenantId,
        externalReference: payload.id as string,
        tx,
      });
      if (!raced) {
        throw new Error(
          `CrunchworkJobMapper.map — insert skipped by onConflictDoNothing but no existing row found ` +
            `by externalReference=${payload.id as string} for tenant=${params.tenantId}.`,
        );
      }
      this.logger.warn(
        `CrunchworkJobMapper.map — lost race on job insert externalReference=${payload.id as string}; updating winner id=${raced.id}`,
      );
      await this.jobsRepo.update({
        id: raced.id,
        data: {
          claimId: nested.claimId,
          jobTypeLookupId,
          apiPayload: payload,
          vendorId: nested.vendorId,
        },
        tx,
      });
      jobId = raced.id;
    }

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'job',
        internalEntityId: jobId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return {
      internalEntityId: jobId,
      internalEntityType: 'job',
    };
  }

  private async resolveJobTypeLookupId(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const jobType = params.payload.jobType as
      | Record<string, unknown>
      | undefined;
    const externalReference = jobType?.externalReference as string | undefined;
    if (!externalReference) return null;

    const name = (jobType?.name as string | undefined) ?? externalReference;

    return this.lookupResolver.resolve({
      tenantId: params.tenantId,
      domain: 'job_type',
      externalReference,
      name,
      autoCreate: true,
      sourceEntity: 'job',
      tx: params.tx,
    });
  }
}
