import { Injectable, Logger, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  PurchaseOrdersRepository,
  WorkOrdersRepository,
  type PurchaseOrderInsert,
  type WorkOrderInsert,
} from '../../../database/repositories';
import { purchaseOrders, organizations } from '../../../database/schema';
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

@Injectable()
export class ManualCaptureService {
  private readonly logger = new Logger('ManualCaptureService');

  constructor(
    private readonly ghostOrgService: GhostOrganisationService,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly workOrdersRepo: WorkOrdersRepository,
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

    const hasIssuerIdentity =
      dto.issuer.organisationId ||
      dto.issuer.abn ||
      dto.issuer.email ||
      dto.issuer.legalName;
    if (!hasIssuerIdentity) {
      throw new BadRequestException(
        'At least one issuer identifier is required (organisationId, abn, email, or legalName)',
      );
    }

    return this.db.transaction(async (tx) => {
      // 1. Resolve or create ghost issuer
      let issuerOrgId: string;
      let issuerCreated = false;

      if (dto.issuer.organisationId) {
        const [org] = await tx
          .select()
          .from(organizations)
          .where(eq(organizations.id, dto.issuer.organisationId))
          .limit(1);
        if (!org) {
          throw new BadRequestException('Specified issuer organisation not found');
        }
        if (org.subscriptionStatus === 'active') {
          throw new BadRequestException(
            'The specified issuer is an active subscribed tenant. Use the standard PO issuance flow instead.',
          );
        }
        issuerOrgId = org.id;
      } else {
        const emailDomain = dto.issuer.email
          ? dto.issuer.email.split('@')[1]?.toLowerCase()
          : undefined;

        const result = await this.ghostOrgService.resolveOrCreate({
          abn: dto.issuer.abn,
          legalName: dto.issuer.legalName,
          tradingName: dto.issuer.tradingName,
          primaryEmail: dto.issuer.email,
          emailDomain,
          phone: dto.issuer.phone,
          tx,
        });

        if (result.isActive) {
          throw new BadRequestException(
            'The resolved issuer is an active subscribed tenant. Use the standard PO issuance flow instead.',
          );
        }

        issuerOrgId = result.organisationId;
        issuerCreated = result.created;
      }

      // 2. Check for duplicate PO (idempotency)
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

      // 3. Resolve WO status lookup for 'received'
      const statusLookupId = await this.lookupResolution.resolve({
        tenantId,
        domain: 'work_order_status',
        externalReference: 'received',
        name: 'Received',
        autoCreate: true,
        tx,
      });

      // 4. Create custodial PO
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

      // 5. Create abbreviated WO with perspective swap:
      //    PO issuer identity → WO "from"; receiving tenant → WO "to"
      const woFrom: Record<string, unknown> = {};
      if (dto.issuer.legalName) woFrom.name = dto.issuer.legalName;
      else if (dto.issuer.tradingName) woFrom.name = dto.issuer.tradingName;
      if (dto.issuer.abn) woFrom.abn = dto.issuer.abn;
      if (dto.issuer.email) woFrom.email = dto.issuer.email;
      if (dto.issuer.phone) woFrom.phone = dto.issuer.phone;

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
}
