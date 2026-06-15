import { Body, Controller, Get, Post } from '@nestjs/common';
import { CatalogImportService } from './services/catalog-import.service';
import { CatalogResolutionService } from './services/catalog-resolution.service';
import { IsString } from 'class-validator';

class ImportCatalogCsvDto {
  @IsString()
  csv!: string;
}

@Controller('catalog/import')
export class CatalogImportController {
  constructor(
    private readonly importService: CatalogImportService,
  ) {}

  @Get('template')
  getTemplate() {
    return this.importService.getTemplate();
  }

  @Post('preview')
  previewCsv(@Body() body: ImportCatalogCsvDto) {
    return this.importService.previewCsv({ csv: body.csv });
  }

  @Post('csv')
  importCsv(@Body() body: ImportCatalogCsvDto) {
    return this.importService.importCsv({ csv: body.csv });
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
