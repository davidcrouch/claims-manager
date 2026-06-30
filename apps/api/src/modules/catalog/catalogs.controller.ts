import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { CatalogsService } from './services/catalogs.service';
import { IsIn, IsOptional, IsString, IsBoolean } from 'class-validator';

class CreateCatalogDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(['crunchwork', 'internal'])
  type!: 'crunchwork' | 'internal';
}

class UpdateCatalogDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('catalogs')
export class CatalogsController {
  constructor(private readonly catalogsService: CatalogsService) {}

  @Get()
  findAll(@Query('type') type?: string) {
    return this.catalogsService.findAll({ type });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogsService.findOne({ id });
  }

  @Post()
  create(@Body() body: CreateCatalogDto) {
    return this.catalogsService.create(body);
  }

  @Post(':id')
  update(@Param('id') id: string, @Body() body: UpdateCatalogDto) {
    return this.catalogsService.update({ id, ...body });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogsService.deactivate({ id });
  }
}
