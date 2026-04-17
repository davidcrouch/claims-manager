import { Injectable, Optional, BadRequestException } from '@nestjs/common';
import { InvoicesRepository, type InvoiceInsert } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';

@Injectable()
export class InvoicesService {
  constructor(
    private readonly invoicesRepo: InvoicesRepository,
    private readonly tenantContext: TenantContext,
    private readonly crunchworkService: CrunchworkService,
    @Optional() private readonly connectionResolver?: ConnectionResolverService,
  ) {}

  private async resolveConnectionId(tenantId: string): Promise<string> {
    if (!this.connectionResolver) return tenantId;
    const connection = await this.connectionResolver.resolveForTenant({ tenantId });
    if (!connection) {
      throw new BadRequestException('No active CW connection for tenant');
    }
    return connection.id;
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    purchaseOrderId?: string;
    statusId?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      purchaseOrderId: params.purchaseOrderId,
      statusId: params.statusId,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findOne({ id: params.id, tenantId });
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.invoicesRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiInvoice = await this.crunchworkService.createInvoice({
      connectionId,
      body: params.body,
    });

    const apiObj = apiInvoice as Record<string, unknown>;
    const toNum = (v: unknown) => (v != null ? String(v) : undefined);
    const insertData: InvoiceInsert = {
      tenantId,
      purchaseOrderId: (apiObj.purchaseOrderId ?? apiObj.purchase_order_id ?? params.body?.purchaseOrderId) as string,
      claimId: apiObj.claimId as string,
      jobId: apiObj.jobId as string,
      invoiceNumber: apiObj.invoiceNumber as string,
      subTotal: toNum(apiObj.subTotal),
      totalTax: toNum(apiObj.totalTax),
      totalAmount: toNum(apiObj.totalAmount),
      invoicePayload: apiInvoice as Record<string, unknown>,
    };
    return this.invoicesRepo.create({ data: insertData });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    const existing = await this.findOne({ id: params.id });
    if (!existing) return null;

    const tenantId = this.tenantContext.getTenantId();
    const connectionId = await this.resolveConnectionId(tenantId);
    const apiInvoice = await this.crunchworkService.updateInvoice({
      connectionId,
      invoiceId: params.id,
      body: params.body,
    });

    return this.invoicesRepo.update({
      id: params.id,
      data: { invoicePayload: apiInvoice as Record<string, unknown> },
    });
  }
}
