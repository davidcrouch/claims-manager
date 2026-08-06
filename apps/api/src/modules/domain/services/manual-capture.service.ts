import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB, type DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  PurchaseOrdersRepository,
  WorkOrdersRepository,
  QuotesRepository,
  ProposalsRepository,
  type PurchaseOrderInsert,
  type WorkOrderInsert,
  type QuoteInsert,
  type ProposalInsert,
} from '../../../database/repositories';
import { purchaseOrders, quotes, organizations } from '../../../database/schema';
import { GhostOrganisationService } from './ghost-organisation.service';
import { LookupResolutionService } from './lookup-resolution.service';

export interface CapturePurchaseOrderDto {
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;
  };
  purchaseOrderNumber: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  note?: string;
  scopeOfWork?: string;
  totalAmount?: number;
  jobId?: string;
  claimId?: string;
  sourceDocumentId?: string;
}

export interface CapturePurchaseOrderResponse {
  purchaseOrderId: string;
  workOrderId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}

export interface CaptureEstimateDto {
  issuer: {
    abn?: string;
    legalName?: string;
    tradingName?: string;
    email?: string;
    phone?: string;
    organisationId?: string;
  };
  quoteNumber?: string;
  name: string;
  reference?: string;
  note?: string;
  quoteDate?: string;
  expiresInDays?: number;
  subTotal?: number;
  totalTax?: number;
  totalAmount?: number;
  jobId?: string;
  claimId?: string;
  rfqId?: string;
  sourceDocumentId?: string;
}

export interface CaptureEstimateResponse {
  quoteId: string;
  proposalId: string;
  issuerOrganisationId: string;
  issuerCreated: boolean;
}

@Injectable()
export class ManualCaptureService {
  private readonly logger = new Logger('ManualCaptureService');

  constructor(
    private readonly ghostOrgService: GhostOrganisationService,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly quotesRepo: QuotesRepository,
    private readonly proposalsRepo: ProposalsRepository,
    private readonly lookupResolution: LookupResolutionService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async capturePurchaseOrder(params: {
    tenantId: string;
    userId: string;
    dto: CapturePurchaseOrderDto;
  }): Promise<CapturePurchaseOrderResponse> {
    const { tenantId, userId, dto } = params;

    this.logger.log(
      `ManualCaptureService.capturePurchaseOrder — tenantId=${tenantId} poNumber=${dto.purchaseOrderNumber}`,
    );

    if (!dto.jobId && !dto.claimId) {
      throw new BadRequestException('Either jobId or claimId is required');
    }

    if (!dto.purchaseOrderNumber) {
      throw new BadRequestException('purchaseOrderNumber is required');
    }

    if (!this.hasIssuerIdentity(dto.issuer)) {
      throw new BadRequestException(
        'At least one issuer identifier is required (organisationId, abn, email, or legalName)',
      );
    }

    return this.db.transaction(async (tx) => {
      const { issuerOrgId, issuerCreated } = await this.resolveGhostIssuer({
        issuer: dto.issuer,
        activeTenantError:
          'The specified issuer is an active subscribed tenant. Use the standard PO issuance flow instead.',
        tx,
      });

      const [existingPo] = await tx
        .select()
        .from(purchaseOrders)
        .where(
          and(
            eq(purchaseOrders.issuerOrganisationId, issuerOrgId),
            eq(purchaseOrders.purchaseOrderNumber, dto.purchaseOrderNumber),
            isNull(purchaseOrders.deletedAt),
          ),
        )
        .limit(1);

      if (existingPo) {
        this.logger.log(
          `ManualCaptureService.capturePurchaseOrder — duplicate PO found id=${existingPo.id}`,
        );
        const linkedWos = await this.workOrdersRepo.findByPurchaseOrder({
          purchaseOrderId: existingPo.id,
          tenantId,
        });
        if (!linkedWos.length) {
          throw new BadRequestException(
            `A PO with number '${dto.purchaseOrderNumber}' already exists for this issuer but has no linked Work Order. Contact support.`,
          );
        }
        return {
          purchaseOrderId: existingPo.id,
          workOrderId: linkedWos[0].id,
          issuerOrganisationId: issuerOrgId,
          issuerCreated: false,
        };
      }

      const statusLookupId = await this.lookupResolution.resolve({
        tenantId,
        domain: 'work_order_status',
        externalReference: 'received',
        name: 'Received',
        autoCreate: true,
        tx,
      });

      const poData: PurchaseOrderInsert = {
        tenantId,
        claimId: dto.claimId ?? null,
        jobId: dto.jobId ?? null,
        issuerOrganisationId: issuerOrgId,
        recipientOrganisationId: tenantId,
        custodianTenantId: tenantId,
        captureMethod: 'manual',
        ownershipStatus: 'externally_captured',
        purchaseOrderNumber: dto.purchaseOrderNumber,
        name: dto.name ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        note: dto.note ?? null,
        scopeOfWork: dto.scopeOfWork ?? null,
        totalAmount: dto.totalAmount != null ? String(dto.totalAmount) : null,
        createdByUserId: userId,
        updatedByUserId: userId,
      };

      const po = await this.purchaseOrdersRepo.create({ data: poData, tx });

      const woFrom = this.buildIssuerPartySnapshot(dto.issuer);

      const woData: WorkOrderInsert = {
        tenantId,
        purchaseOrderId: po.id,
        claimId: dto.claimId ?? null,
        jobId: dto.jobId ?? null,
        sourceOrganisationId: issuerOrgId,
        sourceTenantId: null,
        workOrderNumber: dto.purchaseOrderNumber,
        name: dto.name ?? null,
        statusLookupId: statusLookupId ?? null,
        startDate: dto.startDate ?? null,
        endDate: dto.endDate ?? null,
        note: dto.note ?? null,
        scopeOfWork: dto.scopeOfWork ?? null,
        totalAmount: dto.totalAmount != null ? String(dto.totalAmount) : null,
        woTo: {},
        woFor: {},
        woFrom,
        versionAcknowledged: true,
        createdByUserId: userId,
        updatedByUserId: userId,
      };

      const wo = await this.workOrdersRepo.create({ data: woData, tx });

      this.logger.log(
        `ManualCaptureService.capturePurchaseOrder — created PO=${po.id} WO=${wo.id} ghost=${issuerOrgId}`,
      );

      return {
        purchaseOrderId: po.id,
        workOrderId: wo.id,
        issuerOrganisationId: issuerOrgId,
        issuerCreated,
      };
    });
  }

  async captureEstimate(params: {
    tenantId: string;
    userId: string;
    dto: CaptureEstimateDto;
  }): Promise<CaptureEstimateResponse> {
    const { tenantId, userId, dto } = params;

    this.logger.log(
      `ManualCaptureService.captureEstimate — tenantId=${tenantId} name=${dto.name}`,
    );

    if (!dto.jobId && !dto.claimId) {
      throw new BadRequestException('Either jobId or claimId is required');
    }

    if (!dto.name?.trim()) {
      throw new BadRequestException('name is required');
    }

    if (!this.hasIssuerIdentity(dto.issuer)) {
      throw new BadRequestException(
        'At least one issuer identifier is required (organisationId, abn, email, or legalName)',
      );
    }

    return this.db.transaction(async (tx) => {
      const { issuerOrgId, issuerCreated } = await this.resolveGhostIssuer({
        issuer: dto.issuer,
        activeTenantError:
          'The specified issuer is an active subscribed tenant. Use the standard estimate issuance flow instead.',
        tx,
      });

      if (dto.quoteNumber) {
        const [existingQuote] = await tx
          .select()
          .from(quotes)
          .where(
            and(
              eq(quotes.issuerOrganisationId, issuerOrgId),
              eq(quotes.quoteNumber, dto.quoteNumber),
              isNull(quotes.deletedAt),
            ),
          )
          .limit(1);

        if (existingQuote) {
          this.logger.log(
            `ManualCaptureService.captureEstimate — duplicate quote found id=${existingQuote.id}`,
          );
          const linked = await this.proposalsRepo.findByQuote({
            quoteId: existingQuote.id,
            tenantId,
            tx,
          });
          if (!linked.length) {
            throw new BadRequestException(
              `An estimate with number '${dto.quoteNumber}' already exists for this issuer but has no linked Proposal. Contact support.`,
            );
          }
          return {
            quoteId: existingQuote.id,
            proposalId: linked[0].id,
            issuerOrganisationId: issuerOrgId,
            issuerCreated: false,
          };
        }
      }

      const proposalStatusLookupId = await this.lookupResolution.resolve({
        tenantId,
        domain: 'proposal_status',
        externalReference: 'Received',
        name: 'Received',
        autoCreate: true,
        tx,
      });

      const quoteFrom = this.buildIssuerPartySnapshot(dto.issuer);

      const quoteData: QuoteInsert = {
        tenantId,
        claimId: dto.claimId ?? null,
        jobId: dto.jobId ?? null,
        issuerOrganisationId: issuerOrgId,
        recipientOrganisationId: tenantId,
        custodianTenantId: tenantId,
        captureMethod: 'manual',
        ownershipStatus: 'externally_captured',
        quoteNumber: dto.quoteNumber ?? null,
        name: dto.name,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        quoteDate: dto.quoteDate ? new Date(dto.quoteDate) : null,
        expiresInDays: dto.expiresInDays ?? null,
        subTotal: dto.subTotal != null ? String(dto.subTotal) : null,
        totalTax: dto.totalTax != null ? String(dto.totalTax) : null,
        totalAmount: dto.totalAmount != null ? String(dto.totalAmount) : null,
        quoteFrom,
        quoteTo: {},
        quoteFor: {},
        createdByUserId: userId,
        updatedByUserId: userId,
      };

      const quote = await this.quotesRepo.create({ data: quoteData, tx });

      const proposalData: ProposalInsert = {
        tenantId,
        quoteId: quote.id,
        claimId: dto.claimId ?? null,
        jobId: dto.jobId ?? null,
        rfqId: dto.rfqId ?? null,
        sourceTenantId: null,
        sourceOrganisationId: issuerOrgId,
        proposalNumber: dto.quoteNumber ?? null,
        name: dto.name,
        reference: dto.reference ?? null,
        note: dto.note ?? null,
        statusLookupId: proposalStatusLookupId ?? null,
        receivedDate: new Date(),
        proposalDate: dto.quoteDate ? new Date(dto.quoteDate) : null,
        expiresInDays: dto.expiresInDays ?? null,
        subTotal: dto.subTotal != null ? String(dto.subTotal) : null,
        totalTax: dto.totalTax != null ? String(dto.totalTax) : null,
        totalAmount: dto.totalAmount != null ? String(dto.totalAmount) : null,
        proposalFrom: quoteFrom,
        proposalTo: {},
        proposalFor: {},
        proposalFromName: (quoteFrom.name as string | undefined) ?? null,
        versionAcknowledged: true,
        createdByUserId: userId,
        updatedByUserId: userId,
      };

      const proposal = await this.proposalsRepo.create({ data: proposalData, tx });

      this.logger.log(
        `ManualCaptureService.captureEstimate — created quote=${quote.id} proposal=${proposal.id} ghost=${issuerOrgId}`,
      );

      return {
        quoteId: quote.id,
        proposalId: proposal.id,
        issuerOrganisationId: issuerOrgId,
        issuerCreated,
      };
    });
  }

  private hasIssuerIdentity(issuer: CaptureEstimateDto['issuer']): boolean {
    return !!(issuer.organisationId || issuer.abn || issuer.email || issuer.legalName);
  }

  private buildIssuerPartySnapshot(issuer: CaptureEstimateDto['issuer']): Record<string, unknown> {
    const party: Record<string, unknown> = {};
    if (issuer.legalName) party.name = issuer.legalName;
    else if (issuer.tradingName) party.name = issuer.tradingName;
    if (issuer.abn) party.abn = issuer.abn;
    if (issuer.email) party.email = issuer.email;
    if (issuer.phone) party.phone = issuer.phone;
    return party;
  }

  private async resolveGhostIssuer(params: {
    issuer: CaptureEstimateDto['issuer'];
    activeTenantError: string;
    tx: DrizzleDbOrTx;
  }): Promise<{ issuerOrgId: string; issuerCreated: boolean }> {
    const { issuer, activeTenantError, tx } = params;

    if (issuer.organisationId) {
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, issuer.organisationId))
        .limit(1);
      if (!org) {
        throw new BadRequestException('Specified issuer organisation not found');
      }
      if (org.subscriptionStatus === 'active') {
        throw new BadRequestException(activeTenantError);
      }
      return { issuerOrgId: org.id, issuerCreated: false };
    }

    const emailDomain = issuer.email
      ? issuer.email.split('@')[1]?.toLowerCase()
      : undefined;

    const result = await this.ghostOrgService.resolveOrCreate({
      abn: issuer.abn,
      legalName: issuer.legalName,
      tradingName: issuer.tradingName,
      primaryEmail: issuer.email,
      emailDomain,
      phone: issuer.phone,
      tx,
    });

    if (result.isActive) {
      throw new BadRequestException(activeTenantError);
    }

    return { issuerOrgId: result.organisationId, issuerCreated: result.created };
  }
}
