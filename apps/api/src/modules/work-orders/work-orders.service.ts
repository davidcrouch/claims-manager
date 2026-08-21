import { Injectable, Logger } from '@nestjs/common';
import {
  WorkOrdersRepository,
  type WorkOrderViewRow,
} from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';
import { LookupResolutionService } from '../domain/services/lookup-resolution.service';
import { LOOKUP_DOMAINS } from '../domain/constants/lookup-domains';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly lookupResolution: LookupResolutionService,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    purchaseOrderId?: string;
    status?: string;
    workOrderType?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      purchaseOrderId: params.purchaseOrderId,
      status: params.status,
      workOrderType: params.workOrderType,
      search: params.search,
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

  async create(params: { body: Record<string, unknown>; userId?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const { createdByUserId: _c, updatedByUserId: _u, statusLookupId, ...rest } =
      params.body;

    let resolvedStatusId =
      typeof statusLookupId === 'string' && statusLookupId.trim()
        ? statusLookupId
        : null;
    if (!resolvedStatusId) {
      resolvedStatusId = await this.lookupResolution.resolve({
        tenantId,
        domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS,
        externalReference: 'Open',
        name: 'Open',
        autoCreate: true,
      });
    }

    return this.workOrdersRepo.create({
      data: {
        ...rest,
        tenantId,
        statusLookupId: resolvedStatusId,
        createdByUserId: params.userId ?? null,
        updatedByUserId: params.userId ?? null,
      } as any,
    });
  }

  async update(params: {
    id: string;
    body: Record<string, unknown>;
    userId?: string;
  }) {
    const { createdByUserId: _c, updatedByUserId: _u, ...rest } = params.body;
    return this.workOrdersRepo.update({
      id: params.id,
      data: {
        ...rest,
        ...(params.userId ? { updatedByUserId: params.userId } : {}),
      } as any,
    });
  }
}
