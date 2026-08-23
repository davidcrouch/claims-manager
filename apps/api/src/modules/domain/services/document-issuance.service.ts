import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderGroups,
  purchaseOrderCombos,
  purchaseOrderItems,
  workOrderGroups as workOrderGroupsTable,
  workOrderCombos as workOrderCombosTable,
  workOrderItems as workOrderItemsTable,
  quotes,
  quoteGroups,
  quoteCombos,
  quoteItems,
  proposalGroups,
  proposalCombos,
  proposalItems,
  invoices,
  rfqs,
  lookupValues,
} from '../../../database/schema';
import {
  WorkOrdersRepository,
  type WorkOrderInsert,
  ProposalsRepository,
  type ProposalInsert,
  BillsRepository,
  type BillInsert,
  JobsRepository,
  type JobInsert,
} from '../../../database/repositories';
import { VersioningService } from './versioning.service';
import { LineItemSyncService } from './line-item-sync.service';
import { VisibilityService } from './visibility.service';
import { LookupResolutionService } from './lookup-resolution.service';
import { LOOKUP_DOMAINS } from '../constants/lookup-domains';
import { RecordNumberService } from '../../../common/record-number/record-number.service';

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
  rfq: 'job',
};

@Injectable()
export class DocumentIssuanceService {
  private readonly logger = new Logger('DocumentIssuanceService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly versioning: VersioningService,
    private readonly lineItemSync: LineItemSyncService,
    private readonly visibility: VisibilityService,
    private readonly lookupResolution: LookupResolutionService,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly billsRepo: BillsRepository,
    private readonly jobsRepo: JobsRepository,
    private readonly recordNumberService: RecordNumberService,
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

    // 1b. Stamp issuer/recipient org if not already set (standard issuance path)
    if (documentType === 'purchase_order') {
      const needsIssuerStamp = !entity.issuerOrganisationId;
      const needsRecipientStamp = !entity.recipientOrganisationId && params.recipientTenantId;
      if (needsIssuerStamp || needsRecipientStamp) {
        const updates: Record<string, unknown> = {};
        if (needsIssuerStamp) updates.issuerOrganisationId = tenantId;
        if (needsRecipientStamp) updates.recipientOrganisationId = params.recipientTenantId;
        await tx.update(purchaseOrders).set(updates).where(eq(purchaseOrders.id, documentId));
        if (needsIssuerStamp) entity.issuerOrganisationId = tenantId;
        if (needsRecipientStamp) entity.recipientOrganisationId = params.recipientTenantId;
      }
    }

    if (documentType === 'quote') {
      const needsIssuerStamp = !entity.issuerOrganisationId;
      const needsRecipientStamp = !entity.recipientOrganisationId && params.recipientTenantId;
      if (needsIssuerStamp || needsRecipientStamp) {
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (needsIssuerStamp) updates.issuerOrganisationId = tenantId;
        if (needsRecipientStamp) updates.recipientOrganisationId = params.recipientTenantId;
        await tx.update(quotes).set(updates).where(eq(quotes.id, documentId));
        if (needsIssuerStamp) entity.issuerOrganisationId = tenantId;
        if (needsRecipientStamp) entity.recipientOrganisationId = params.recipientTenantId;
      }
    }

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
      case 'rfq':
        return this.loadRfq(documentId, tx);
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
      const groupItems = await tx
        .select()
        .from(purchaseOrderItems)
        .where(eq(purchaseOrderItems.purchaseOrderGroupId, group.id));

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

      lineItems.push({ ...group, combos: comboData, items: groupItems });
    }

    return { entity: entity as unknown as Record<string, unknown>, lineItems };
  }

  private async loadQuote(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — Quote ${id} not found`);

    const groups = await tx.select().from(quoteGroups).where(eq(quoteGroups.quoteId, id));

    const lineItems: unknown[] = [];
    for (const group of groups) {
      const combos = await tx
        .select()
        .from(quoteCombos)
        .where(eq(quoteCombos.quoteGroupId, group.id));

      const groupItems = await tx
        .select()
        .from(quoteItems)
        .where(eq(quoteItems.quoteGroupId, group.id));

      const comboData: unknown[] = [];
      for (const combo of combos) {
        const items = await tx
          .select()
          .from(quoteItems)
          .where(eq(quoteItems.quoteComboId, combo.id));
        comboData.push({ ...combo, items });
      }

      lineItems.push({ ...group, combos: comboData, items: groupItems });
    }

    return { entity: entity as unknown as Record<string, unknown>, lineItems };
  }

  private async loadInvoice(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — Invoice ${id} not found`);
    return { entity: entity as unknown as Record<string, unknown>, lineItems: [] };
  }

  private async loadRfq(
    id: string,
    tx: DrizzleDbOrTx,
  ): Promise<{ entity: Record<string, unknown>; lineItems: unknown[] }> {
    const [entity] = await tx.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    if (!entity) throw new Error(`DocumentIssuanceService — RFQ ${id} not found`);
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
      case 'rfq':
        return this.createJobFromRfq(params);
      default:
        throw new Error(
          `DocumentIssuanceService — no recipient creation for type=${params.sourceDocumentType}`,
        );
    }
  }

  private async createWorkOrderFromPO(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceLineItems: unknown[];
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;
    const tx = params.tx;

    // Never copy purchase_order_status IDs onto work orders — Active/Archived
    // list tabs filter by work_order_status lookup IDs only.
    const statusLookupId = await this.resolveWorkOrderStatusFromPo({
      tenantId: params.recipientTenantId,
      poStatusLookupId: src.statusLookupId as string | undefined,
      tx,
    });

    // Resolve WO type from PO type lookup
    let workOrderTypeLookupId: string | null = null;
    if (src.purchaseOrderTypeLookupId) {
      const [typeRow] = await tx
        .select({ name: lookupValues.name })
        .from(lookupValues)
        .where(eq(lookupValues.id, src.purchaseOrderTypeLookupId as string))
        .limit(1);
      if (typeRow?.name) {
        workOrderTypeLookupId = await this.lookupResolution.resolve({
          tenantId: params.recipientTenantId,
          domain: LOOKUP_DOMAINS.WORK_ORDER_TYPE,
          externalReference: typeRow.name,
          name: typeRow.name,
          autoCreate: true,
          tx,
        });
      }
    }

    const poFrom = (src.poFrom as Record<string, unknown>) ?? {};
    const poTo = (src.poTo as Record<string, unknown>) ?? {};
    const poFor = (src.poFor as Record<string, unknown>) ?? {};

    const woData: Partial<WorkOrderInsert> = {
      tenantId: params.recipientTenantId,
      purchaseOrderId: params.sourceDocumentId,
      claimId: src.claimId as string | undefined,
      jobId: src.jobId as string | undefined,
      vendorId: src.vendorId as string | undefined,
      quoteId: src.quoteId as string | undefined,
      sourceTenantId: params.sourceTenantId,
      sourceOrganisationId: (src.issuerOrganisationId as string) ?? params.sourceTenantId,
      sourceExternalReference: src.externalId as string | undefined,
      originType: 'tenant',
      workOrderNumber: src.purchaseOrderNumber as string | undefined,
      name: src.name as string | undefined,
      statusLookupId: statusLookupId ?? undefined,
      workOrderTypeLookupId: workOrderTypeLookupId ?? undefined,
      startDate: src.startDate as string | undefined,
      endDate: src.endDate as string | undefined,
      startTime: src.startTime as string | undefined,
      endTime: src.endTime as string | undefined,
      note: src.note as string | undefined,
      // Perspective swap: PO's "to" becomes WO's "from" and vice versa
      woTo: poFrom,
      woFor: poFor,
      woFrom: poTo,
      woToEmail: (poFrom as Record<string, string>).email ?? undefined,
      woForName: (poFor as Record<string, string>).name ?? undefined,
      serviceWindow: (src.serviceWindow as Record<string, unknown>) ?? {},
      totalAmount: src.totalAmount as string | undefined,
      adjustedTotal: src.adjustedTotal as string | undefined,
      adjustedTotalAdjustmentAmount: src.adjustedTotalAdjustmentAmount as string | undefined,
      adjustmentInfo: (src.adjustmentInfo as Record<string, unknown>) ?? {},
      allocationContext: (src.allocationContext as Record<string, unknown>) ?? {},
      workOrderPayload: src.purchaseOrderPayload as Record<string, unknown> ?? {},
      sourceVersionNumber: params.versionNumber,
      latestAvailableVersion: params.versionNumber,
      versionAcknowledged: false,
    };

    const internalNumber = await this.recordNumberService.next({
      tenantId: params.recipientTenantId,
      entity: 'work_order',
      tx,
    });
    woData.internalNumber = internalNumber;
    this.logger.log(
      `DocumentIssuanceService.createWorkOrderFromPo — assigned internalNumber=${internalNumber} for recipientTenant=${params.recipientTenantId}`,
    );

    const created = await this.workOrdersRepo.create({
      data: woData as WorkOrderInsert,
      tx,
    });

    await this.copyPoLineItemsToWorkOrder({
      workOrderId: created.id,
      recipientTenantId: params.recipientTenantId,
      sourceLineItems: params.sourceLineItems,
      tx,
    });

    this.logger.log(
      `DocumentIssuanceService.createWorkOrderFromPO — created WO=${created.id} from PO=${params.sourceDocumentId}`,
    );

    return created.id;
  }

  private async copyPoLineItemsToWorkOrder(params: {
    workOrderId: string;
    recipientTenantId: string;
    sourceLineItems: unknown[];
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { workOrderId, recipientTenantId, sourceLineItems, tx } = params;

    for (const rawGroup of sourceLineItems) {
      const group = rawGroup as Record<string, unknown>;

      const [woGroup] = await tx
        .insert(workOrderGroupsTable)
        .values({
          tenantId: recipientTenantId,
          workOrderId,
          groupLabelLookupId: (group.groupLabelLookupId as string) ?? null,
          description: (group.description as string) ?? null,
          dimensions: (group.dimensions as Record<string, unknown>) ?? {},
          totals: (group.totals as Record<string, unknown>) ?? {},
          sortIndex: (group.sortIndex as number) ?? 0,
          groupPayload: (group.groupPayload as Record<string, unknown>) ?? {},
        })
        .returning();

      const groupItems = Array.isArray(group.items) ? group.items : [];
      for (const rawItem of groupItems) {
        const item = rawItem as Record<string, unknown>;
        await tx.insert(workOrderItemsTable).values(this.mapPoItemToWoItem({
          item,
          recipientTenantId,
          workOrderGroupId: woGroup.id,
          workOrderComboId: null,
        }));
      }

      const combos = Array.isArray(group.combos) ? group.combos : [];
      for (const rawCombo of combos) {
        const combo = rawCombo as Record<string, unknown>;

        const [woCombo] = await tx
          .insert(workOrderCombosTable)
          .values({
            tenantId: recipientTenantId,
            workOrderGroupId: woGroup.id,
            catalogComboId: (combo.catalogComboId as string) ?? null,
            quoteComboId: (combo.quoteComboId as string) ?? null,
            name: (combo.name as string) ?? null,
            description: (combo.description as string) ?? null,
            category: (combo.category as string) ?? null,
            subCategory: (combo.subCategory as string) ?? null,
            quantity: (combo.quantity as string) ?? null,
            sortIndex: (combo.sortIndex as number) ?? 0,
            totals: (combo.totals as Record<string, unknown>) ?? {},
            comboPayload: (combo.comboPayload as Record<string, unknown>) ?? {},
          })
          .returning();

        const comboItems = Array.isArray(combo.items) ? combo.items : [];
        for (const rawItem of comboItems) {
          const item = rawItem as Record<string, unknown>;
          await tx.insert(workOrderItemsTable).values(this.mapPoItemToWoItem({
            item,
            recipientTenantId,
            workOrderGroupId: null,
            workOrderComboId: woCombo.id,
          }));
        }
      }
    }
  }

  private mapPoItemToWoItem(params: {
    item: Record<string, unknown>;
    recipientTenantId: string;
    workOrderGroupId: string | null;
    workOrderComboId: string | null;
  }) {
    const { item, recipientTenantId, workOrderGroupId, workOrderComboId } = params;
    return {
      tenantId: recipientTenantId,
      workOrderGroupId,
      workOrderComboId,
      catalogItemId: (item.catalogItemId as string) ?? null,
      quoteLineItemId: (item.quoteLineItemId as string) ?? null,
      unitTypeLookupId: (item.unitTypeLookupId as string) ?? null,
      name: (item.name as string) ?? null,
      description: (item.description as string) ?? null,
      category: (item.category as string) ?? null,
      subCategory: (item.subCategory as string) ?? null,
      itemType: (item.itemType as string) ?? null,
      quantity: (item.quantity as string) ?? null,
      tax: (item.tax as string) ?? null,
      unitCost: (item.unitCost as string) ?? null,
      buyCost: (item.buyCost as string) ?? null,
      markupType: (item.markupType as string) ?? null,
      markupValue: (item.markupValue as string) ?? null,
      reconciliation: (item.reconciliation as string) ?? null,
      manualAllocation: (item.manualAllocation as boolean) ?? null,
      sortIndex: (item.sortIndex as number) ?? 0,
      note: (item.note as string) ?? null,
      tags: (item.tags as unknown[]) ?? [],
      totals: (item.totals as Record<string, unknown>) ?? {},
      itemPayload: (item.itemPayload as Record<string, unknown>) ?? {},
    };
  }

  /** Map PO status name → work_order_status name/ref for the recipient tenant. */
  private mapPoStatusToWorkOrderStatus(poStatusName: string | null | undefined): {
    name: string;
    externalReference: string;
  } {
    const raw = (poStatusName ?? 'Open').trim();
    const key = raw.toLowerCase();
    if (key === 'issued') return { name: 'Open', externalReference: 'Open' };
    if (key === 'cancelled' || key === 'closed') {
      return { name: 'Archived', externalReference: 'Archived' };
    }
    return { name: raw || 'Open', externalReference: raw || 'Open' };
  }

  private async resolveWorkOrderStatusFromPo(params: {
    tenantId: string;
    poStatusLookupId?: string;
    tx: DrizzleDbOrTx;
  }): Promise<string | null> {
    let poStatusName: string | null = null;
    if (params.poStatusLookupId) {
      const [row] = await params.tx
        .select({ name: lookupValues.name })
        .from(lookupValues)
        .where(eq(lookupValues.id, params.poStatusLookupId))
        .limit(1);
      poStatusName = row?.name ?? null;
    }
    const mapped = this.mapPoStatusToWorkOrderStatus(poStatusName);
    return this.lookupResolution.resolve({
      tenantId: params.tenantId,
      domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS,
      externalReference: mapped.externalReference,
      name: mapped.name,
      autoCreate: true,
      tx: params.tx,
    });
  }

  private async createProposalFromQuote(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceLineItems: unknown[];
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;
    const tx = params.tx;

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId: params.recipientTenantId,
      domain: 'proposal_status',
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    const proposalData: Partial<ProposalInsert> = {
      tenantId: params.recipientTenantId,
      quoteId: params.sourceDocumentId,
      claimId: src.claimId as string | undefined,
      jobId: src.jobId as string | undefined,
      sourceTenantId: params.sourceTenantId,
      sourceOrganisationId: (src.issuerOrganisationId as string) ?? params.sourceTenantId,
      originType: 'tenant',
      proposalNumber: src.quoteNumber as string | undefined,
      name: src.name as string | undefined,
      reference: src.reference as string | undefined,
      note: src.note as string | undefined,
      statusLookupId: statusLookupId ?? undefined,
      receivedDate: new Date(),
      proposalDate: (src.quoteDate as Date | undefined) ?? undefined,
      expiresInDays: src.expiresInDays as number | undefined,
      subTotal: src.subTotal as string | undefined,
      totalTax: src.totalTax as string | undefined,
      totalAmount: src.totalAmount as string | undefined,
      // Perspective swap: vendor identity → proposalFrom; buyer → proposalTo
      proposalFrom: (src.quoteFrom as Record<string, unknown>) ?? {},
      proposalTo: (src.quoteTo as Record<string, unknown>) ?? {},
      proposalFor: (src.quoteFor as Record<string, unknown>) ?? {},
      proposalFromName: (src.quoteFromName as string | undefined) ?? undefined,
      proposalToName: (src.quoteToName as string | undefined) ?? undefined,
      proposalToEmail: (src.quoteToEmail as string | undefined) ?? undefined,
      proposalPayload: (src.apiPayload as Record<string, unknown>) ?? {},
      sourceVersionNumber: params.versionNumber,
      latestAvailableVersion: params.versionNumber,
      versionAcknowledged: false,
    };

    const created = await this.proposalsRepo.create({
      data: proposalData as ProposalInsert,
      tx,
    });

    await this.copyQuoteLineItemsToProposal({
      proposalId: created.id,
      recipientTenantId: params.recipientTenantId,
      sourceLineItems: params.sourceLineItems,
      tx,
    });

    this.logger.log(
      `DocumentIssuanceService.createProposalFromQuote — created proposal=${created.id} from quote=${params.sourceDocumentId}`,
    );

    return created.id;
  }

  /**
   * Copy commercially visible quote line items into the proposal hierarchy.
   * Excludes internal items and strips vendor margin fields.
   */
  private async copyQuoteLineItemsToProposal(params: {
    proposalId: string;
    recipientTenantId: string;
    sourceLineItems: unknown[];
    tx: DrizzleDbOrTx;
  }): Promise<void> {
    const { proposalId, recipientTenantId, sourceLineItems, tx } = params;

    for (const rawGroup of sourceLineItems) {
      const group = rawGroup as {
        groupLabelLookupId?: string | null;
        description?: string | null;
        dimensions?: Record<string, unknown>;
        sortIndex?: number;
        totals?: Record<string, unknown>;
        combos?: unknown[];
        items?: unknown[];
      };

      const [proposalGroup] = await tx
        .insert(proposalGroups)
        .values({
          tenantId: recipientTenantId,
          proposalId,
          groupLabelLookupId: group.groupLabelLookupId ?? null,
          description: group.description ?? null,
          dimensions: group.dimensions ?? {},
          sortIndex: group.sortIndex ?? 0,
          totals: group.totals ?? {},
        })
        .returning();

      const groupItems = Array.isArray(group.items) ? group.items : [];
      for (const rawItem of groupItems) {
        const item = rawItem as Record<string, unknown>;
        if (item.internal === true) continue;
        await tx.insert(proposalItems).values(this.mapQuoteItemToProposalItem({
          item,
          recipientTenantId,
          proposalGroupId: proposalGroup.id,
          proposalComboId: null,
        }));
      }

      const combos = Array.isArray(group.combos) ? group.combos : [];
      for (const rawCombo of combos) {
        const combo = rawCombo as {
          name?: string | null;
          description?: string | null;
          category?: string | null;
          subCategory?: string | null;
          quantity?: string | null;
          sortIndex?: number;
          totals?: Record<string, unknown>;
          comboPayload?: Record<string, unknown>;
          items?: unknown[];
        };

        const [proposalCombo] = await tx
          .insert(proposalCombos)
          .values({
            tenantId: recipientTenantId,
            proposalGroupId: proposalGroup.id,
            name: combo.name ?? null,
            description: combo.description ?? null,
            category: combo.category ?? null,
            subCategory: combo.subCategory ?? null,
            quantity: combo.quantity ?? null,
            sortIndex: combo.sortIndex ?? 0,
            totals: combo.totals ?? {},
            comboPayload: combo.comboPayload ?? {},
          })
          .returning();

        const comboItems = Array.isArray(combo.items) ? combo.items : [];
        for (const rawItem of comboItems) {
          const item = rawItem as Record<string, unknown>;
          if (item.internal === true) continue;
          await tx.insert(proposalItems).values(this.mapQuoteItemToProposalItem({
            item,
            recipientTenantId,
            proposalGroupId: null,
            proposalComboId: proposalCombo.id,
          }));
        }
      }
    }
  }

  private mapQuoteItemToProposalItem(params: {
    item: Record<string, unknown>;
    recipientTenantId: string;
    proposalGroupId: string | null;
    proposalComboId: string | null;
  }) {
    const { item, recipientTenantId, proposalGroupId, proposalComboId } = params;
    // Intentionally omit buyCost, markupType, markupValue, allocatedCost, committedCost
    return {
      tenantId: recipientTenantId,
      proposalGroupId,
      proposalComboId,
      unitTypeLookupId: (item.unitTypeLookupId as string | undefined) ?? null,
      name: (item.name as string | undefined) ?? null,
      description: (item.description as string | undefined) ?? null,
      category: (item.category as string | undefined) ?? null,
      subCategory: (item.subCategory as string | undefined) ?? null,
      itemType: (item.itemType as string | undefined) ?? null,
      quantity: (item.quantity as string | undefined) ?? null,
      tax: (item.tax as string | undefined) ?? null,
      unitCost: (item.unitCost as string | undefined) ?? null,
      sortIndex: (item.sortIndex as number | undefined) ?? 0,
      note: (item.note as string | undefined) ?? null,
      totals: (item.totals as Record<string, unknown> | undefined) ?? {},
    };
  }

  private async createJobFromRfq(params: {
    sourceDocumentId: string;
    sourceEntity: Record<string, unknown>;
    sourceTenantId: string;
    recipientTenantId: string;
    versionNumber: number;
    tx: DrizzleDbOrTx;
  }): Promise<string> {
    const src = params.sourceEntity;
    const tx = params.tx;

    const jobTypeLookupId = await this.lookupResolution.resolve({
      tenantId: params.recipientTenantId,
      domain: 'job_type',
      externalReference: 'RFQ',
      name: 'RFQ',
      autoCreate: true,
      tx,
    });

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId: params.recipientTenantId,
      domain: 'job_status',
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    const jobData: Partial<JobInsert> = {
      tenantId: params.recipientTenantId,
      name: src.name as string | undefined,
      sourceTenantId: params.sourceTenantId,
      sourceOrganisationId: (src.issuerOrganisationId as string) ?? params.sourceTenantId,
      sourceExternalReference: src.rfqNumber as string | undefined,
      jobTypeLookupId: jobTypeLookupId!,
      statusLookupId: statusLookupId ?? undefined,
      apiPayload: { rfqPayload: src.rfqPayload, sourceRfqId: params.sourceDocumentId },
    };

    const internalNumber = await this.recordNumberService.next({
      tenantId: params.recipientTenantId,
      entity: 'job',
      tx,
    });
    jobData.internalNumber = internalNumber;
    this.logger.log(
      `DocumentIssuanceService.createJobFromRfq — assigned internalNumber=${internalNumber} for recipientTenant=${params.recipientTenantId}`,
    );

    const created = await this.jobsRepo.create({
      data: jobData as JobInsert,
      tx,
    });

    this.logger.log(
      `DocumentIssuanceService.createJobFromRfq — created job=${created.id} from rfq=${params.sourceDocumentId}`,
    );

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
    const tx = params.tx;

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId: params.recipientTenantId,
      domain: 'bill_status',
      externalReference: 'Received',
      name: 'Received',
      autoCreate: true,
      tx,
    });

    const billData: Partial<BillInsert> = {
      tenantId: params.recipientTenantId,
      invoiceId: params.sourceDocumentId,
      purchaseOrderId: src.purchaseOrderId as string | undefined,
      originType: 'tenant',
      billNumber: src.invoiceNumber as string | undefined,
      issueDate: src.issueDate as Date | undefined,
      receivedDate: new Date(),
      comments: src.comments as string | undefined,
      statusLookupId: statusLookupId ?? undefined,
      sourceTenantId: params.sourceTenantId,
      sourceOrganisationId: (src.issuerOrganisationId as string) ?? params.sourceTenantId,
      sourceExternalReference: src.invoiceNumber as string | undefined,
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
      tx,
    });

    this.logger.log(
      `DocumentIssuanceService.createBillFromInvoice — created bill=${created.id} from invoice=${params.sourceDocumentId}`,
    );

    return created.id;
  }
}
