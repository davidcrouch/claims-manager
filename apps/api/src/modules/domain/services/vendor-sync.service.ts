import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  VendorsRepository,
  type VendorInsert,
} from '../../../database/repositories';
import { GhostOrganisationService } from './ghost-organisation.service';
import { asString, isPlainObject } from '../transformers/transform-utils';

@Injectable()
export class VendorSyncService {
  private readonly logger = new Logger('VendorSyncService');

  constructor(
    private readonly vendorsRepo: VendorsRepository,
    private readonly ghostOrgService: GhostOrganisationService,
  ) {}

  /**
   * Upsert a vendor from a Crunchwork nested `vendor` object (job/PO payloads).
   * Keys local rows by `externalReference` (fallback: CW `id`).
   */
  async syncFromCrunchworkPayload(params: {
    tenantId: string;
    cwVendor: Record<string, unknown>;
    tx?: DrizzleDbOrTx;
  }): Promise<string | undefined> {
    const externalReference = this.resolveExternalReference(params.cwVendor);
    if (!externalReference) {
      this.logger.debug(
        'VendorSyncService.syncFromCrunchworkPayload — vendor payload missing externalReference and id, skipping',
      );
      return undefined;
    }

    const name =
      asString(params.cwVendor.name) ??
      asString(params.cwVendor.companyName) ??
      externalReference;

    const address = this.extractAddress(params.cwVendor);
    const phone =
      asString(params.cwVendor.phoneNumber) ??
      asString(params.cwVendor.phone) ??
      asString(params.cwVendor.mobilePhone);

    const email = asString(params.cwVendor.email);
    const abn = asString(params.cwVendor.abn);
    const legalName = asString(params.cwVendor.legalName ?? params.cwVendor.companyName);
    const tradingName = asString(params.cwVendor.tradingName);
    const emailDomain = email ? this.extractEmailDomain(email) : undefined;

    let organisationId: string | undefined;
    if (params.tx) {
      const orgResult = await this.ghostOrgService.resolveOrCreate({
        abn: abn ?? undefined,
        legalName: legalName ?? undefined,
        tradingName: tradingName ?? undefined,
        primaryEmail: email ?? undefined,
        emailDomain: emailDomain ?? undefined,
        phone: phone ?? undefined,
        tx: params.tx,
      });
      organisationId = orgResult.organisationId;
    }

    const vendorData: Omit<VendorInsert, 'tenantId' | 'externalReference'> = {
      name,
      address,
      contactDetails: this.extractContactDetails(params.cwVendor),
      vendorPayload: params.cwVendor,
      postcode: asString(address.postcode),
      state: asString(address.state),
      city: asString(address.city ?? address.suburb),
      country: asString(address.country),
      phone: phone ?? undefined,
      afterHoursPhone: asString(params.cwVendor.afterHoursPhone) ?? undefined,
      organisationId,
      isActive: true,
    };

    const row = await this.vendorsRepo.upsertByExternalReference({
      tenantId: params.tenantId,
      externalReference,
      data: vendorData,
      tx: params.tx,
    });

    this.logger.debug(
      `VendorSyncService.syncFromCrunchworkPayload — upserted vendor id=${row.id} externalReference=${externalReference} orgId=${organisationId}`,
    );

    return row.id;
  }

  async findByCrunchworkId(params: {
    tenantId: string;
    crunchworkId: string;
    tx?: DrizzleDbOrTx;
  }): Promise<string | undefined> {
    const row = await this.vendorsRepo.findByCrunchworkId({
      tenantId: params.tenantId,
      crunchworkId: params.crunchworkId,
      tx: params.tx,
    });
    return row?.id;
  }

  private resolveExternalReference(cwVendor: Record<string, unknown>): string | undefined {
    return (
      asString(cwVendor.externalReference) ??
      asString(cwVendor.id)
    );
  }

  private extractAddress(cwVendor: Record<string, unknown>): Record<string, unknown> {
    if (isPlainObject(cwVendor.address)) {
      return cwVendor.address as Record<string, unknown>;
    }
    return {};
  }

  private extractContactDetails(cwVendor: Record<string, unknown>): Record<string, unknown> {
    const details: Record<string, unknown> = {};
    const email = asString(cwVendor.email);
    const phone =
      asString(cwVendor.phoneNumber) ??
      asString(cwVendor.phone) ??
      asString(cwVendor.mobilePhone);
    if (email) details.email = email;
    if (phone) details.phone = phone;
    return details;
  }

  private extractEmailDomain(email: string): string | undefined {
    const parts = email.split('@');
    return parts.length === 2 ? parts[1].toLowerCase() : undefined;
  }
}
