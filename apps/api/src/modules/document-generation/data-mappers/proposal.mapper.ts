import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import {
  proposals,
  proposalGroups,
  proposalItems,
  organizations,
} from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, formatQuantity } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ProposalMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [proposal] = await this.db
      .select()
      .from(proposals)
      .where(
        and(eq(proposals.id, params.entityId), eq(proposals.tenantId, params.tenantId)),
      );
    if (!proposal) throw new NotFoundException('Proposal not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const groups = await this.db
      .select()
      .from(proposalGroups)
      .where(
        and(
          eq(proposalGroups.proposalId, params.entityId),
          eq(proposalGroups.tenantId, params.tenantId),
        ),
      )
      .orderBy(asc(proposalGroups.sortIndex));

    const items = await this.db
      .select()
      .from(proposalItems)
      .where(eq(proposalItems.tenantId, params.tenantId))
      .orderBy(asc(proposalItems.sortIndex));

    const proposalTo = proposal.proposalTo as Record<string, unknown>;
    const proposalFrom = proposal.proposalFrom as Record<string, unknown>;
    const proposalFor = proposal.proposalFor as Record<string, unknown>;

    const groupData = groups.map((g) => {
      const groupItems = items
        .filter((i) => i.proposalGroupId === g.id)
        .map((i) => ({
          item_name: i.name ?? '',
          item_description: i.description ?? '',
          item_category: i.category ?? '',
          item_quantity: formatQuantity(i.quantity),
          item_unit_cost: formatCurrency(i.unitCost),
          item_tax: formatCurrency(i.tax),
          item_total: formatCurrency(
            i.unitCost && i.quantity ? parseFloat(i.unitCost) * parseFloat(i.quantity) : 0,
          ),
        }));

      return {
        group_name: g.description ?? '',
        group_subtotal: formatCurrency(
          (g.totals as Record<string, unknown>)?.subTotal as string ?? '0',
        ),
        items: groupItems,
      };
    });

    return {
      company_name: org?.name ?? '',
      proposal_number: proposal.proposalNumber ?? '',
      proposal_name: proposal.name ?? '',
      proposal_reference: proposal.reference ?? '',
      proposal_date: formatDate(proposal.proposalDate),
      received_date: formatDate(proposal.receivedDate),
      note: proposal.note ?? '',
      proposal_to_name: proposal.proposalToName ?? (proposalTo?.name as string) ?? '',
      proposal_to_email: proposal.proposalToEmail ?? (proposalTo?.email as string) ?? '',
      proposal_from_name: proposal.proposalFromName ?? (proposalFrom?.name as string) ?? '',
      proposal_for_name: (proposalFor?.name as string) ?? '',
      sub_total: formatCurrency(proposal.subTotal),
      total_tax: formatCurrency(proposal.totalTax),
      total_amount: formatCurrency(proposal.totalAmount),
      groups: groupData,
    };
  }
}
