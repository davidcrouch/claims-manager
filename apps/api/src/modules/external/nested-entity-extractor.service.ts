import { Injectable, Logger } from '@nestjs/common';
import {
  ClaimsRepository,
  VendorsRepository,
  ExternalObjectsRepository,
  ExternalLinksRepository,
  type ClaimInsert,
} from '../../database/repositories';
import { ExternalObjectService } from './external-object.service';

@Injectable()
export class NestedEntityExtractor {
  private readonly logger = new Logger('NestedEntityExtractor');

  constructor(
    private readonly claimsRepo: ClaimsRepository,
    private readonly vendorsRepo: VendorsRepository,
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
  ) {}

  async extractFromJobPayload(params: {
    jobPayload: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    sourceEventId?: string;
  }): Promise<{ claimId?: string; vendorId?: string }> {
    const result: { claimId?: string; vendorId?: string } = {};

    const cwClaim = params.jobPayload.claim as Record<string, unknown> | undefined;
    if (cwClaim?.id) {
      result.claimId = await this.resolveOrCreateClaim({
        cwClaim,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        sourceEventId: params.sourceEventId,
      });
    }

    const cwVendor = params.jobPayload.vendor as Record<string, unknown> | undefined;
    if (cwVendor?.id) {
      result.vendorId = await this.resolveOrCreateVendor({
        cwVendor,
        tenantId: params.tenantId,
      });
    }

    return result;
  }

  private async resolveOrCreateClaim(params: {
    cwClaim: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    sourceEventId?: string;
  }): Promise<string | undefined> {
    const cwClaimId = params.cwClaim.id as string;

    const existingId = await this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: cwClaimId,
      internalEntityType: 'claim',
    });

    if (existingId) {
      return existingId;
    }

    this.logger.debug(
      `NestedEntityExtractor.resolveOrCreateClaim — creating claim from nested data, cwClaimId=${cwClaimId}`,
    );

    const claimData: ClaimInsert = {
      tenantId: params.tenantId,
      claimNumber: params.cwClaim.claimNumber as string | undefined,
      externalReference: cwClaimId,
      apiPayload: params.cwClaim,
    };

    const created = await this.claimsRepo.create({ data: claimData });

    const { externalObject } = await this.externalObjectService.upsertFromFetch({
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      providerCode: 'crunchwork',
      providerEntityType: 'claim',
      providerEntityId: cwClaimId,
      normalizedEntityType: 'claim',
      payload: params.cwClaim,
      sourceEventId: params.sourceEventId,
    });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId: externalObject.id,
        internalEntityType: 'claim',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
    });

    return created.id;
  }

  private async resolveOrCreateVendor(params: {
    cwVendor: Record<string, unknown>;
    tenantId: string;
  }): Promise<string | undefined> {
    const extRef = params.cwVendor.id as string;

    const existing = await this.vendorsRepo.findOne({
      id: extRef,
      tenantId: params.tenantId,
    });

    if (existing) {
      return existing.id;
    }

    this.logger.debug(
      `NestedEntityExtractor.resolveOrCreateVendor — vendor not found by id=${extRef}, skipping create (vendor may arrive via separate event)`,
    );

    return undefined;
  }
}
