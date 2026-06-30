import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CatalogItemService } from './services/catalog-item.service';
import { CatalogAssemblyService } from './services/catalog-assembly.service';
import {
  BomLineDto,
  CreateCatalogItemDto,
  ReplaceBomDto,
  UpdateCatalogItemDto,
} from './dto/catalog.dto';

@Controller('catalog/items')
export class CatalogItemsController {
  constructor(
    private readonly itemService: CatalogItemService,
    private readonly assemblyService: CatalogAssemblyService,
  ) {}

  @Get()
  findMany(
    @Query('catalogId') catalogId?: string,
    @Query('kind') kind?: 'primitive' | 'assembly',
    @Query('typeId') typeId?: string,
    @Query('categoryId') categoryId?: string,
    @Query('q') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sort') sort?: string,
  ) {
    return this.itemService.findMany({
      catalogId,
      kind,
      typeId,
      categoryId,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sort,
    });
  }

  @Get(':id/components')
  listComponents(@Param('id') id: string) {
    return this.assemblyService.findComponents({ assemblyId: id });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemService.findOne({ id });
  }

  @Post()
  create(@Body() body: CreateCatalogItemDto) {
    return this.itemService.create(body);
  }

  @Post(':id/refresh-cost')
  refreshCost(@Param('id') id: string) {
    return this.itemService.refreshCost({ id });
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() body: UpdateCatalogItemDto) {
    return this.itemService.update({ id, ...body });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemService.softDelete({ id });
  }

  @Put(':id/components')
  replaceBom(@Param('id') id: string, @Body() body: ReplaceBomDto) {
    return this.assemblyService.replaceBom({ assemblyId: id, lines: body.lines });
  }

  @Post(':id/components')
  addComponent(@Param('id') id: string, @Body() body: BomLineDto) {
    return this.assemblyService.addComponent({ assemblyId: id, ...body });
  }

  @Post(':assemblyId/components/:lineId')
  updateComponent(
    @Param('assemblyId') assemblyId: string,
    @Param('lineId') lineId: string,
    @Body() body: BomLineDto,
  ) {
    return this.assemblyService.updateComponent({
      assemblyId,
      lineId,
      quantity: body.quantity,
      wasteFactor: body.wasteFactor,
      sortIndex: body.sortIndex,
      isOptional: body.isOptional,
      notes: body.notes,
    });
  }

  @Delete(':assemblyId/components/:lineId')
  removeComponent(
    @Param('assemblyId') assemblyId: string,
    @Param('lineId') lineId: string,
  ) {
    return this.assemblyService.removeComponent({ assemblyId, lineId });
  }
}
