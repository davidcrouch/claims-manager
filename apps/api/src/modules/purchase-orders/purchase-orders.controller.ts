import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { parseLineItemsPageQuery } from '../catalog/line-items-page';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import {
  CreateQuoteGroupDto,
  UpdateQuoteGroupDto,
  ReorderQuoteGroupsDto,
  UpdateQuoteLineItemsDto,
  ReorderLineItemsDto,
  MoveLineItemDto,
  DuplicateLineItemDto,
} from '../quotes/dto/quote-group.dto';
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
    @Query('jobIds') jobIds?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('ownershipStatus') ownershipStatus?: string,
    @Query('captureMethod') captureMethod?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.purchaseOrdersService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      status,
      vendorId,
      ownershipStatus,
      captureMethod,
      search,
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
  getLineItems(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('groupIds') groupIds?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('all') all?: string,
  ) {
    return this.catalogSelectionService.getPurchaseOrderLineItems({
      purchaseOrderId: id,
      ...parseLineItemsPageQuery({ search, groupIds, page, limit, all }),
    });
  }

  @Patch(':id/line-items')
  @RequirePermission(P.procurement.manage)
  async updateLineItems(@Param('id') id: string, @Body() body: UpdateQuoteLineItemsDto) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id });
    return this.catalogSelectionService.updatePurchaseOrderLineItems({
      purchaseOrderId: id,
      items: body.items,
      combos: body.combos,
    });
  }

  @Post(':id/groups')
  @RequirePermission(P.procurement.manage)
  async createOrEnsureGroup(@Param('id') id: string, @Body() body: CreateQuoteGroupDto) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id });
    if (body.groupLabelLookupId || body.description) {
      return this.catalogSelectionService.createPurchaseOrderGroup({
        purchaseOrderId: id,
        groupLabelLookupId: body.groupLabelLookupId,
        description: body.description,
      });
    }
    return this.catalogSelectionService.ensureDefaultPurchaseOrderGroup({
      purchaseOrderId: id,
    });
  }

  @Patch(':id/groups/reorder')
  @RequirePermission(P.procurement.manage)
  async reorderGroups(@Param('id') id: string, @Body() body: ReorderQuoteGroupsDto) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id });
    return this.catalogSelectionService.reorderPurchaseOrderGroups({
      purchaseOrderId: id,
      groupIds: body.groupIds,
    });
  }

  @Patch(':poId/groups/:groupId')
  @RequirePermission(P.procurement.manage)
  async updateGroup(
    @Param('poId') poId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateQuoteGroupDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.updatePurchaseOrderGroup({
      purchaseOrderId: poId,
      groupId,
      groupLabelLookupId: body.groupLabelLookupId,
      description: body.description,
      component: body.component,
      dimensions: body.dimensions,
    });
  }

  @Delete(':poId/groups/:groupId')
  @RequirePermission(P.procurement.manage)
  async deleteGroup(
    @Param('poId') poId: string,
    @Param('groupId') groupId: string,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.deletePurchaseOrderGroup({
      purchaseOrderId: poId,
      groupId,
    });
  }

  @Delete(':poId/items/:itemId')
  @RequirePermission(P.procurement.manage)
  async deleteItem(
    @Param('poId') poId: string,
    @Param('itemId') itemId: string,
    @Query('removeFromCatalogAssembly') removeFromCatalogAssembly?: string,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.deletePurchaseOrderItem({
      purchaseOrderId: poId,
      itemId,
      removeFromCatalogAssembly: removeFromCatalogAssembly === 'true',
    });
  }

  @Delete(':poId/combos/:comboId')
  @RequirePermission(P.procurement.manage)
  async deleteCombo(
    @Param('poId') poId: string,
    @Param('comboId') comboId: string,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.deletePurchaseOrderCombo({
      purchaseOrderId: poId,
      comboId,
    });
  }

  @Patch(':poId/line-items/reorder')
  @RequirePermission(P.procurement.manage)
  async reorderLineItems(
    @Param('poId') poId: string,
    @Body() body: ReorderLineItemsDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.reorderPurchaseOrderLineItems({
      purchaseOrderId: poId,
      items: body.items,
      combos: body.combos,
    });
  }

  @Patch(':poId/line-items/move')
  @RequirePermission(P.procurement.manage)
  async moveLineItem(
    @Param('poId') poId: string,
    @Body() body: MoveLineItemDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.movePurchaseOrderLineItem({
      purchaseOrderId: poId,
      itemId: body.itemId,
      comboId: body.comboId,
      targetGroupId: body.targetGroupId,
      targetComboId: body.targetComboId,
      insertAtIndex: body.insertAtIndex,
    });
  }

  @Post(':poId/line-items/duplicate')
  @RequirePermission(P.procurement.manage)
  async duplicateLineItem(
    @Param('poId') poId: string,
    @Body() body: DuplicateLineItemDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.duplicatePurchaseOrderLineItem({
      purchaseOrderId: poId,
      itemId: body.itemId,
      comboId: body.comboId,
      targetGroupId: body.targetGroupId,
      targetComboId: body.targetComboId,
      insertAtIndex: body.insertAtIndex,
    });
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
  async addCatalogItem(
    @Param('poId') poId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogPrimitiveDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.addPrimitiveToPurchaseOrder({
      purchaseOrderGroupId: body.purchaseOrderComboId ? undefined : groupId,
      purchaseOrderComboId: body.purchaseOrderComboId,
      catalogItemId: body.catalogItemId,
      quantity: body.quantity,
    });
  }

  @Post(':poId/groups/:groupId/catalog-assemblies')
  @RequirePermission(P.procurement.manage)
  async addCatalogAssembly(
    @Param('poId') poId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogAssemblyDto,
  ) {
    await this.purchaseOrdersService.assertPurchaseOrderEditable({ id: poId });
    return this.catalogSelectionService.addAssemblyToPurchaseOrder({
      purchaseOrderGroupId: groupId,
      catalogAssemblyId: body.catalogAssemblyId,
      quantity: body.quantity,
    });
  }
}
