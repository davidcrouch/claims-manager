import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CatalogImportService } from './services/catalog-import.service';
import { CatalogResolutionService } from './services/catalog-resolution.service';
import { IsOptional, IsString, IsUUID } from 'class-validator';

class ImportCatalogCsvDto {
  @IsString()
  csv!: string;

  @IsOptional()
  @IsUUID()
  catalogId?: string;
}

@Controller('catalog/import')
export class CatalogImportController {
  constructor(
    private readonly importService: CatalogImportService,
  ) {}

  @Get('template')
  getTemplate(@Query('catalogType') catalogType?: string) {
    return this.importService.getTemplate(catalogType);
  }

  @Post('preview')
  previewCsv(@Body() body: ImportCatalogCsvDto) {
    return this.importService.previewCsv({
      csv: body.csv,
      catalogId: body.catalogId,
    });
  }

  @Post('csv')
  importCsv(@Body() body: ImportCatalogCsvDto) {
    return this.importService.importCsv({
      csv: body.csv,
      catalogId: body.catalogId,
    });
  }
}

@Controller('catalog/unresolved-references')
export class CatalogUnresolvedController {
  constructor(private readonly resolutionService: CatalogResolutionService) {}

  @Get()
  listUnresolved() {
    return this.resolutionService.listUnresolved({});
  }
}
