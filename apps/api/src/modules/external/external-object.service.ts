import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  ExternalObjectsRepository,
  ExternalObjectVersionsRepository,
  ExternalLinksRepository,
  type ExternalObjectRow,
} from '../../database/repositories';
import type { DrizzleDbOrTx } from '../../database/drizzle.module';

@Injectable()
export class ExternalObjectService {
  private readonly logger = new Logger('ExternalObjectService');

  constructor(
    private readonly externalObjectsRepo: ExternalObjectsRepository,
    private readonly externalObjectVersionsRepo: ExternalObjectVersionsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async upsertFromFetch(params: {
    tenantId: string;
    connectionId: string;
    providerCode: string;
    providerEntityType: string;
    providerEntityId: string;
    normalizedEntityType: string;
    payload: Record<string, unknown>;
    sourceEventId?: string;
    sourceEventType?: string;
    sourceEventTimestamp?: Date;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    externalObject: ExternalObjectRow;
    isNew: boolean;
    hashChanged: boolean;
  }> {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params.payload))
      .digest('hex');

    this.logger.debug(
      `ExternalObjectService.upsertFromFetch — ${params.providerEntityType}/${params.providerEntityId} hash=${payloadHash.substring(0, 12)}`,
    );

    const externalCreatedAt = this.extractTimestamp(
      params.payload,
      'createdDate',
    );
    const externalUpdatedAt = this.extractTimestamp(
      params.payload,
      'updatedDate',
    );
    const externalParentId = (params.payload.claimId ??
      params.payload.jobId ??
      params.payload.parentId) as string | undefined;

    const existingObj = await this.externalObjectsRepo.findByProviderEntity({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      tx: params.tx,
    });

    const { row: externalObject, wasInserted } =
      await this.externalObjectsRepo.upsert({
        data: {
          tenantId: params.tenantId,
          connectionId: params.connectionId,
          providerCode: params.providerCode,
          providerEntityType: params.providerEntityType,
          providerEntityId: params.providerEntityId,
          normalizedEntityType: params.normalizedEntityType,
          externalParentId: externalParentId?.toString(),
          latestPayload: params.payload,
          payloadHash,
          fetchStatus: 'fetched',
          lastFetchedAt: new Date(),
          lastFetchEventId: params.sourceEventId,
          latestEventType: params.sourceEventType,
          latestEventTimestamp: params.sourceEventTimestamp,
          externalCreatedAt,
          externalUpdatedAt,
          metadata: {},
        },
        tx: params.tx,
      });

    const previousHash = wasInserted ? null : existingObj?.payloadHash;
    const hashChanged = wasInserted || previousHash !== payloadHash;

    if (hashChanged) {
      const latestVersion =
        await this.externalObjectVersionsRepo.getLatestVersionNumber({
          externalObjectId: externalObject.id,
          tx: params.tx,
        });

      const previousPayload = existingObj?.latestPayload as Record<
        string,
        unknown
      > | null;
      const changeSummary = ExternalObjectService.buildChangeSummary(
        wasInserted ? null : (previousPayload ?? null),
        params.payload,
      );

      await this.externalObjectVersionsRepo.create({
        data: {
          externalObjectId: externalObject.id,
          versionNumber: latestVersion + 1,
          payload: params.payload,
          payloadHash,
          sourceEventId: params.sourceEventId,
          changeSummary,
        },
        tx: params.tx,
      });
    }

    return { externalObject, isNew: wasInserted, hashChanged };
  }

  private extractTimestamp(
    payload: Record<string, unknown>,
    key: string,
  ): Date | undefined {
    const val = payload[key];
    if (typeof val === 'string' || typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  }

  static buildChangeSummary(
    oldPayload: Record<string, unknown> | null,
    newPayload: Record<string, unknown>,
  ): { added: string[]; removed: string[]; modified: string[] } {
    if (!oldPayload) {
      return { added: Object.keys(newPayload), removed: [], modified: [] };
    }
    const oldKeys = new Set(Object.keys(oldPayload));
    const newKeys = new Set(Object.keys(newPayload));
    return {
      added: [...newKeys].filter((k) => !oldKeys.has(k)),
      removed: [...oldKeys].filter((k) => !newKeys.has(k)),
      modified: [...newKeys].filter(
        (k) =>
          oldKeys.has(k) &&
          JSON.stringify(oldPayload[k]) !== JSON.stringify(newPayload[k]),
      ),
    };
  }

  async resolveInternalEntityId(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    internalEntityType: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const extObj = await this.externalObjectsRepo.findByProviderEntity({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      tx: params.tx,
    });

    if (!extObj) {
      this.logger.debug(
        `ExternalObjectService.resolveInternalEntityId — no external object for ${params.providerEntityType}/${params.providerEntityId}`,
      );
      return null;
    }

    const links = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: extObj.id,
      tx: params.tx,
    });

    const match = links.find(
      (link) => link.internalEntityType === params.internalEntityType,
    );

    return match?.internalEntityId ?? null;
  }
}
