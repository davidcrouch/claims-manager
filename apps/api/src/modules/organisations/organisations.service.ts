import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import {
  OrganisationClaimsRepository,
  PoCustodyTransfersRepository,
} from '../../database/repositories';
import { GhostOrganisationService } from '../domain/services/ghost-organisation.service';
import { CustodyTransferService } from '../domain/services/custody-transfer.service';

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger('OrganisationsService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly ghostOrgService: GhostOrganisationService,
    private readonly custodyTransferService: CustodyTransferService,
    private readonly orgClaimsRepo: OrganisationClaimsRepository,
  ) {}

  async getMe(tenantId: string): Promise<{ id: string; name: string; tradingName: string | null }> {
    const LOG = 'OrganisationsService.getMe';
    const [org] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        tradingName: organizations.tradingName,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      this.logger.warn(`${LOG} — org not found tenantId=${tenantId}`);
      return { id: tenantId, name: '', tradingName: null };
    }

    return org;
  }

  async listGhosts(params: { tenantId: string }) {
    return this.ghostOrgService.findGhostsByTenant({ tenantId: params.tenantId });
  }

  async initiateClaim(params: {
    ghostOrganisationId: string;
    claimingTenantId: string;
    initiatedByUserId: string;
  }) {
    const { ghostOrganisationId, claimingTenantId, initiatedByUserId } = params;

    this.logger.log(
      `OrganisationsService.initiateClaim — ghostOrg=${ghostOrganisationId} claimingTenant=${claimingTenantId}`,
    );

    const [ghostOrg] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, ghostOrganisationId))
      .limit(1);

    if (!ghostOrg) {
      throw new BadRequestException('Ghost organisation not found');
    }
    if (ghostOrg.subscriptionStatus !== 'ghost') {
      throw new BadRequestException('Organisation is not a ghost — cannot claim');
    }

    // Check for ABN auto-match: if claiming tenant has the same ABN as ghost, auto-approve
    const [claimingOrg] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, claimingTenantId))
      .limit(1);

    const abnMatch =
      ghostOrg.abn &&
      claimingOrg?.abn &&
      ghostOrg.abn.replace(/\s/g, '') === claimingOrg.abn.replace(/\s/g, '');

    if (abnMatch) {
      this.logger.log(
        `OrganisationsService.initiateClaim — ABN match detected (${ghostOrg.abn}), auto-approving`,
      );

      const claim = await this.orgClaimsRepo.create({
        data: {
          ghostOrganisationId,
          claimingTenantId,
          status: 'pending',
          verificationMethod: 'abn_match',
          evidence: { abn: ghostOrg.abn, matchedAt: new Date().toISOString() },
        },
      });

      const result = await this.approveClaim({
        claimId: claim.id,
        reviewedByUserId: initiatedByUserId,
        verificationMethod: 'abn_match',
      });

      return { ...claim, ...result, autoApproved: true };
    }

    const claim = await this.orgClaimsRepo.create({
      data: {
        ghostOrganisationId,
        claimingTenantId,
        status: 'pending',
      },
    });

    return { ...claim, autoApproved: false };
  }

  async listClaims(params: { tenantId: string }) {
    return this.orgClaimsRepo.findByClaimingTenant({
      claimingTenantId: params.tenantId,
    });
  }

  async approveClaim(params: {
    claimId: string;
    reviewedByUserId: string;
    verificationMethod?: string;
  }) {
    const { claimId, reviewedByUserId, verificationMethod } = params;

    this.logger.log(
      `OrganisationsService.approveClaim — claimId=${claimId}`,
    );

    const claim = await this.orgClaimsRepo.findOne({ id: claimId });
    if (!claim) {
      throw new BadRequestException('Claim not found');
    }
    if (claim.status !== 'pending' && claim.status !== 'under_review') {
      throw new BadRequestException(`Claim is in state '${claim.status}' — cannot approve`);
    }

    return this.db.transaction(async (tx) => {
      // 1. Approve the claim with verification metadata
      await this.orgClaimsRepo.update({
        id: claimId,
        data: {
          status: 'approved',
          verificationMethod: verificationMethod ?? 'admin_approval',
          reviewedByUserId,
          reviewedAt: new Date(),
        },
        tx,
      });

      // 2. Merge ghost identity fields into the claiming tenant's org (fill gaps only)
      const [ghostOrg] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, claim.ghostOrganisationId))
        .limit(1);

      const [claimingOrg] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, claim.claimingTenantId))
        .limit(1);

      if (ghostOrg && claimingOrg) {
        const mergeUpdates: Record<string, unknown> = {};
        if (!claimingOrg.abn && ghostOrg.abn) mergeUpdates.abn = ghostOrg.abn;
        if (!claimingOrg.legalName && ghostOrg.legalName) mergeUpdates.legalName = ghostOrg.legalName;
        if (!claimingOrg.tradingName && ghostOrg.tradingName) mergeUpdates.tradingName = ghostOrg.tradingName;
        if (!claimingOrg.primaryEmail && ghostOrg.primaryEmail) mergeUpdates.primaryEmail = ghostOrg.primaryEmail;
        if (!claimingOrg.emailDomain && ghostOrg.emailDomain) mergeUpdates.emailDomain = ghostOrg.emailDomain;
        if (!claimingOrg.phone && ghostOrg.phone) mergeUpdates.phone = ghostOrg.phone;

        if (Object.keys(mergeUpdates).length > 0) {
          await tx
            .update(organizations)
            .set({ ...mergeUpdates, modified: new Date().toISOString() })
            .where(eq(organizations.id, claim.claimingTenantId));

          this.logger.log(
            `OrganisationsService.approveClaim — merged ${Object.keys(mergeUpdates).join(', ')} from ghost into claiming tenant`,
          );
        }
      }

      // 3. Transfer custodial POs
      const result = await this.custodyTransferService.transferCustodialPurchaseOrders({
        ghostOrganisationId: claim.ghostOrganisationId,
        issuerTenantId: claim.claimingTenantId,
        organisationClaimId: claimId,
        transferredByUserId: reviewedByUserId,
        tx,
      });

      return {
        claimId,
        status: 'approved',
        ...result,
      };
    });
  }

  async rejectClaim(params: {
    claimId: string;
    reviewedByUserId: string;
    notes?: string;
  }) {
    const { claimId, reviewedByUserId, notes } = params;

    const claim = await this.orgClaimsRepo.findOne({ id: claimId });
    if (!claim) {
      throw new BadRequestException('Claim not found');
    }

    await this.orgClaimsRepo.update({
      id: claimId,
      data: {
        status: 'rejected',
        reviewedByUserId,
        reviewedAt: new Date(),
        notes: notes ?? null,
      },
    });

    return { claimId, status: 'rejected' };
  }
}
