import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  purchaseOrders,
  workOrders,
  quotes,
  quoteGroups,
  quoteCombos,
  quoteItems,
  proposals,
  organizations,
} from '../../../database/schema';
import {
  PoCustodyTransfersRepository,
  QuoteCustodyTransfersRepository,
} from '../../../database/repositories';

export interface CustodyTransferResult {
  transferredCount: number;
  purchaseOrderIds: string[];
  quoteIds?: string[];
}

@Injectable()
export class CustodyTransferService {
  private readonly logger = new Logger('CustodyTransferService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly custodyTransfersRepo: PoCustodyTransfersRepository,
    private readonly quoteCustodyTransfersRepo: QuoteCustodyTransfersRepository,
  ) {}

  async transferCustodialPurchaseOrders(params: {
    ghostOrganisationId: string;
    issuerTenantId: string;
    organisationClaimId: string;
    transferredByUserId: string;
    tx: DrizzleDbOrTx;
  }): Promise<CustodyTransferResult> {
    const { ghostOrganisationId, issuerTenantId, organisationClaimId, transferredByUserId, tx } =
      params;

    this.logger.log(
      `CustodyTransferService.transferCustodialPurchaseOrders — ghostOrg=${ghostOrganisationId} issuerTenant=${issuerTenantId}`,
    );

    const custodialPOs = await tx
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.issuerOrganisationId, ghostOrganisationId),
          eq(purchaseOrders.ownershipStatus, 'externally_captured'),
        ),
      );

    const transferredIds: string[] = [];

    for (const po of custodialPOs) {
      const originalCustodian = po.custodianTenantId ?? po.tenantId;

      await tx
        .update(purchaseOrders)
        .set({
          tenantId: issuerTenantId,
          issuerOrganisationId: issuerTenantId,
          custodianTenantId: null,
          ownershipStatus: 'transferred',
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, po.id));

      await this.custodyTransfersRepo.create({
        data: {
          purchaseOrderId: po.id,
          fromTenantId: originalCustodian,
          toTenantId: issuerTenantId,
          organisationClaimId,
          transferredByUserId,
        },
        tx,
      });

      await tx
        .update(workOrders)
        .set({
          sourceTenantId: issuerTenantId,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.purchaseOrderId, po.id));

      transferredIds.push(po.id);
    }

    await tx
      .update(organizations)
      .set({
        subscriptionStatus: 'verified',
        modified: new Date().toISOString(),
      })
      .where(eq(organizations.id, ghostOrganisationId));

    this.logger.log(
      `CustodyTransferService.transferCustodialPurchaseOrders — transferred ${transferredIds.length} POs`,
    );

    return {
      transferredCount: transferredIds.length,
      purchaseOrderIds: transferredIds,
    };
  }

  async transferCustodialQuotes(params: {
    ghostOrganisationId: string;
    issuerTenantId: string;
    organisationClaimId: string;
    transferredByUserId: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ transferredCount: number; quoteIds: string[] }> {
    const { ghostOrganisationId, issuerTenantId, organisationClaimId, transferredByUserId, tx } =
      params;

    this.logger.log(
      `CustodyTransferService.transferCustodialQuotes — ghostOrg=${ghostOrganisationId} issuerTenant=${issuerTenantId}`,
    );

    const custodialQuotes = await tx
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.issuerOrganisationId, ghostOrganisationId),
          eq(quotes.ownershipStatus, 'externally_captured'),
        ),
      );

    const transferredIds: string[] = [];

    for (const quote of custodialQuotes) {
      const originalCustodian = quote.custodianTenantId ?? quote.tenantId;

      await tx
        .update(quotes)
        .set({
          tenantId: issuerTenantId,
          issuerOrganisationId: issuerTenantId,
          custodianTenantId: null,
          ownershipStatus: 'transferred',
          updatedAt: new Date(),
        })
        .where(eq(quotes.id, quote.id));

      // Line items transfer with the quote (same tenant_id update)
      await tx
        .update(quoteGroups)
        .set({ tenantId: issuerTenantId, updatedAt: new Date() })
        .where(eq(quoteGroups.quoteId, quote.id));

      const groups = await tx
        .select({ id: quoteGroups.id })
        .from(quoteGroups)
        .where(eq(quoteGroups.quoteId, quote.id));
      const groupIds = groups.map((g) => g.id);

      if (groupIds.length > 0) {
        for (const groupId of groupIds) {
          await tx
            .update(quoteCombos)
            .set({ tenantId: issuerTenantId, updatedAt: new Date() })
            .where(eq(quoteCombos.quoteGroupId, groupId));

          await tx
            .update(quoteItems)
            .set({ tenantId: issuerTenantId, updatedAt: new Date() })
            .where(eq(quoteItems.quoteGroupId, groupId));

          const combos = await tx
            .select({ id: quoteCombos.id })
            .from(quoteCombos)
            .where(eq(quoteCombos.quoteGroupId, groupId));
          for (const combo of combos) {
            await tx
              .update(quoteItems)
              .set({ tenantId: issuerTenantId, updatedAt: new Date() })
              .where(eq(quoteItems.quoteComboId, combo.id));
          }
        }
      }

      await this.quoteCustodyTransfersRepo.create({
        data: {
          quoteId: quote.id,
          fromTenantId: originalCustodian,
          toTenantId: issuerTenantId,
          organisationClaimId,
          transferredByUserId,
        },
        tx,
      });

      // Proposal stays with buyer; update source_tenant_id only
      await tx
        .update(proposals)
        .set({
          sourceTenantId: issuerTenantId,
          updatedAt: new Date(),
        })
        .where(eq(proposals.quoteId, quote.id));

      transferredIds.push(quote.id);
    }

    this.logger.log(
      `CustodyTransferService.transferCustodialQuotes — transferred ${transferredIds.length} quotes`,
    );

    return {
      transferredCount: transferredIds.length,
      quoteIds: transferredIds,
    };
  }
}
