import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CatalogSelectionService } from '../catalog/services/catalog-selection.service';
import { CatalogMismatchService } from '../catalog/services/catalog-mismatch.service';
import { AddCatalogAssemblyDto, AddCatalogPrimitiveDto } from '../catalog/dto/catalog.dto';
import { CreateQuoteGroupDto, UpdateQuoteGroupDto, ReorderQuoteGroupsDto } from './dto/quote-group.dto';
import { QuotesService } from './quotes.service';

@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly catalogSelectionService: CatalogSelectionService,
    private readonly catalogMismatchService: CatalogMismatchService,
  ) {}

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('jobId') jobId?: string,
    @Query('statusId') statusId?: string,
  ) {
    return this.quotesService.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      jobId,
      statusId,
    });
  }

  @Get('job/:jobId')
  async findByJob(@Param('jobId') jobId: string) {
    return this.quotesService.findByJob({ jobId });
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.quotesService.findOne({ id });
  }

  @Post()
  async create(@Body() body: Record<string, unknown>) {
    return this.quotesService.create({ body });
  }

  @Post(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.quotesService.update({ id, body });
  }

  @Post(':id/publish')
  async publish(@Param('id') id: string) {
    return this.quotesService.publish({ id });
  }

  @Get(':id/groups')
  listQuoteGroups(@Param('id') id: string) {
    return this.catalogSelectionService.listQuoteGroups({ quoteId: id });
  }

  @Get(':id/line-items')
  getQuoteLineItems(@Param('id') id: string) {
    return this.catalogSelectionService.getQuoteLineItems({ quoteId: id });
  }

  @Post(':id/groups')
  createOrEnsureQuoteGroup(@Param('id') id: string, @Body() body: CreateQuoteGroupDto) {
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
  reorderQuoteGroups(@Param('id') id: string, @Body() body: ReorderQuoteGroupsDto) {
    return this.catalogSelectionService.reorderQuoteGroups({
      quoteId: id,
      groupIds: body.groupIds,
    });
  }

  @Patch(':quoteId/groups/:groupId')
  updateQuoteGroup(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
    @Body() body: UpdateQuoteGroupDto,
  ) {
    return this.catalogSelectionService.updateQuoteGroup({
      quoteId,
      groupId,
      groupLabelLookupId: body.groupLabelLookupId,
      description: body.description,
      dimensions: body.dimensions,
    });
  }

  @Delete(':quoteId/groups/:groupId')
  deleteQuoteGroup(
    @Param('quoteId') quoteId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.catalogSelectionService.deleteQuoteGroup({ quoteId, groupId });
  }

  @Post(':quoteId/groups/:groupId/catalog-items')
  addCatalogItem(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogPrimitiveDto,
  ) {
    return this.catalogSelectionService.addPrimitiveToQuote({
      quoteGroupId: body.quoteComboId ? undefined : groupId,
      quoteComboId: body.quoteComboId,
      catalogItemId: body.catalogItemId,
      quantity: body.quantity,
    });
  }

  @Post(':quoteId/groups/:groupId/catalog-assemblies')
  addCatalogAssembly(
    @Param('groupId') groupId: string,
    @Body() body: AddCatalogAssemblyDto,
  ) {
    return this.catalogSelectionService.addAssemblyToQuote({
      quoteGroupId: groupId,
      catalogAssemblyId: body.catalogAssemblyId,
      quantity: body.quantity,
    });
  }

  @Get(':id/catalog-mismatches')
  getCatalogMismatches(@Param('id') id: string) {
    return this.catalogMismatchService.scanQuote({ quoteId: id, apply: false });
  }

  @Post(':id/catalog-mismatches/scan')
  scanCatalogMismatches(@Param('id') id: string) {
    return this.catalogMismatchService.scanQuote({ quoteId: id, apply: true });
  }
}
