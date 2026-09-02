import { Injectable, Logger, Inject } from '@nestjs/common';
import {
  WorkOrdersRepository,
  type WorkOrderViewRow,
} from '../../database/repositories';
import { DRIZZLE, type DrizzleDB } from '../../database/drizzle.module';
import { TenantContext } from '../../tenant/tenant-context';
import { LookupResolutionService } from '../domain/services/lookup-resolution.service';
import { LOOKUP_DOMAINS } from '../domain/constants/lookup-domains';
import { RecordNumberService } from '../../common/record-number/record-number.service';

@Injectable()
export class WorkOrdersService {
  private readonly logger = new Logger(WorkOrdersService.name);

  constructor(
    private readonly workOrdersRepo: WorkOrdersRepository,
    private readonly tenantContext: TenantContext,
    private readonly lookupResolution: LookupResolutionService,
    private readonly recordNumberService: RecordNumberService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    jobId?: string;
    jobIds?: string[];
    purchaseOrderId?: string;
    status?: string;
    workOrderType?: string;
    assignedToUserId?: string;
    assignedToUserIds?: string;
    search?: string;
    sort?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.workOrdersRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      jobId: params.jobId,
      jobIds: params.jobIds,
      purchaseOrderId: params.purchaseOrderId,
      status: params.status,
      workOrderType: params.workOrderType,
      assignedToUserId: params.assignedToUserId,
      assignedToUserIds: params.assignedToUserIds,
      search: params.search,
      sort: params.sort,
    });
    return {
      data: result.data.map((row) => this.shapeWorkOrderListItem(row)),
      total: result.total,
    };
  }

  async findFilterAssignees() {
    const tenantId = this.tenantContext.getTenantId();
    return this.workOrdersRepo.findFilterAssignees({ tenantId });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    const row = await this.workOrdersRepo.findOne({ id: params.id, tenantId });
    return row ? this.shapeWorkOrderListItem(row) : null;
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
      assigneeName,
      workOrderPayload: _payload,
      ...rest
    } = row;
    return {
      ...rest,
      assigneeName: assigneeName ?? null,
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
    const {
      createdByUserId: _c,
      updatedByUserId: _u,
      statusLookupId,
      internalNumber: bodyInternalNumber,
      workOrderNumber: bodyWorkOrderNumber,
      ...rest
    } = params.body;

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

    return this.db.transaction(async (tx) => {
      const internalNumber = await this.recordNumberService.resolve({
        tenantId,
        entity: 'work_order',
        explicit: bodyInternalNumber,
        tx,
      });
      const workOrderNumber = this.recordNumberService.isBlank(bodyWorkOrderNumber)
        ? null
        : String(bodyWorkOrderNumber).trim();

      return this.workOrdersRepo.create({
        data: {
          ...rest,
          tenantId,
          internalNumber,
          workOrderNumber,
          statusLookupId: resolvedStatusId,
          createdByUserId: params.userId ?? null,
          updatedByUserId: params.userId ?? null,
        } as any,
        tx,
      });
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
