import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CatalogCategoryService } from './services/catalog-category.service';
import { CreateCatalogCategoryDto, UpdateCatalogCategoryDto } from './dto/catalog.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('catalog/categories')
export class CatalogCategoriesController {
  constructor(private readonly categoryService: CatalogCategoryService) {}

  @Get()
  @RequirePermission(P.catalogs.read)
  findAll() {
    return this.categoryService.findAll();
  }

  @Get('tree')
  @RequirePermission(P.catalogs.read)
  findTree() {
    return this.categoryService.findTree();
  }

  @Post()
  @RequirePermission(P.catalogs.manage)
  create(@Body() body: CreateCatalogCategoryDto) {
    return this.categoryService.create(body);
  }

  @Post(':id')
  @RequirePermission(P.catalogs.manage)
  update(@Param('id') id: string, @Body() body: UpdateCatalogCategoryDto) {
    return this.categoryService.update({ id, ...body });
  }

  @Delete(':id')
  @RequirePermission(P.catalogs.manage)
  deactivate(@Param('id') id: string) {
    return this.categoryService.deactivate({ id });
  }
}
