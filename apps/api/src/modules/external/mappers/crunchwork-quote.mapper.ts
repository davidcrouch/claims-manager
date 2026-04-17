import { Injectable, Logger } from '@nestjs/common';
import {
  QuotesRepository,
  ExternalLinksRepository,
  type QuoteInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

@Injectable()
export class CrunchworkQuoteMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkQuoteMapper');

  constructor(
    private readonly quotesRepo: QuotesRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
  ) {}

  async map(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<{
    internalEntityId: string;
    internalEntityType: string;
    skipped?: string;
  }> {
    const extObj = params.externalObject;
    const payload = extObj.latestPayload as Record<string, unknown>;
    const externalObjectId = extObj.id as string;
    const tx = params.tx;

    this.logger.log(
      `CrunchworkQuoteMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'quote',
    );

    const jobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: (payload.job as Record<string, unknown>)?.id as string,
      internalEntityType: 'job',
      tx,
    });

    const claimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: (payload.claim as Record<string, unknown>)
        ?.id as string,
      internalEntityType: 'claim',
      tx,
    });

    const quoteData: Partial<QuoteInsert> = {
      tenantId: params.tenantId,
      jobId: jobId ?? undefined,
      claimId: claimId ?? undefined,
      externalReference: payload.id as string,
      quoteNumber: (payload.quoteNumber as string) ?? undefined,
      name: (payload.name as string) ?? undefined,
      reference: (payload.reference as string) ?? undefined,
      note: (payload.note as string) ?? undefined,
      apiPayload: payload,
    };

    if (existingLink) {
      await this.quotesRepo.update({
        id: existingLink.internalEntityId,
        data: quoteData,
        tx,
      });
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'quote',
      };
    }

    if (!jobId && !claimId) {
      const payloadId = (payload.id as string | undefined) ?? 'unknown';
      this.logger.warn(
        `CrunchworkQuoteMapper.map — quote ${payloadId} has no resolvable job or claim parent; skipping (chk_quote_parent)`,
      );
      return {
        internalEntityId: '',
        internalEntityType: 'quote',
        skipped: 'skipped_no_parent',
      };
    }

    const created = await this.quotesRepo.create({
      data: quoteData as QuoteInsert,
      tx,
    });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'quote',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'quote' };
  }

  private async resolveFK(params: {
    connectionId: string;
    providerEntityType: string;
    providerEntityId: string | undefined;
    internalEntityType: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    if (!params.providerEntityId) return null;
    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: params.providerEntityType,
      providerEntityId: params.providerEntityId,
      internalEntityType: params.internalEntityType,
      tx: params.tx,
    });
  }
}
