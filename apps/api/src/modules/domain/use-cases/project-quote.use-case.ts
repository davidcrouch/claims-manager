import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { QuoteTransformer } from '../transformers/quote.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import { LookupResolutionService } from '../services/lookup-resolution.service';
import {
  QuotesRepository,
  ExternalLinksRepository,
  type QuoteInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectQuoteUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectQuoteUseCase');

  constructor(
    private readonly transformer: QuoteTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly quotesRepo: QuotesRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
  ) {}

  async execute(params: {
    externalObject: Record<string, unknown>;
    tenantId: string;
    connectionId: string;
    tx: DrizzleDbOrTx;
  }): Promise<ProjectionResult> {
    const { tenantId, connectionId, tx } = params;
    const payload = (params.externalObject.latestPayload ?? {}) as Record<string, unknown>;
    const externalObjectId = params.externalObject.id as string;

    this.logger.log(`ProjectQuoteUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'quote');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    if (result.skip) {
      this.logger.warn(`ProjectQuoteUseCase.execute — skipped: ${result.skip}`);
      return { status: 'skipped', internalEntityId: '', internalEntityType: 'quote', reason: result.skip };
    }

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;
    if (resolvedParents.claim) (result.entity as Record<string, unknown>).claimId = resolvedParents.claim;

    // 4. Resolve lookups
    const resolvedLookups = await this.lookupResolution.resolveAll({
      lookups: result.lookups,
      tenantId,
      sourceEntity: 'quote',
      tx,
    });
    for (const [field, lookupId] of Object.entries(resolvedLookups)) {
      (result.entity as Record<string, unknown>)[field] = lookupId;
    }

    // 5. Upsert
    let quoteId: string;
    if (existingLink) {
      await this.quotesRepo.update({ id: existingLink.internalEntityId, data: result.entity, tx });
      quoteId = existingLink.internalEntityId;
    } else {
      const jobId = (result.entity as Record<string, unknown>).jobId as string | undefined;
      const claimId = (result.entity as Record<string, unknown>).claimId as string | undefined;

      if (!jobId && !claimId) {
        const payloadId = (payload.id as string) ?? 'unknown';
        this.logger.warn(
          `ProjectQuoteUseCase.execute — quote ${payloadId} has no resolvable job or claim parent; skipping (chk_quote_parent)`,
        );
        return { status: 'skipped', internalEntityId: '', internalEntityType: 'quote', reason: 'skipped_no_parent' };
      }

      const created = await this.quotesRepo.create({
        data: { tenantId, ...result.entity } as QuoteInsert,
        tx,
      });
      quoteId = created.id;
    }

    // 6. Upsert external link
    await this.externalLinksRepo.upsert({
      data: {
        tenantId,
        externalObjectId,
        internalEntityType: 'quote',
        internalEntityId: quoteId,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return { status: 'completed', internalEntityId: quoteId, internalEntityType: 'quote' };
  }
}
