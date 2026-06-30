import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { WorkOrdersService } from './work-orders.service';

@Controller('work-orders')
export class WorkOrdersController {
  constructor(
    private readonly workOrdersService: WorkOrdersService,
    private readonly catalogSelectionService: CatalogSelectionService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.workOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      purchaseOrderId,
      sort,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.workOrdersService.findByJob({ jobId });
  }

  @Get('purchase-order/:purchaseOrderId')
  async findByPurchaseOrder(@Param('purchaseOrderId') purchaseOrderId: string) {
    return this.workOrdersService.findByPurchaseOrder({ purchaseOrderId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.workOrdersService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.workOrdersService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.workOrdersService.update({ id, body });
  }

  @Post(':woId/groups/:groupId/catalog-items')
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
