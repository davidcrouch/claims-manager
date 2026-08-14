import { Injectable, Logger, BadRequestException, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { organizations } from '../../database/schema';
import {
  OrganisationClaimsRepository,
} from '../../database/repositories';
import { GhostOrganisationService } from '../domain/services/ghost-organisation.service';
import { CustodyTransferService } from '../domain/services/custody-transfer.service';
import type { UpdateOrganisationDto } from './dto/update-organisation.dto';

export type OrganisationProfile = {
  id: string;
  name: string;
  abn: string | null;
  primaryEmail: string | null;
  phone: string | null;
  address: string | null;
  tradingName: string | null;
};

function blankToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function addressFromConfig(config: unknown): string | null {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  const address = (config as Record<string, unknown>).address;
  return typeof address === 'string' && address.trim() ? address.trim() : null;
}

function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === '23505' || e?.cause?.code === '23505';
}

@Injectable()
export class OrganisationsService {
  private readonly logger = new Logger('OrganisationsService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly ghostOrgService: GhostOrganisationService,
    private readonly custodyTransferService: CustodyTransferService,
    private readonly orgClaimsRepo: OrganisationClaimsRepository,
  ) {}

  async getMe(tenantId: string): Promise<OrganisationProfile> {
    const LOG = 'OrganisationsService.getMe';
    const [org] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        tradingName: organizations.tradingName,
        abn: organizations.abn,
        primaryEmail: organizations.primaryEmail,
        phone: organizations.phone,
        config: organizations.config,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!org) {
      this.logger.warn(`${LOG} — org not found tenantId=${tenantId}`);
      return {
        id: tenantId,
        name: '',
        tradingName: null,
        abn: null,
        primaryEmail: null,
        phone: null,
        address: null,
      };
    }

    return {
      id: org.id,
      name: org.name,
      tradingName: org.tradingName,
      abn: org.abn,
      primaryEmail: org.primaryEmail,
      phone: org.phone,
      address: addressFromConfig(org.config),
    };
  }

  async updateMe(params: {
    tenantId: string;
    userId: string;
    dto: UpdateOrganisationDto;
  }): Promise<OrganisationProfile> {
    const LOG = 'OrganisationsService.updateMe';
    const { tenantId, userId, dto } = params;

    const [existing] = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
        config: organizations.config,
      })
      .from(organizations)
      .where(eq(organizations.id, tenantId))
      .limit(1);

    if (!existing) {
      this.logger.warn(`${LOG} — org not found tenantId=${tenantId}`);
      throw new BadRequestException('Organisation not found');
    }

    const name = blankToNull(dto.name);
    if (name === null) {
      throw new BadRequestException('Company name is required');
    }

    const updates: Record<string, unknown> = {
      modified: new Date().toISOString(),
      modifiedBy: userId,
    };

    if (name !== undefined) {
      updates.name = name;
      updates.tradingName = name;
    }
    if (dto.abn !== undefined) updates.abn = blankToNull(dto.abn);
    if (dto.primaryEmail !== undefined) updates.primaryEmail = blankToNull(dto.primaryEmail);
    if (dto.phone !== undefined) updates.phone = blankToNull(dto.phone);
    if (dto.address !== undefined) {
      const currentConfig =
        existing.config && typeof existing.config === 'object' && !Array.isArray(existing.config)
          ? { ...(existing.config as Record<string, unknown>) }
          : {};
      const nextAddress = blankToNull(dto.address);
      if (nextAddress) currentConfig.address = nextAddress;
      else delete currentConfig.address;
      updates.config = currentConfig;
    }

    try {
      await this.db
        .update(organizations)
        .set(updates)
        .where(eq(organizations.id, tenantId));
    } catch (err) {
      if (isUniqueViolation(err)) {
        this.logger.warn(`${LOG} — duplicate ABN tenantId=${tenantId}`);
        throw new BadRequestException('An organisation with this ABN already exists');
      }
      throw err;
    }

    this.logger.log(`${LOG} — updated tenantId=${tenantId}`);
    return this.getMe(tenantId);
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
      const poResult = await this.custodyTransferService.transferCustodialPurchaseOrders({
        ghostOrganisationId: claim.ghostOrganisationId,
        issuerTenantId: claim.claimingTenantId,
        organisationClaimId: claimId,
        transferredByUserId: reviewedByUserId,
        tx,
      });

      // 4. Transfer custodial Quotes/Estimates
      const quoteResult = await this.custodyTransferService.transferCustodialQuotes({
        ghostOrganisationId: claim.ghostOrganisationId,
        issuerTenantId: claim.claimingTenantId,
        organisationClaimId: claimId,
        transferredByUserId: reviewedByUserId,
        tx,
      });

      return {
        claimId,
        status: 'approved',
        transferredCount: poResult.transferredCount + quoteResult.transferredCount,
        purchaseOrderIds: poResult.purchaseOrderIds,
        quoteIds: quoteResult.quoteIds,
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
