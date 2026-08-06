import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { claims, organizations } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatDate, formatAddress } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class ClaimMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const [claim] = await this.db
      .select()
      .from(claims)
      .where(and(eq(claims.id, params.entityId), eq(claims.tenantId, params.tenantId)));
    if (!claim) throw new NotFoundException('Claim not found');

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    const addressLine = formatAddress(claim.address as Record<string, unknown>);

    return {
      company_name: org?.name ?? '',
      claim_number: claim.claimNumber ?? '',
      external_reference: claim.externalReference ?? '',
      status: '',
      lodgement_date: formatDate(claim.lodgementDate),
      date_of_loss: formatDate(claim.dateOfLoss),
      incident_description: claim.incidentDescription ?? '',
      address: addressLine,
      policy_number: claim.policyNumber ?? '',
      policy_name: claim.policyName ?? '',
      abn: claim.abn ?? '',
      vulnerable_customer: claim.vulnerableCustomer ? 'Yes' : 'No',
      total_loss: claim.totalLoss ? 'Yes' : 'No',
      contentious_claim: claim.contentiousClaim ? 'Yes' : 'No',
      report_date: formatDate(new Date()),
    };
  }
}
