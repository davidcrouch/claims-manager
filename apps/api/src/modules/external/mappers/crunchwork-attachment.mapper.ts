import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import { attachments } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../tools/external-tools.controller';
import { ExternalObjectService } from '../external-object.service';

@Injectable()
export class CrunchworkAttachmentMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkAttachmentMapper');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
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
    const db = params.tx ?? this.db;

    this.logger.log(
      `CrunchworkAttachmentMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx: params.tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'attachment',
    );

    const relatedRecordType = this.resolveRelatedRecordType(payload);
    const relatedRecordId = await this.resolveRelatedRecordId({
      payload,
      connectionId: params.connectionId,
      tx: params.tx,
    });

    const attachmentData = {
      tenantId: params.tenantId,
      relatedRecordType: relatedRecordType ?? 'Job',
      relatedRecordId:
        relatedRecordId ?? '00000000-0000-0000-0000-000000000000',
      title:
        (payload.title as string) ?? (payload.fileName as string) ?? undefined,
      description: (payload.description as string) ?? undefined,
      fileName: (payload.fileName as string) ?? undefined,
      mimeType: (payload.mimeType as string) ?? undefined,
      fileSize: (payload.fileSize as number) ?? undefined,
      storageProvider: 'crunchwork',
      fileUrl:
        (payload.downloadUrl as string) ??
        (payload.fileUrl as string) ??
        undefined,
      apiPayload: payload,
      updatedAt: new Date(),
    };

    if (existingLink) {
      await db
        .update(attachments)
        .set(attachmentData)
        .where(eq(attachments.id, existingLink.internalEntityId));
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'attachment',
      };
    }

    const [created] = await db
      .insert(attachments)
      .values({ ...attachmentData, createdAt: new Date() })
      .returning();

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'attachment',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx: params.tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'attachment' };
  }

  private resolveRelatedRecordType(payload: Record<string, unknown>): string {
    const scope = payload.scope as string;
    const typeMap: Record<string, string> = {
      job: 'Job',
      claim: 'Claim',
      quote: 'Quote',
      purchase_order: 'PurchaseOrder',
      report: 'Report',
      invoice: 'Invoice',
    };
    return typeMap[scope?.toLowerCase()] ?? 'Job';
  }

  private async resolveRelatedRecordId(params: {
    payload: Record<string, unknown>;
    connectionId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | null> {
    const scopeId = params.payload.scopeId as string;
    const scope = params.payload.scope as string;
    if (!scopeId || !scope) return null;

    const typeMap: Record<string, string> = {
      job: 'job',
      claim: 'claim',
      quote: 'quote',
      purchase_order: 'purchase_order',
      report: 'report',
    };
    const providerType = typeMap[scope?.toLowerCase()];
    if (!providerType) return null;

    return this.externalObjectService.resolveInternalEntityId({
      connectionId: params.connectionId,
      providerEntityType: providerType,
      providerEntityId: scopeId,
      internalEntityType: providerType,
      tx: params.tx,
    });
  }
}
