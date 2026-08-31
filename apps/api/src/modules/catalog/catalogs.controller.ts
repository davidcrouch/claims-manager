import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogsService } from './services/catalogs.service';
import { CatalogCopyService } from './services/catalog-copy.service';
import { CatalogStructureService } from './services/catalog-structure.service';
import {
  CopyCatalogItemDto,
  MoveCatalogLineItemDto,
  ReorderCatalogLineItemsDto,
} from './dto/catalog.dto';
import { IsIn, IsOptional, IsString, IsBoolean } from 'class-validator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

class CreateCatalogDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['crunchwork', 'internal'])
  type!: 'crunchwork' | 'internal';

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

class UpdateCatalogDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['crunchwork', 'internal'])
  type?: 'crunchwork' | 'internal';

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

@Controller('catalogs')
export class CatalogsController {
  constructor(
    private readonly catalogsService: CatalogsService,
    private readonly catalogCopyService: CatalogCopyService,
    private readonly catalogStructureService: CatalogStructureService,
  ) {}

  @Get()
  @RequirePermission(P.catalogs.read)
  findAll(@Query('type') type?: string) {
    return this.catalogsService.findAll({ type });
  }

  @Get(':id')
  @RequirePermission(P.catalogs.read)
  findOne(@Param('id') id: string) {
    return this.catalogsService.findOne({ id });
  }

  @Get(':id/category-counts')
  @RequirePermission(P.catalogs.read)
  categoryCounts(@Param('id') id: string, @Query('q') q?: string) {
    return this.catalogsService.categoryCounts({ id, search: q });
  }

  @Post()
  @RequirePermission(P.catalogs.manage)
  create(@Body() body: CreateCatalogDto) {
    return this.catalogsService.create(body);
  }

  @Post(':id')
  @RequirePermission(P.catalogs.manage)
  update(@Param('id') id: string, @Body() body: UpdateCatalogDto) {
    return this.catalogsService.update({ id, ...body });
  }

  @Post(':id/copy-items')
  @RequirePermission(P.catalogs.manage)
  copyItem(@Param('id') id: string, @Body() body: CopyCatalogItemDto) {
    return this.catalogCopyService.copyItemToCatalog({
      targetCatalogId: id,
      catalogItemId: body.catalogItemId,
      parentId: body.parentId,
      nestUnderId: body.nestUnderId,
    });
  }

  @Post(':id/move-line-item')
  @RequirePermission(P.catalogs.manage)
  moveLineItem(@Param('id') _id: string, @Body() body: MoveCatalogLineItemDto) {
    return this.catalogStructureService.moveLineItem(body);
  }

  @Post(':id/reorder-line-items')
  @RequirePermission(P.catalogs.manage)
  reorderLineItems(@Param('id') _id: string, @Body() body: ReorderCatalogLineItemsDto) {
    return this.catalogStructureService.reorderLineItems(body);
  }

  @Delete(':id')
  @RequirePermission(P.catalogs.manage)
  remove(@Param('id') id: string) {
    return this.catalogsService.deactivate({ id });
  }
}
