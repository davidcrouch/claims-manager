import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import { purchaseOrders, workOrders, organizations } from '../../../database/schema';
import {
  PoCustodyTransfersRepository,
  OrganisationClaimsRepository,
} from '../../../database/repositories';

export interface CustodyTransferResult {
  transferredCount: number;
  purchaseOrderIds: string[];
}

@Injectable()
export class CustodyTransferService {
  private readonly logger = new Logger('CustodyTransferService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly custodyTransfersRepo: PoCustodyTransfersRepository,
    private readonly orgClaimsRepo: OrganisationClaimsRepository,
  ) {}

  async transferCustodialPurchaseOrders(params: {
    ghostOrganisationId: string;
    issuerTenantId: string;
    organisationClaimId: string;
    transferredByUserId: string;
    tx: DrizzleDbOrTx;
  }): Promise<CustodyTransferResult> {
    const { ghostOrganisationId, issuerTenantId, organisationClaimId, transferredByUserId, tx } = params;

    this.logger.log(
      `CustodyTransferService.transferCustodialPurchaseOrders — ghostOrg=${ghostOrganisationId} issuerTenant=${issuerTenantId}`,
    );

    // 1. Find all externally captured POs for this ghost org
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

    // 2. Transfer each PO
    for (const po of custodialPOs) {
      const originalCustodian = po.custodianTenantId ?? po.tenantId;

      // 2a. Update the PO
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

      // 2b. Log the transfer
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

      // 2c. Update linked WOs: set source_tenant_id to the new issuer tenant
      await tx
        .update(workOrders)
        .set({
          sourceTenantId: issuerTenantId,
          updatedAt: new Date(),
        })
        .where(eq(workOrders.purchaseOrderId, po.id));

      transferredIds.push(po.id);
    }

    // 3. Update ghost org status to verified
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
}
