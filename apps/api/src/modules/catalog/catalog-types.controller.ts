import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CatalogTypeService } from './services/catalog-type.service';
import { CreateCatalogTypeDto, UpdateCatalogTypeDto } from './dto/catalog.dto';

@Controller('catalog/types')
export class CatalogTypesController {
  constructor(private readonly typeService: CatalogTypeService) {}

  @Get()
  findAll() {
    return this.typeService.findAll();
  }

  @Post()
  create(@Body() body: CreateCatalogTypeDto) {
    return this.typeService.create(body);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() body: UpdateCatalogTypeDto) {
    return this.typeService.update({ id, ...body });
  }
}
