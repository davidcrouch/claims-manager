import { Injectable, Logger, Inject, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  proposals, workOrders, bills, jobs,
  quotes, purchaseOrders, invoices, rfqs,
} from '../../../database/schema';

type ReceiverEntityType = 'proposal' | 'work_order' | 'bill' | 'job';

const SOURCE_ENTITY_MAP: Record<ReceiverEntityType, { table: any; fkColumn: string; sourceTable: any }> = {
  proposal: { table: proposals, fkColumn: 'quoteId', sourceTable: quotes },
  work_order: { table: workOrders, fkColumn: 'purchaseOrderId', sourceTable: purchaseOrders },
  bill: { table: bills, fkColumn: 'invoiceId', sourceTable: invoices },
  job: { table: jobs, fkColumn: 'sourceExternalReference', sourceTable: rfqs },
};

@Injectable()
export class VersionSyncService {
  private readonly logger = new Logger('VersionSyncService');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async pullLatestVersion(params: {
    entityType: ReceiverEntityType;
    entityId: string;
    tenantId: string;
    userId: string;
  }): Promise<{ previousVersion: number; newVersion: number }> {
    return this.db.transaction(async (tx) => {
      const entity = await this.loadEntity(params.entityType, params.entityId, tx);
      if (!entity) {
        throw new NotFoundException(`${params.entityType} ${params.entityId} not found`);
      }

      const previousVersion = (entity.sourceVersionNumber as number) ?? 1;
      const newVersion = (entity.latestAvailableVersion as number) ?? 1;

      if (newVersion <= previousVersion) {
        return { previousVersion, newVersion: previousVersion };
      }

      const source = await this.loadSourceDocument(params.entityType, entity, tx);
      if (source) {
        await this.updateFromSource({
          entityType: params.entityType,
          entityId: params.entityId,
          source,
          tx,
        });
      }

      await this.updateVersionFields({
        entityType: params.entityType,
        entityId: params.entityId,
        sourceVersionNumber: newVersion,
        versionAcknowledged: true,
        tx,
      });

      this.logger.log(
        `VersionSyncService.pullLatestVersion — ${params.entityType}:${params.entityId} updated v${previousVersion} → v${newVersion}`,
      );

      return { previousVersion, newVersion };
    });
  }

  private async loadEntity(
    entityType: ReceiverEntityType,
    entityId: string,
    tx: DrizzleDbOrTx,
  ): Promise<Record<string, unknown> | null> {
    const config = SOURCE_ENTITY_MAP[entityType];
    const [row] = await tx
      .select()
      .from(config.table)
      .where(eq(config.table.id, entityId))
      .limit(1);
    return row ? (row as unknown as Record<string, unknown>) : null;
  }

  private async loadSourceDocument(
    entityType: ReceiverEntityType,
    entity: Record<string, unknown>,
    tx: DrizzleDbOrTx,
  ): Promise<Record<string, unknown> | null> {
    const config = SOURCE_ENTITY_MAP[entityType];

    if (entityType === 'job') {
      const apiPayload = entity.apiPayload as Record<string, unknown> | undefined;
      const sourceRfqId = apiPayload?.sourceRfqId as string | undefined;
      if (!sourceRfqId) return null;
      const [row] = await tx
        .select()
        .from(rfqs)
        .where(eq(rfqs.id, sourceRfqId))
        .limit(1);
      return row ? (row as unknown as Record<string, unknown>) : null;
    }

    const sourceFk = entity[config.fkColumn] as string | undefined;
    if (!sourceFk) return null;

    const [row] = await tx
      .select()
      .from(config.sourceTable)
      .where(eq(config.sourceTable.id, sourceFk))
      .limit(1);
    return row ? (row as unknown as Record<string, unknown>) : null;
  }

  private async updateFromSource(params: {
    entityType: ReceiverEntityType;
    entityId: string;
    source: Record<string, unknown>;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { entityType, entityId, source, tx } = params;

    switch (entityType) {
      case 'bill': {
        await tx.update(bills).set({
          subTotal: source.subTotal as string | undefined,
          totalTax: source.totalTax as string | undefined,
          totalAmount: source.totalAmount as string | undefined,
          comments: source.comments as string | undefined,
          updatedAt: new Date(),
        }).where(eq(bills.id, entityId));
        break;
      }
      case 'proposal': {
        await tx.update(proposals).set({
          subTotal: source.subTotal as string | undefined,
          totalTax: source.totalTax as string | undefined,
          totalAmount: source.totalAmount as string | undefined,
          note: source.note as string | undefined,
          updatedAt: new Date(),
        }).where(eq(proposals.id, entityId));
        break;
      }
      case 'work_order': {
        await tx.update(workOrders).set({
          totalAmount: source.totalAmount as string | undefined,
          adjustedTotal: source.adjustedTotal as string | undefined,
          note: source.note as string | undefined,
          updatedAt: new Date(),
        }).where(eq(workOrders.id, entityId));
        break;
      }
      case 'job': {
        await tx.update(jobs).set({
          apiPayload: source.rfqPayload as Record<string, unknown> ?? {},
          updatedAt: new Date(),
        }).where(eq(jobs.id, entityId));
        break;
      }
    }
  }

  private async updateVersionFields(params: {
    entityType: ReceiverEntityType;
    entityId: string;
    sourceVersionNumber: number;
    versionAcknowledged: boolean;
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { entityType, entityId, sourceVersionNumber, versionAcknowledged, tx } = params;
    const config = SOURCE_ENTITY_MAP[entityType];

    await tx.update(config.table).set({
      sourceVersionNumber,
      versionAcknowledged,
      updatedAt: new Date(),
    }).where(eq(config.table.id, entityId));
  }
}
