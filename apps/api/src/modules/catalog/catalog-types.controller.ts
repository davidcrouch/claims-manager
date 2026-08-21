import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CatalogTypeService } from './services/catalog-type.service';
import { CreateCatalogTypeDto, UpdateCatalogTypeDto } from './dto/catalog.dto';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

@Controller('catalog/types')
export class CatalogTypesController {
  constructor(private readonly typeService: CatalogTypeService) {}

  @Get()
  @RequirePermission(P.catalogs.read)
  findAll() {
    return this.typeService.findAll();
  }

  @Get(':id')
  @RequirePermission(P.catalogs.read)
  findOne(@Param('id') id: string) {
    return this.typeService.findById({ id });
  }

  @Post()
  @RequirePermission(P.catalogs.manage)
  create(@Body() body: CreateCatalogTypeDto) {
    return this.typeService.create(body);
  }

  @Post(':id')
  @RequirePermission(P.catalogs.manage)
  update(@Param('id') id: string, @Body() body: UpdateCatalogTypeDto) {
    return this.typeService.update({ id, ...body });
  }

  @Delete(':id')
  @RequirePermission(P.catalogs.manage)
  deactivate(@Param('id') id: string) {
    return this.typeService.deactivate({ id });
  }
}
