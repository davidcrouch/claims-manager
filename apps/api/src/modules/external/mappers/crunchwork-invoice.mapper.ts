import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import { invoices } from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { ExternalObjectService } from '../external-object.service';
import { LookupResolver } from '../lookup-resolver.service';

@Injectable()
export class CrunchworkInvoiceMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkInvoiceMapper');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly externalLinksRepo: ExternalLinksRepository,
    private readonly externalObjectService: ExternalObjectService,
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
    const db = params.tx ?? this.db;

    this.logger.log(
      `CrunchworkInvoiceMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx: params.tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'invoice',
    );

    const purchaseOrderId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'purchase_order',
      providerEntityId: (payload.purchaseOrder as Record<string, unknown>)
        ?.id as string,
      internalEntityType: 'purchase_order',
      tx: params.tx,
    });

    const statusLookupId = await this.lookupResolver.resolve({
      tenantId: params.tenantId,
      domain: 'invoice_status',
      externalReference:
        ((payload.status as Record<string, unknown>)
          ?.externalReference as string) ?? '',
      autoCreate: true,
    });

    const invoiceData = {
      tenantId: params.tenantId,
      purchaseOrderId: purchaseOrderId ?? '',
      invoiceNumber: (payload.invoiceNumber as string) ?? undefined,
      statusLookupId: statusLookupId ?? undefined,
      issueDate: payload.issueDate
        ? new Date(payload.issueDate as string)
        : undefined,
      receivedDate: payload.receivedDate
        ? new Date(payload.receivedDate as string)
        : undefined,
      comments: (payload.comments as string) ?? undefined,
      subTotal: (payload.subTotal as string) ?? undefined,
      totalTax: (payload.totalTax as string) ?? undefined,
      totalAmount: (payload.totalAmount as string) ?? undefined,
      excessAmount: (payload.excessAmount as string) ?? undefined,
      invoicePayload: payload,
      updatedAt: new Date(),
    };

    if (existingLink) {
      await db
        .update(invoices)
        .set(invoiceData)
        .where(eq(invoices.id, existingLink.internalEntityId));
      return {
        internalEntityId: existingLink.internalEntityId,
        internalEntityType: 'invoice',
      };
    }

    const [created] = await db
      .insert(invoices)
      .values({ ...invoiceData, createdAt: new Date() })
      .returning();

    await this.externalLinksRepo.upsert({
      data: {
        tenantId: params.tenantId,
        externalObjectId,
        internalEntityType: 'invoice',
        internalEntityId: created.id,
        linkRole: 'source',
        isPrimary: true,
        metadata: {},
      },
      tx: params.tx,
    });

    return { internalEntityId: created.id, internalEntityType: 'invoice' };
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
