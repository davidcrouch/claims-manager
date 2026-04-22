import { Injectable, Logger } from '@nestjs/common';
import {
  ReportsRepository,
  ExternalLinksRepository,
  type ReportInsert,
} from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { ExternalObjectService } from '../external-object.service';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';

@Injectable()
export class CrunchworkReportMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkReportMapper');

  constructor(
    private readonly reportsRepo: ReportsRepository,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
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
      `CrunchworkReportMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'report',
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

    const reportData: Partial<ReportInsert> = {
      tenantId: params.tenantId,
      jobId: jobId ?? undefined,
      claimId: claimId ?? undefined,
      title: (payload.title as string) ?? undefined,
      reference: (payload.reference as string) ?? undefined,
      reportData: payload,
      apiPayload: payload,
    };

    if (existingLink) {
      await this.reportsRepo.update({
        id: existingLink.internalEntityId,
        data: reportData,
        tx,
      });
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'report',
      };
    }

    const created = await this.reportsRepo.create({
      data: reportData as ReportInsert,
      tx,
    });

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'report',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'report' };
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
