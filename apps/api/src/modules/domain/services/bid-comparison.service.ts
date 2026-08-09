import { Injectable, Logger, Inject, NotFoundException, forwardRef } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  rfqs, proposals, proposalGroups, proposalCombos, proposalItems,
} from '../../../database/schema';
import { WorkflowEngineService } from '../workflows/workflow-engine.service';

export interface BidComparisonResult {
  rfq: {
    id: string;
    rfqNumber: string | null;
    name: string | null;
    totalItems: number;
  };
  proposals: Array<{
    id: string;
    proposalNumber: string | null;
    name: string | null;
    vendorName: string | null;
    subTotal: string | null;
    totalTax: string | null;
    totalAmount: string | null;
    status: string | null;
    receivedDate: Date | null;
    itemCount: number;
  }>;
}

export interface SelectWinnerResult {
  accepted: string;
  declined: string[];
}

@Injectable()
export class BidComparisonService {
  private readonly logger = new Logger('BidComparisonService');

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(forwardRef(() => WorkflowEngineService))
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  async compareProposalsForRfq(params: {
    rfqId: string;
    tenantId: string;
  }): Promise<BidComparisonResult> {
    const [rfq] = await this.db
      .select()
      .from(rfqs)
      .where(and(eq(rfqs.id, params.rfqId), eq(rfqs.tenantId, params.tenantId)))
      .limit(1);

    if (!rfq) {
      throw new NotFoundException(`RFQ ${params.rfqId} not found`);
    }

    const allProposals = await this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.rfqId, params.rfqId),
          eq(proposals.tenantId, params.tenantId),
        ),
      );

    const proposalData = await Promise.all(
      allProposals.map(async (p) => {
        const items = await this.db
          .select()
          .from(proposalItems)
          .innerJoin(proposalGroups, eq(proposalItems.proposalGroupId, proposalGroups.id))
          .where(eq(proposalGroups.proposalId, p.id));

        return {
          id: p.id,
          proposalNumber: p.proposalNumber,
          name: p.name,
          vendorName: p.proposalFromName ?? null,
          subTotal: p.subTotal,
          totalTax: p.totalTax,
          totalAmount: p.totalAmount,
          status: null as string | null,
          receivedDate: p.receivedDate,
          itemCount: items.length,
        };
      }),
    );

    return {
      rfq: {
        id: rfq.id,
        rfqNumber: rfq.rfqNumber,
        name: rfq.name,
        totalItems: 0,
      },
      proposals: proposalData,
    };
  }

  async selectWinner(params: {
    rfqId: string;
    proposalId: string;
    tenantId: string;
    userId: string;
  }): Promise<SelectWinnerResult> {
    const allProposals = await this.db
      .select()
      .from(proposals)
      .where(
        and(
          eq(proposals.rfqId, params.rfqId),
          eq(proposals.tenantId, params.tenantId),
        ),
      );

    if (!allProposals.find((p) => p.id === params.proposalId)) {
      throw new NotFoundException(`Proposal ${params.proposalId} not found for RFQ ${params.rfqId}`);
    }

    const declined: string[] = [];

    for (const proposal of allProposals) {
      const currentStep = await this.workflowEngine.getCurrentStep({
        tenantId: params.tenantId,
        entityType: 'proposal',
        entityId: proposal.id,
        workflowName: 'standard',
      });

      if (!currentStep || ['accepted', 'declined'].includes(currentStep)) {
        continue;
      }

      if (proposal.id === params.proposalId) {
        await this.workflowEngine.advance({
          tenantId: params.tenantId,
          entityType: 'proposal',
          entityId: proposal.id,
          workflowName: 'standard',
          action: 'accept',
          currentStep,
          userId: params.userId,
          entity: proposal as unknown as Record<string, unknown>,
          tx: this.db as any,
        });
      } else {
        await this.workflowEngine.advance({
          tenantId: params.tenantId,
          entityType: 'proposal',
          entityId: proposal.id,
          workflowName: 'standard',
          action: 'decline',
          currentStep,
          userId: params.userId,
          entity: proposal as unknown as Record<string, unknown>,
          tx: this.db as any,
        });
        declined.push(proposal.id);
      }
    }

    this.logger.log(
      `BidComparisonService.selectWinner — accepted=${params.proposalId} declined=${declined.length} proposals`,
    );

    return { accepted: params.proposalId, declined };
  }
}
