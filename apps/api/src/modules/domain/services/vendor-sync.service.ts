import { Injectable, Logger } from '@nestjs/common';
import type { DrizzleDbOrTx } from '../../../database/drizzle.module';
import {
  VendorsRepository,
  type VendorInsert,
} from '../../../database/repositories';
import { asString, isPlainObject } from '../transformers/transform-utils';

@Injectable()
export class VendorSyncService {
  private readonly logger = new Logger('VendorSyncService');

  constructor(private readonly vendorsRepo: VendorsRepository) {}

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
      isActive: true,
    };

    const row = await this.vendorsRepo.upsertByExternalReference({
      tenantId: params.tenantId,
      externalReference,
      data: vendorData,
      tx: params.tx,
    });

    this.logger.debug(
      `VendorSyncService.syncFromCrunchworkPayload — upserted vendor id=${row.id} externalReference=${externalReference}`,
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
}
