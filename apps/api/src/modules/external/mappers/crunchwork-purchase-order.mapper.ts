import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE,
  type DrizzleDB,
  type DrizzleDbOrTx,
} from '../../../database/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
} from '../../../database/schema';
import { ExternalLinksRepository } from '../../../database/repositories';
import type { EntityMapper } from '../entity-mapper.interface';
import { ExternalObjectService } from '../external-object.service';
import { LookupResolver } from '../lookup-resolver.service';

@Injectable()
export class CrunchworkPurchaseOrderMapper implements EntityMapper {
  private readonly logger = new Logger('CrunchworkPurchaseOrderMapper');

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
      `CrunchworkPurchaseOrderMapper.map — externalObjectId=${externalObjectId}`,
    );

    const existingLinks = await this.externalLinksRepo.findByExternalObjectId({
      externalObjectId,
      tx: params.tx,
    });
    const existingLink = existingLinks.find(
      (l) => l.internalEntityType === 'purchase_order',
    );

    const jobId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'job',
      providerEntityId: (payload.job as Record<string, unknown>)?.id as string,
      internalEntityType: 'job',
      tx: params.tx,
    });

    const claimId = await this.resolveFK({
      connectionId: params.connectionId,
      providerEntityType: 'claim',
      providerEntityId: (payload.claim as Record<string, unknown>)
        ?.id as string,
      internalEntityType: 'claim',
      tx: params.tx,
    });

    const statusLookupId = await this.lookupResolver.resolve({
      tenantId: params.tenantId,
      domain: 'purchase_order_status',
      externalReference:
        ((payload.status as Record<string, unknown>)
          ?.externalReference as string) ?? '',
      autoCreate: true,
    });

    const poTypeLookupId = await this.lookupResolver.resolve({
      tenantId: params.tenantId,
      domain: 'purchase_order_type',
      externalReference:
        ((payload.purchaseOrderType as Record<string, unknown>)
          ?.externalReference as string) ?? '',
      autoCreate: true,
    });

    const poData = {
      tenantId: params.tenantId,
      claimId: claimId ?? undefined,
      jobId: jobId ?? undefined,
      externalId: payload.id as string,
      purchaseOrderNumber: (payload.purchaseOrderNumber as string) ?? undefined,
      name: (payload.name as string) ?? undefined,
      statusLookupId: statusLookupId ?? undefined,
      purchaseOrderTypeLookupId: poTypeLookupId ?? undefined,
      startDate: (payload.startDate as string) ?? undefined,
      endDate: (payload.endDate as string) ?? undefined,
      note: (payload.note as string) ?? undefined,
      poTo: (payload.poTo as Record<string, unknown>) ?? {},
      poFor: (payload.poFor as Record<string, unknown>) ?? {},
      poFrom: (payload.poFrom as Record<string, unknown>) ?? {},
      totalAmount: (payload.totalAmount as string) ?? undefined,
      adjustedTotal: (payload.adjustedTotal as string) ?? undefined,
      purchaseOrderPayload: payload,
      updatedAt: new Date(),
    };

    let internalId: string;

    if (existingLink) {
      await db
        .update(purchaseOrders)
        .set(poData)
        .where(eq(purchaseOrders.id, existingLink.internalEntityId));
      internalId = existingLink.internalEntityId;
    } else {
      const [created] = await db
        .insert(purchaseOrders)
        .values({ ...poData, createdAt: new Date() })
        .returning();
      internalId = created.id;

      await this.externalLinksRepo.upsert({
        data: {
          tenantId: params.tenantId,
          externalObjectId,
          internalEntityType: 'purchase_order',
          internalEntityId: internalId,
          linkRole: 'source',
          isPrimary: true,
          metadata: {},
        },
        tx: params.tx,
      });
    }

    await this.syncLineItems({
      purchaseOrderId: internalId,
      tenantId: params.tenantId,
      payload,
      tx: params.tx,
    });

    return {
      internalEntityId: internalId,
      internalEntityType: 'purchase_order',
    };
  }

  private async syncLineItems(params: {
    purchaseOrderId: string;
    tenantId: string;
    payload: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<void> {
    const db = params.tx ?? this.db;

    await db
      .delete(purchaseOrderGroups)
      .where(eq(purchaseOrderGroups.purchaseOrderId, params.purchaseOrderId));

    const groups = (params.payload.groups as Record<string, unknown>[]) ?? [];
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      const [createdGroup] = await db
        .insert(purchaseOrderGroups)
        .values({
          tenantId: params.tenantId,
          purchaseOrderId: params.purchaseOrderId,
          description: (group.description as string) ?? undefined,
          sortIndex: gi,
          groupPayload: group,
        })
        .returning();

      const combos = (group.combos as Record<string, unknown>[]) ?? [];
      for (let ci = 0; ci < combos.length; ci++) {
        const combo = combos[ci];
        const [createdCombo] = await db
          .insert(purchaseOrderCombos)
          .values({
            tenantId: params.tenantId,
            purchaseOrderGroupId: createdGroup.id,
            name: (combo.name as string) ?? undefined,
            description: (combo.description as string) ?? undefined,
            category: (combo.category as string) ?? undefined,
            subCategory: (combo.subCategory as string) ?? undefined,
            quantity: (combo.quantity as string) ?? undefined,
            sortIndex: ci,
            comboPayload: combo,
          })
          .returning();

        const items = (combo.items as Record<string, unknown>[]) ?? [];
        for (let ii = 0; ii < items.length; ii++) {
          const item = items[ii];
          await db.insert(purchaseOrderItems).values({
            tenantId: params.tenantId,
            purchaseOrderComboId: createdCombo.id,
            name: (item.name as string) ?? undefined,
            description: (item.description as string) ?? undefined,
            category: (item.category as string) ?? undefined,
            subCategory: (item.subCategory as string) ?? undefined,
            itemType: (item.itemType as string) ?? undefined,
            quantity: (item.quantity as string) ?? undefined,
            tax: (item.tax as string) ?? undefined,
            unitCost: (item.unitCost as string) ?? undefined,
            buyCost: (item.buyCost as string) ?? undefined,
            sortIndex: ii,
            itemPayload: item,
          });
        }
      }
    }
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
