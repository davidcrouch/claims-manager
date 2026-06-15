import { Injectable, Logger } from '@nestjs/common';
import type { ProjectionUseCase, ProjectionResult } from './use-case.interface';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import { ReportTransformer } from '../transformers/report.transformer';
import { EntityRelationshipService } from '../services/entity-relationship.service';
import {
  ReportsRepository,
  ExternalLinksRepository,
  type ReportInsert,
} from '../../../database/repositories';

@Injectable()
export class ProjectReportUseCase implements ProjectionUseCase {
  private readonly logger = new Logger('ProjectReportUseCase');

  constructor(
    private readonly transformer: ReportTransformer,
    private readonly entityRelationship: EntityRelationshipService,
    private readonly reportsRepo: ReportsRepository,
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

    this.logger.log(`ProjectReportUseCase.execute — externalObjectId=${externalObjectId}`);

    // 1. Check for existing entity
    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({ externalObjectId, tx });
    const existingLink = existingLinks.find((l) => l.internalEntityType === 'report');

    // 2. Transform
    const result = this.transformer.transform({ payload, tenantId });

    // 3. Resolve parents
    const resolvedParents = await this.entityRelationship.resolveParents({
      parentRefs: result.parentRefs,
      tenantId,
      connectionId,
      tx,
    });
    if (resolvedParents.job) (result.entity as Record<string, unknown>).jobId = resolvedParents.job;
    if (resolvedParents.claim) (result.entity as Record<string, unknown>).claimId = resolvedParents.claim;

    // 4. Upsert
    let reportId: string;
    if (existingLink) {
      await this.reportsRepo.update({
        id: existingLink.internalEntityId,
        data: result.entity as Partial<ReportInsert>,
        tx,
      });
      reportId = existingLink.internalEntityId;
    } else {
      const created = await this.reportsRepo.create({
        data: { tenantId, ...result.entity } as ReportInsert,
        tx,
      });
      reportId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId,
          externalObjectId,
          internalEntityType: 'report',
          internalEntityId: reportId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx,
      });
    }

    return { status: 'completed', internalEntityId: reportId, internalEntityType: 'report' };
  }
}
