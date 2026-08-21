import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { parseLineItemsPageQuery } from '../catalog/line-items-page';
import { CatalogMismatchService } from '../catalog/services/catalog-mismatch.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { CreateQuoteGroupDto, UpdateQuoteGroupDto, ReorderQuoteGroupsDto, UpdateQuoteLineItemsDto } from './dto/quote-group.dto';
import { QuotesService } from './quotes.service';
import { ManualCaptureService, type CaptureEstimateDto } from '../domain/services/manual-capture.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly catalogSelectionService: CatalogSelectionService,
    private readonly catalogMismatchService: CatalogMismatchService,
    private readonly manualCaptureService: ManualCaptureService,
    private readonly tenantContext: TenantContext,
  ) {}

  @Post('capture')
  @RequirePermission(P.procurement.manage)
  async capture(
    @Body() body: CaptureEstimateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    return this.manualCaptureService.captureEstimate({
      tenantId,
      userId: user.sub,
      dto: body,
    });
  }

  @Get('filter-assignees')
  @RequirePermission(P.procurement.read)
  async findFilterAssignees() {
    return this.quotesService.findFilterAssignees();
  }

  @Get()
  @RequirePermission(P.procurement.read)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('jobIds') jobIds?: string,
    @Query('status') status?: string,
    @Query('statusId') statusId?: string,
    @Query('quoteType') quoteType?: string,
    @Query('assignedToUserIds') assignedToUserIds?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ) {
    const jobIdList = jobIds
      ? jobIds.split(',').map((id) => id.trim()).filter((id) => id.length > 0)
      : undefined;
    return this.quotesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      jobIds: jobIdList && jobIdList.length > 0 ? jobIdList : undefined,
      status,
      statusId,
      quoteType,
      assignedToUserIds,
      search,
      sort,
    });
  }

  @Get('job/:jobId')
  @RequirePermission(P.procurement.read)
  async findByJob(@Param('jobId') jobId: string) {
    return this.quotesService.findByJob({ jobId });
  }

  @Get(':id')
  @RequirePermission(P.procurement.read)
  async findOne(@Param('id') id: string) {
    return this.quotesService.findOne({ id });
  }

  @Post()
  @RequirePermission(P.procurement.manage)
  async create(
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.quotesService.create({ body, userId });
  }

  @Post(':id')
  @RequirePermission(P.procurement.manage)
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @CurrentUser('sub') userId: string,
  ) {
    return this.quotesService.update({ id, body, userId });
  }

  @Delete(':id')
  @RequirePermission(P.procurement.manage)
  async delete(@Param('id') id: string) {
    return this.quotesService.delete({ id });
  }

  @Post(':id/publish')
  @RequirePermission(P.procurement.manage)
  async publish(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.quotesService.publish({ id, userId: user.sub });
  }

  @Post(':id/approve')
  @RequirePermission(P.procurement.manage)
  async approve(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.quotesService.approve({ id, userId });
  }

  @Post(':id/incorporate-proposal-pricing')
  @RequirePermission(P.procurement.manage)
  async incorporateProposalPricing(
    @Param('id') id: string,
    @Body()
    body: {
      proposalId: string;
      itemMappings: Array<{ quoteItemId: string; proposalItemId: string }>;
    },
  ) {
    await this.quotesService.incorporateProposalPricing({
      quoteId: id,
      proposalId: body.proposalId,
      itemMappings: body.itemMappings ?? [],
    });
    return { success: true };
  }

  @Get(':id/groups')
  @RequirePermission(P.procurement.read)
  listQuoteGroups(@Param('id') id: string) {
    return this.catalogSelectionService.listQuoteGroups({ quoteId: id });
  }

  @Get(':id/line-items')
  @RequirePermission(P.procurement.read)
  getQuoteLineItems(
    @Param('id') id: string,
    @Query('search') search?: string,
    @Query('groupIds') groupIds?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('all') all?: string,
  ) {
    return this.catalogSelectionService.getQuoteLineItems({
      quoteId: id,
      ...parseLineItemsPageQuery({ search, groupIds, page, limit, all }),
    });
  }

  @Patch(':id/line-items')
  @RequirePermission(P.procurement.manage)
  async updateQuoteLineItems(@Param('id') id: string, @Body() body: UpdateQuoteLineItemsDto) {
    await this.quotesService.assertQuoteEditable({ id });
    return this.catalogSelectionService.updateQuoteLineItems({
      quoteId: id,
      items: body.items,
      combos: body.combos,
    });
  }

  @Post(':id/groups')
  @RequirePermission(P.procurement.manage)
  async createOrEnsureQuoteGroup(@Param('id') id: string, @Body() body: CreateQuoteGroupDto) {
    await this.quotesService.assertQuoteEditable({ id });
    if (body.groupLabelLookupId || body.description) {
      return this.catalogSelectionService.createQuoteGroup({
        quoteId: id,
        groupLabelLookupId: body.groupLabelLookupId,
        description: body.description,
      });
    }
    return this.catalogSelectionService.ensureDefaultQuoteGroup({
      quoteId: id,
    });
  }

  @Patch(':id/groups/reorder')
  @RequirePermission(P.procurement.manage)
  async reorderQuoteGroups(@Param('id') id: string, @Body() body: ReorderQuoteGroupsDto) {
    await this.quotesService.assertQuoteEditable({ id });
    return this.catalogSelectionService.reorderQuoteGroups({
      quoteId: id,
      groupIds: body.groupIds,
    });
  }

  @Patch(':quoteId/groups/:groupId')
  @RequirePermission(P.procurement.manage)
  async updateQuoteGroup(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateQuoteGroupDto,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.updateQuoteGroup({
      quoteId,
      groupId,
      groupLabelLookupId: body.groupLabelLookupId,
      description: body.description,
      dimensions: body.dimensions,
    });
  }

  @Delete(':quoteId/groups/:groupId')
  @RequirePermission(P.procurement.manage)
  async deleteQuoteGroup(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.deleteQuoteGroup({ quoteId, groupId });
  }

  @Delete(':quoteId/items/:itemId')
  @RequirePermission(P.procurement.manage)
  async deleteQuoteItem(
    @Param('quoteId') quoteId: string,
    @Param('itemId') itemId: string,
    @Query('removeFromCatalogAssembly') removeFromCatalogAssembly?: string,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.deleteQuoteItem({
      quoteId,
      itemId,
      removeFromCatalogAssembly: removeFromCatalogAssembly === 'true',
    });
  }

  @Delete(':quoteId/combos/:comboId')
  @RequirePermission(P.procurement.manage)
  async deleteQuoteCombo(
    @Param('quoteId') quoteId: string,
    @Param('comboId') comboId: string,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.deleteQuoteCombo({ quoteId, comboId });
  }

  @Post(':quoteId/groups/:groupId/catalog-items')
  @RequirePermission(P.procurement.manage)
  async addCatalogItem(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogPrimitiveDto,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.addPrimitiveToQuote({
      quoteGroupId: body.quoteComboId ? undefined : groupId,
      quoteComboId: body.quoteComboId,
      catalogItemId: body.catalogItemId,
      quantity: body.quantity,
    });
  }

  @Post(':quoteId/groups/:groupId/catalog-assemblies')
  @RequirePermission(P.procurement.manage)
  async addCatalogAssembly(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogAssemblyDto,
  ) {
    await this.quotesService.assertQuoteEditable({ id: quoteId });
    return this.catalogSelectionService.addAssemblyToQuote({
      quoteGroupId: groupId,
      catalogAssemblyId: body.catalogAssemblyId,
      quantity: body.quantity,
      parentComboId: body.quoteComboId,
    });
  }

  @Get(':id/catalog-mismatches')
  @RequirePermission(P.procurement.read)
  getCatalogMismatches(@Param('id') id: string) {
    return this.catalogMismatchService.scanQuote({ quoteId: id, apply: false });
  }

  @Post(':id/catalog-mismatches/scan')
  @RequirePermission(P.procurement.manage)
  scanCatalogMismatches(@Param('id') id: string) {
    return this.catalogMismatchService.scanQuote({ quoteId: id, apply: true });
  }
}
