import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { PurchaseOrdersService } from './purchase-orders.service';
import { ManualCaptureService, type CapturePurchaseOrderDto } from '../domain/services/manual-capture.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly manualCaptureService: ManualCaptureService,
    private readonly catalogSelectionService: CatalogSelectionService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Post('capture')
  @RequirePermission(P.procurement.manage)
  async capture(
    @Body() body: CapturePurchaseOrderDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.manualCaptureService.capturePurchaseOrder({
      tenantId,
      userId: user.sub,
      dto: body,
    });
  }

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('ownershipStatus') ownershipStatus?: string,
    @Query('captureMethod') captureMethod?: string,
    @Query('sort') sort?: string,
  ) {
    return this.purchaseOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      status,
      vendorId,
      ownershipStatus,
      captureMethod,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.purchaseOrdersService.findByJob({ jobId });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.purchaseOrdersService.create({ body, userId });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne({ id });
  }

  @Get(':id/line-items')
  @RequirePermission(P.procurement.read)
  getLineItems(@Param('id') id: string) {
    return this.catalogSelectionService.getPurchaseOrderLineItems({ purchaseOrderId: id });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.purchaseOrdersService.update({ id, body, userId });
  }

  @Post(':poId/groups/:groupId/catalog-items')
  @RequirePermission(P.procurement.manage)
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
  @RequirePermission(P.procurement.manage)
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
