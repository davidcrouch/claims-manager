import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull, aliasedTable } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { jobs, claims, organizations, lookupValues } from '../../../database/schema';
import type { DataMapper } from './base.mapper';
import { formatCurrency, formatDate, formatAddress } from './base.mapper';
import type { TemplateData } from '../types/document-types';

@Injectable()
export class JobMapper implements DataMapper {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async aggregate(params: { tenantId: string; entityId: string }): Promise<TemplateData> {
    const statusLookup = aliasedTable(lookupValues, 'job_status_lookup');
    const typeLookup = aliasedTable(lookupValues, 'job_type_lookup');

    const [row] = await this.db
      .select({
        job: jobs,
        statusName: statusLookup.name,
        jobTypeName: typeLookup.name,
      })
      .from(jobs)
      .leftJoin(statusLookup, eq(jobs.statusLookupId, statusLookup.id))
      .leftJoin(typeLookup, eq(jobs.jobTypeLookupId, typeLookup.id))
      .where(
        and(
          eq(jobs.id, params.entityId),
          eq(jobs.tenantId, params.tenantId),
          isNull(jobs.deletedAt),
        ),
      );
    if (!row) throw new NotFoundException('Job not found');

    const { job } = row;

    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, params.tenantId));

    let claimNumber = '';
    let claimReference = '';
    let dateOfLoss = '';
    let incidentDescription = '';
    if (job.claimId) {
      const [claim] = await this.db
        .select()
        .from(claims)
        .where(and(eq(claims.id, job.claimId), eq(claims.tenantId, params.tenantId)));
      if (claim) {
        claimNumber = claim.claimNumber ?? '';
        claimReference = claim.externalReference ?? '';
        dateOfLoss = formatDate(claim.dateOfLoss);
        incidentDescription = claim.incidentDescription ?? '';
      }
    }

    const address = job.address as Record<string, unknown>;
    const addressLine =
      formatAddress(address) ||
      [job.addressSuburb, job.addressState, job.addressPostcode, job.addressCountry]
        .filter(Boolean)
        .join(', ');

    return {
      company_name: org?.name ?? '',
      job_name: job.name ?? '',
      job_reference: job.externalReference ?? job.externalJobId ?? '',
      job_status: row.statusName ?? '',
      job_type: row.jobTypeName ?? '',
      request_date: formatDate(job.requestDate),
      excess: formatCurrency(job.excess),
      make_safe_required: job.makeSafeRequired == null ? '' : job.makeSafeRequired ? 'Yes' : 'No',
      job_instructions: job.jobInstructions ?? '',
      job_address: addressLine,
      address_suburb: job.addressSuburb ?? (address?.suburb as string) ?? '',
      address_state: job.addressState ?? (address?.state as string) ?? '',
      address_postcode: job.addressPostcode ?? (address?.postcode as string) ?? '',
      address_country: job.addressCountry ?? (address?.country as string) ?? '',
      claim_number: claimNumber,
      claim_reference: claimReference,
      date_of_loss: dateOfLoss,
      incident_description: incidentDescription,
      scope_of_work: job.jobInstructions ?? '',
      report_date: formatDate(new Date()),
    };
  }
}
