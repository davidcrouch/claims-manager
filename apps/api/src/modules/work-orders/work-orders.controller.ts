import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { WorkOrdersService } from './work-orders.service';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly catalogSelectionService: CatalogSelectionService,
  ) {}

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('status') status?: string,
    @Query('workOrderType') workOrderType?: string,
    @Query('sort') sort?: string,
  ) {
    return this.workOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      purchaseOrderId,
      status,
      workOrderType,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.workOrdersService.findByJob({ jobId });
  }

  @Get('purchase-order/:purchaseOrderId')
  @RequirePermission(P.procurement.read)
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.workOrdersService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get(':id/line-items')
  @RequirePermission(P.procurement.read)
  getLineItems(@Param('id') id: string) {
    return this.catalogSelectionService.getWorkOrderLineItems({ workOrderId: id });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.workOrdersService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.workOrdersService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.workOrdersService.update({ id, body, userId });
  }

  @Post(':woId/groups/:groupId/catalog-items')
  @RequirePermission(P.procurement.manage)
  addCatalogItem(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogPrimitiveDto,
  ) {
    return this.catalogSelectionService.addPrimitiveToWorkOrder({
      workOrderGroupId: body.workOrderComboId ? undefined : groupId,
      workOrderComboId: body.workOrderComboId,
      catalogItemId: body.catalogItemId,
      quantity: body.quantity,
    });
  }

  @Post(':woId/groups/:groupId/catalog-assemblies')
  @RequirePermission(P.procurement.manage)
  addCatalogAssembly(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogAssemblyDto,
  ) {
    return this.catalogSelectionService.addAssemblyToWorkOrder({
      workOrderGroupId: groupId,
      catalogAssemblyId: body.catalogAssemblyId,
      quantity: body.quantity,
    });
  }
}
