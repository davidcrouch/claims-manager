import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly catalogSelectionService: CatalogSelectionService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('vendorId') vendorId?: string,
  ) {
    return this.purchaseOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      vendorId,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.purchaseOrdersService.findByJob({ jobId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne({ id });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.purchaseOrdersService.update({ id, body });
  }

  @Post(':poId/groups/:groupId/catalog-items')
  addCatalogItem(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogPrimitiveDto,
  ) {
    return this.catalogSelectionService.addPrimitiveToPurchaseOrder({
      purchaseOrderGroupId: body.purchaseOrderComboId ? undefined : groupId,
      purchaseOrderComboId: body.purchaseOrderComboId,
      catalogItemId: body.catalogItemId,
      quantity: body.quantity,
    });
  }

  @Post(':poId/groups/:groupId/catalog-assemblies')
  addCatalogAssembly(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogAssemblyDto,
  ) {
    return this.catalogSelectionService.addAssemblyToPurchaseOrder({
      purchaseOrderGroupId: groupId,
      catalogAssemblyId: body.catalogAssemblyId,
      quantity: body.quantity,
    });
  }
}
