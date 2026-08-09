import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../../database/drizzle.module';
import {
  quotes, proposals, purchaseOrders, workOrders,
  invoices, bills, rfqs, jobs,
} from '../../../../database/schema';
import { LookupResolutionService } from '../../services/lookup-resolution.service';
import { LOOKUP_DOMAINS } from '../../constants/lookup-domains';
import type { OnEnterHook, WorkflowContext } from '../workflow.interface';

const STEP_TO_LOOKUP: Record<string, Record<string, { domain: string; name: string }>> = {
  quote: {
    draft:     { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Draft' },
    approved:  { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Approved' },
    published: { domain: LOOKUP_DOMAINS.QUOTE_STATUS, name: 'Pending' },
  },
  proposal: {
    received:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Received' },
    under_review: { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Under Review' },
    accepted:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Accepted' },
    declined:     { domain: LOOKUP_DOMAINS.PROPOSAL_STATUS, name: 'Declined' },
  },
  purchase_order: {
    draft:            { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Draft' },
    pending_approval: { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Pending Approval' },
    approved:         { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Approved' },
    issued:           { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Issued' },
    acknowledged:     { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Acknowledged' },
    closed:           { domain: LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS, name: 'Closed' },
  },
  work_order: {
    received:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Received' },
    accepted:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Accepted' },
    scheduled:   { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Scheduled' },
    in_progress: { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'In Progress' },
    completed:   { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Completed' },
    declined:    { domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS, name: 'Declined' },
  },
  job: {
    received:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Received' },
    accepted:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Accepted' },
    in_progress:        { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'In Progress' },
    on_hold:            { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'On Hold' },
    pending_completion: { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Pending Completion' },
    completed:          { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Completed' },
    declined:           { domain: LOOKUP_DOMAINS.JOB_STATUS, name: 'Declined' },
  },
  invoice: {
    draft:     { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Draft' },
    submitted: { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Submitted' },
    approved:  { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Approved' },
    declined:  { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Declined' },
    paid:      { domain: LOOKUP_DOMAINS.INVOICE_STATUS, name: 'Paid' },
  },
  bill: {
    received:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Received' },
    under_review: { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Under Review' },
    approved:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Approved' },
    declined:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Declined' },
    disputed:     { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Disputed' },
    paid:         { domain: LOOKUP_DOMAINS.BILL_STATUS, name: 'Paid' },
  },
  rfq: {
    draft:     { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Draft' },
    sent:      { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Sent' },
    responded: { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Responded' },
    closed:    { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Closed' },
    cancelled: { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Cancelled' },
    expired:   { domain: LOOKUP_DOMAINS.RFQ_STATUS, name: 'Expired' },
  },
};

const ENTITY_TABLE_MAP: Record<string, any> = {
  quote: quotes,
  proposal: proposals,
  purchase_order: purchaseOrders,
  work_order: workOrders,
  invoice: invoices,
  bill: bills,
  rfq: rfqs,
  job: jobs,
};

@Injectable()
export class SyncStatusLookupHook implements OnEnterHook {
  name = 'syncStatusLookup';
  private readonly logger = new Logger('SyncStatusLookupHook');

  constructor(
    private readonly lookupResolution: LookupResolutionService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async execute(context: WorkflowContext): Promise<void> {
    const mapping = STEP_TO_LOOKUP[context.entityType]?.[context.targetStep];
    if (!mapping) {
      this.logger.debug(
        `SyncStatusLookupHook.execute — no mapping for ${context.entityType}:${context.targetStep}`,
      );
      return;
    }

    const lookupId = await this.lookupResolution.resolve({
      tenantId: context.tenantId,
      domain: mapping.domain,
      externalReference: mapping.name,
      name: mapping.name,
      autoCreate: true,
      tx: context.tx,
    });

    if (!lookupId) {
      this.logger.warn(
        `SyncStatusLookupHook.execute — failed to resolve lookup for ${mapping.domain}:${mapping.name}`,
      );
      return;
    }

    const table = ENTITY_TABLE_MAP[context.entityType];
    if (!table) return;

    await context.tx
      .update(table)
      .set({ statusLookupId: lookupId, updatedAt: new Date() })
      .where(eq(table.id, context.entityId));
  }
}
