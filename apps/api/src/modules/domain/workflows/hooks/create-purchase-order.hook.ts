import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../../database/drizzle.module';
import { proposals, purchaseOrders } from '../../../../database/schema';
import { PurchaseOrdersRepository } from '../../../../database/repositories';
import { LookupResolutionService } from '../../services/lookup-resolution.service';
import { RecordNumberService } from '../../../../common/record-number/record-number.service';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

@Injectable()
export class CreatePurchaseOrderHook implements OnEnterHook {
  name = 'createPurchaseOrder';
  private readonly logger = new Logger('CreatePurchaseOrderHook');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly purchaseOrdersRepo: PurchaseOrdersRepository,
    private readonly lookupResolution: LookupResolutionService,
    private readonly recordNumberService: RecordNumberService,
  ) {}

  async execute(context: WorkflowContext): Promise<void> {
    const logPrefix = 'CreatePurchaseOrderHook.execute';

    if (context.entityType !== 'proposal' || context.targetStep !== 'accepted') {
      return;
    }

    const [proposal] = await context.tx
      .select()
      .from(proposals)
      .where(eq(proposals.id, context.entityId))
      .limit(1);

    if (!proposal) {
      this.logger.warn(`${logPrefix} — proposal ${context.entityId} not found`);
      return;
    }

    const rfqId = proposal.rfqId;
    const vendorId = (proposal as any).vendorId ?? null;

    const statusLookupId = await this.lookupResolution.resolve({
      tenantId: context.tenantId,
      domain: 'purchase_order_status',
      externalReference: 'Draft',
      name: 'Draft',
      autoCreate: true,
      tx: context.tx,
    });

    const internalNumber = await this.recordNumberService.next({
      tenantId: context.tenantId,
      entity: 'purchase_order',
      tx: context.tx,
    });

    const poData = {
      tenantId: context.tenantId,
      claimId: proposal.claimId,
      jobId: proposal.jobId,
      vendorId,
      issuerOrganisationId: context.tenantId,
      recipientOrganisationId: proposal.sourceOrganisationId ?? null,
      internalNumber,
      purchaseOrderNumber: proposal.proposalNumber ?? null,
      name: proposal.name ? `PO for ${proposal.name}` : 'Auto-generated PO',
      statusLookupId,
      totalAmount: proposal.totalAmount,
      purchaseOrderPayload: {
        sourceProposalId: proposal.id,
        sourceRfqId: rfqId,
        autoCreated: true,
      },
      createdByUserId: context.userId,
      updatedByUserId: context.userId,
    };

    const po = await this.purchaseOrdersRepo.create({
      data: poData as any,
      tx: context.tx,
    });

    this.logger.log(
      `${logPrefix} — auto-created PO=${po.id} from accepted proposal=${proposal.id}`,
    );
  }
}
