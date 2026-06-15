import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CatalogCategoryService } from './services/catalog-category.service';
import { CreateCatalogCategoryDto, UpdateCatalogCategoryDto } from './dto/catalog.dto';

@Controller('catalog/categories')
export class CatalogCategoriesController {
  constructor(private readonly categoryService: CatalogCategoryService) {}

  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  @Get('tree')
  findTree() {
    return this.categoryService.findTree();
  }

  @Post()
  create(@Body() body: CreateCatalogCategoryDto) {
    return this.categoryService.create(body);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() body: UpdateCatalogCategoryDto) {
    return this.categoryService.update({ id, ...body });
  }

  @Delete(':id')
  deactivate(@Param('id') id: string) {
    return this.categoryService.deactivate({ id });
  }
}
