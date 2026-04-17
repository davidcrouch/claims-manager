import { Injectable, Logger } from '@nestjs/common';
import { VendorsRepository } from '../../database/repositories';
import { ExternalObjectService } from './external-object.service';
import { CrunchworkClaimMapper } from './mappers/crunchwork-claim.mapper';
import type { DrizzleDbOrTx } from '../../database/drizzle.module';

@Injectable()
export class NestedEntityExtractor {
  private readonly logger = new Logger('NestedEntityExtractor');

  constructor(
    private readonly vendorsRepo: VendorsRepository,
    private readonly externalObjectService: ExternalObjectService,
    private readonly claimMapper: CrunchworkClaimMapper,
  ) {}

  async extractFromJobPayload(params: {
    jobPayload: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    sourceEventId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{ claimId?: string; vendorId?: string }> {
    const result: { claimId?: string; vendorId?: string } = {};

    const { cwClaimId, nestedClaim } = this.extractClaim(params.jobPayload);
    if (cwClaimId) {
      result.claimId = await this.projectNestedClaim({
        cwClaimId,
        nestedClaim,
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        sourceEventId: params.sourceEventId,
        tx: params.tx,
      });
    }

    const cwVendor = params.jobPayload.vendor as
      | Record<string, unknown>
      | undefined;
    if (cwVendor?.id) {
      result.vendorId = await this.resolveOrCreateVendor({
        cwVendor,
        tenantId: params.tenantId,
      });
    }

    return result;
  }

  /**
   * Pull the claim reference out of a job payload. CW can send either
   * `claimId` (flat) or a nested `claim` object. We return the id plus the
   * nested snapshot (when present) so callers can project directly from the
   * job response without an extra API hop.
   */
  private extractClaim(jobPayload: Record<string, unknown>): {
    cwClaimId?: string;
    nestedClaim?: Record<string, unknown>;
  } {
    const nested =
      jobPayload.claim && typeof jobPayload.claim === 'object'
        ? (jobPayload.claim as Record<string, unknown>)
        : undefined;

    const flat =
      typeof jobPayload.claimId === 'string' && jobPayload.claimId.length > 0
        ? jobPayload.claimId
        : undefined;

    const nestedId =
      nested && typeof nested.id === 'string' && (nested.id as string).length > 0
        ? (nested.id as string)
        : undefined;

    return { cwClaimId: flat ?? nestedId, nestedClaim: nested };
  }

  /**
   * Project the claim embedded in the parent job payload.
   *
   * Crunchwork does not emit a `NEW_CLAIM` webhook (per Insurance REST API
   * v17), so the claim row is always materialised from a parent event. We
   * previously tried to re-fetch the canonical claim via `GET /claims/{id}`
   * but that endpoint currently returns 403 for the webhook credentials, so
   * we use the nested `claim` snapshot embedded in the job response instead.
   * It has every field `CrunchworkClaimMapper` consumes.
   *
   * If no nested snapshot is present (only `claimId`), we fall back to any
   * already-linked internal claim rather than inserting a near-empty row.
   *
   * Runs inside the caller's transaction so the job's `claim_id` FK always
   * points at a claim that committed with it.
   */
  private async projectNestedClaim(params: {
    cwClaimId: string;
    nestedClaim?: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    sourceEventId?: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | undefined> {
    const existingLinkedId =
      await this.externalObjectService.resolveInternalEntityId({
        connectionId: params.connectionId,
        providerEntityType: 'claim',
        providerEntityId: params.cwClaimId,
        internalEntityType: 'claim',
        tx: params.tx,
      });

    if (!params.nestedClaim) {
      if (existingLinkedId) {
        this.logger.debug(
          `NestedEntityExtractor.projectNestedClaim — no nested claim on job payload for cwClaimId=${params.cwClaimId}; ` +
            `reusing already-linked claim=${existingLinkedId}`,
        );
        return existingLinkedId;
      }
      this.logger.warn(
        `NestedEntityExtractor.projectNestedClaim — job payload references cwClaimId=${params.cwClaimId} but has no nested claim object and no internal claim is linked yet; skipping claim projection`,
      );
      return undefined;
    }

    const claimPayload: Record<string, unknown> = {
      ...params.nestedClaim,
      id: params.nestedClaim.id ?? params.cwClaimId,
    };

    this.logger.debug(
      `NestedEntityExtractor.projectNestedClaim — projecting nested claim cwClaimId=${params.cwClaimId}` +
        (existingLinkedId ? ` (updating existing claim=${existingLinkedId})` : ''),
    );

    const { externalObject } = await this.externalObjectService.upsertFromFetch(
      {
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerCode: 'crunchwork',
        providerEntityType: 'claim',
        providerEntityId: params.cwClaimId,
        normalizedEntityType: 'claim',
        payload: claimPayload,
        sourceEventId: params.sourceEventId,
        tx: params.tx,
      },
    );

    const mapped = await this.claimMapper.map({
      externalObject: externalObject as unknown as Record<string, unknown>,
      tenantId: params.tenantId,
      connectionId: params.connectionId,
      tx: params.tx,
    });

    return mapped.internalEntityId;
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
