import { Injectable, Logger } from '@nestjs/common';
import {
  WorkOrdersRepository,
  type WorkOrderViewRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    purchaseOrderId?: string;
    status?: string;
    workOrderType?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      purchaseOrderId: params.purchaseOrderId,
      status: params.status,
      workOrderType: params.workOrderType,
      sort: params.sort,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findOne({ id: params.id, tenantId });
  }

  async findByJob(params: { jobId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.debug(
      `api:WorkOrdersService.findByJob jobId=${params.jobId} tenantId=${tenantId}`,
    );
    const rows = await this.workOrdersRepo.findByJob({
      jobId: params.jobId,
      tenantId,
    });
    return rows.map((row) => this.shapeWorkOrderListItem(row));
  }

  private shapeWorkOrderListItem(row: WorkOrderViewRow) {
    const {
      statusName,
      statusExternalReference,
      workOrderTypeName,
      workOrderTypeExternalReference,
      workOrderPayload: _payload,
      ...rest
    } = row;
    return {
      ...rest,
      status: row.statusLookupId
        ? {
            id: row.statusLookupId,
            name: statusName ?? undefined,
            externalReference: statusExternalReference ?? undefined,
          }
        : undefined,
      workOrderType: row.workOrderTypeLookupId
        ? {
            id: row.workOrderTypeLookupId,
            name: workOrderTypeName ?? undefined,
            externalReference: workOrderTypeExternalReference ?? undefined,
          }
        : undefined,
    };
  }

  async findByPurchaseOrder(params: { purchaseOrderId: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findByPurchaseOrder({
      purchaseOrderId: params.purchaseOrderId,
      tenantId,
    });
  }

  async create(params: { body: Record<string, unknown> }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.create({ data: { ...params.body, tenantId } as any });
  }

  async update(params: { id: string; body: Record<string, unknown> }) {
    return this.workOrdersRepo.update({ id: params.id, data: params.body as any });
  }
}
