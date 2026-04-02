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
    tx?: DrizzleDbOrTx;
  }): Promise<{ externalObject: ExternalObjectRow; isNew: boolean; hashChanged: boolean }> {
    const payloadHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(params.payload))
      .digest('hex');

    this.logger.debug(
      `ExternalObjectService.upsertFromFetch — ${params.providerEntityType}/${params.providerEntityId} hash=${payloadHash.substring(0, 12)}`,
    );

    const { row: externalObject, wasInserted } = await this.externalObjectsRepo.upsert({
      data: {
        tenantId: params.tenantId,
        connectionId: params.connectionId,
        providerCode: params.providerCode,
        providerEntityType: params.providerEntityType,
        providerEntityId: params.providerEntityId,
        normalizedEntityType: params.normalizedEntityType,
        latestPayload: params.payload,
        payloadHash,
        fetchStatus: 'fetched',
        lastFetchedAt: new Date(),
        lastFetchEventId: params.sourceEventId,
        metadata: {},
      },
      tx: params.tx,
    });

    const previousHash = wasInserted ? null : externalObject.payloadHash;
    const hashChanged = wasInserted || previousHash !== payloadHash;

    if (hashChanged) {
      const latestVersion = await this.externalObjectVersionsRepo.getLatestVersionNumber({
        externalObjectId: externalObject.id,
        tx: params.tx,
      });

      await this.externalObjectVersionsRepo.create({
        data: {
          externalObjectId: externalObject.id,
          versionNumber: latestVersion + 1,
          payload: params.payload,
          payloadHash,
          sourceEventId: params.sourceEventId,
          changedFields: [],
        },
        tx: params.tx,
      });
    }

    return { externalObject, isNew: wasInserted, hashChanged };
  }

  async resolveInternalEntityId(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string;
    internalEntityType: string;
  }): Promise<string | null> {
    const extObj = await this.externalObjectsRepo.findByProviderEntity({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
    });

    if (!extObj) {
      this.logger.debug(
        `ExternalObjectService.resolveInternalEntityId — no external object for ${params.providerEntityType}/${params.providerEntityId}`,
      );
      return null;
    }

    const links = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId: extObj.id,
    });

    const match = links.find(
      (link) => link.internalEntityType === params.internalEntityType,
    );

    return match?.internalEntityId ?? null;
  }
}
