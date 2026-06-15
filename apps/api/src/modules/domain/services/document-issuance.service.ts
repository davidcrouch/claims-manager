import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  quotes,
  invoices,
} from '../../../database/schema';
import {
  WorkOrdersRepository,
  type WorkOrderInsert,
  ProposalsRepository,
  type ProposalInsert,
  BillsRepository,
  type BillInsert,
} from '../../../database/repositories';
import { VersioningService } from './versioning.service';
import { LineItemSyncService } from './line-item-sync.service';
import { VisibilityService } from './visibility.service';

export interface IssuanceResult {
  versionNumber: number;
  recipientEntityId?: string;
  recipientEntityType?: string;
}

type DocumentType = 'purchase_order' | 'quote' | 'invoice' | 'rfq';

const RECIPIENT_TYPE_MAP: Record<string, string> = {
  purchase_order: 'work_order',
  quote: 'proposal',
  invoice: 'bill',
  rfq: 'rfq',
};

@Injectable()
export class DocumentIssuanceService {
  private readonly logger = new Logger('DocumentIssuanceService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly versioning: VersioningService,
    private readonly lineItemSync: LineItemSyncService,
    private readonly visibility: VisibilityService,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly billsRepo: BillsRepository,
  ) {}

  /**
   * Issue a document — creates version snapshot, copies to recipient entity,
   * and handles visibility copy-on-issue.
   */
  async execute(params: {
    tenantId: string;
    userId: string;
    documentType: DocumentType;
    documentId: string;
    recipientTenantId?: string;
    tx: DrizzleDbOrTx;
  }): Promise<IssuanceResult> {
    const { tenantId, documentType, documentId, tx } = params;

    this.logger.log(
      `DocumentIssuanceService.execute — issuing ${documentType}:${documentId}`,
    );

    // 1. Load document + line items
    const { entity, lineItems } = await this.loadDocumentWithItems(documentType, documentId, tx);

    // 2. Create version snapshot
    const { versionNumber } = await this.versioning.createSnapshot({
      tenantId,
      documentType,
      documentId,
      entitySnapshot: entity,
      lineItemSnapshot: lineItems,
      issuedByUserId: params.userId,
      tx,
    });

    // 3. If on-platform recipient: create/update recipient entity
    let recipientEntityId: string | undefined;
    const recipientEntityType = RECIPIENT_TYPE_MAP[documentType];

    if (params.recipientTenantId) {
      recipientEntityId = await this.createRecipientEntity({
        sourceDocumentType: documentType,
        sourceDocumentId: documentId,
        sourceEntity: entity,
        sourceLineItems: lineItems,
        sourceTenantId: tenantId,
        recipientTenantId: params.recipientTenantId,
        versionNumber,
        tx,
      });

      // 4. Copy 'parties' visibility associations to recipient
      await this.visibility.copyPartiesAssociations({
        sourceEntityType: documentType,
        sourceEntityId: documentId,
        targetEntityType: recipientEntityType,
        targetEntityId: recipientEntityId,
        targetTenantId: params.recipientTenantId,
        tx,
      });
    }

    return { versionNumber, recipientEntityId, recipientEntityType };
  }

  private async loadDocumentWithItems(
    documentType: string,
    documentId: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    switch (documentType) {
      case 'purchase_order':
        return this.loadPurchaseOrder(documentId, tx);
      case 'quote':
        return this.loadQuote(documentId, tx);
      case 'invoice':
        return this.loadInvoice(documentId, tx);
      default:
        throw new Error(`DocumentIssuanceService — unsupported documentType=${documentType}`);
    }
  }

  private async loadPurchaseOrder(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — PO ${id} not found`);

    const groups = await tx
      .select()
      .from(purchaseOrderGroups)
      .where(eq(purchaseOrderGroups.purchaseOrderId, id));

    const lineItems: unknown[] = [];
    for (const group of groups) {
      const combos = await tx
        .select()
        .from(purchaseOrderCombos)
        .where(eq(purchaseOrderCombos.purchaseOrderGroupId, group.id));

      const comboData: unknown[] = [];
      for (const combo of combos) {
        const items = await tx
          .select()
          .from(purchaseOrderItems)
          .where(eq(purchaseOrderItems.purchaseOrderComboId, combo.id));
        comboData.push({ ...combo, items });
      }

      lineItems.push({ ...group, combos: comboData });
    }

    return { entity: entity as unknown as Record<string, unknown>, lineItems };
  }

  private async loadQuote(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — Quote ${id} not found`);
    return { entity: entity as unknown as Record<string, unknown>, lineItems: [] };
  }

  private async loadInvoice(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — Invoice ${id} not found`);
    return { entity: entity as unknown as Record<string, unknown>, lineItems: [] };
  }

  private async createRecipientEntity(params: {
    sourceDocumentType: string;
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceLineItems: unknown[];
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    switch (params.sourceDocumentType) {
      case 'purchase_order':
        return this.createWorkOrderFromPO(params);
      case 'quote':
        return this.createProposalFromQuote(params);
      case 'invoice':
        return this.createBillFromInvoice(params);
      default:
        throw new Error(
          `DocumentIssuanceService — no recipient creation for type=${params.sourceDocumentType}`,
        );
    }
  }

  private async createWorkOrderFromPO(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;

    const woData: Partial<WorkOrderInsert> = {
      tenantId: params.recipientTenantId,
      purchaseOrderId: params.sourceDocumentId,
      claimId: src.claimId as string | undefined,
      jobId: src.jobId as string | undefined,
      vendorId: src.vendorId as string | undefined,
      sourceTenantId: params.sourceTenantId,
      sourceExternalReference: src.externalId as string | undefined,
      workOrderNumber: src.purchaseOrderNumber as string | undefined,
      name: src.name as string | undefined,
      statusLookupId: src.statusLookupId as string | undefined,
      startDate: src.startDate as string | undefined,
      endDate: src.endDate as string | undefined,
      note: src.note as string | undefined,
      // Perspective swap: PO's "to" becomes WO's "from" and vice versa
      woTo: (src.poFrom as Record<string, unknown>) ?? {},
      woFor: (src.poFor as Record<string, unknown>) ?? {},
      woFrom: (src.poTo as Record<string, unknown>) ?? {},
      totalAmount: src.totalAmount as string | undefined,
      adjustedTotal: src.adjustedTotal as string | undefined,
      workOrderPayload: src.purchaseOrderPayload as Record<string, unknown> ?? {},
      sourceVersionNumber: params.versionNumber,
      latestAvailableVersion: params.versionNumber,
      versionAcknowledged: false,
    };

    const created = await this.workOrdersRepo.create({
      data: woData as WorkOrderInsert,
      tx: params.tx,
    });

    return created.id;
  }

  private async createProposalFromQuote(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;

    const proposalData: Partial<ProposalInsert> = {
      tenantId: params.recipientTenantId,
      quoteId: params.sourceDocumentId,
      claimId: src.claimId as string | undefined,
      jobId: src.jobId as string | undefined,
      proposalNumber: src.quoteNumber as string | undefined,
      name: src.name as string | undefined,
      reference: src.reference as string | undefined,
      note: src.note as string | undefined,
      statusLookupId: src.statusLookupId as string | undefined,
      proposalPayload: src.apiPayload as Record<string, unknown> ?? {},
      sourceVersionNumber: params.versionNumber,
      latestAvailableVersion: params.versionNumber,
      versionAcknowledged: false,
    };

    const created = await this.proposalsRepo.create({
      data: proposalData as ProposalInsert,
      tx: params.tx,
    });

    return created.id;
  }

  private async createBillFromInvoice(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;

    const billData: Partial<BillInsert> = {
      tenantId: params.recipientTenantId,
      invoiceId: params.sourceDocumentId,
      purchaseOrderId: src.purchaseOrderId as string | undefined,
      billNumber: src.invoiceNumber as string | undefined,
      issueDate: src.issueDate as Date | undefined,
      receivedDate: new Date(),
      comments: src.comments as string | undefined,
      statusLookupId: src.statusLookupId as string | undefined,
      subTotal: src.subTotal as string | undefined,
      totalTax: src.totalTax as string | undefined,
      totalAmount: src.totalAmount as string | undefined,
      billPayload: src.invoicePayload as Record<string, unknown> ?? {},
      sourceVersionNumber: params.versionNumber,
      latestAvailableVersion: params.versionNumber,
      versionAcknowledged: false,
    };

    const created = await this.billsRepo.create({
      data: billData as BillInsert,
      tx: params.tx,
    });

    return created.id;
  }
}
