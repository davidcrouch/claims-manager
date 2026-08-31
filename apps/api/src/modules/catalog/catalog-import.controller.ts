import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CatalogImportService } from './services/catalog-import.service';
import { CatalogResolutionService } from './services/catalog-resolution.service';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { RequirePermission } from '../../auth/decorators/require-permission.decorator';
import { P } from '../../auth/permission-constants';

class ImportCatalogCsvDto {
  @IsString()
  csv!: string;

  @IsOptional()
  @IsUUID()
  catalogId?: string;
}

class ExportCatalogCsvQueryDto {
  @IsUUID()
  catalogId!: string;

  @IsOptional()
  @IsIn(['internal', 'crunchwork'])
  format?: 'internal' | 'crunchwork';
}

@Controller('catalog/import')
export class CatalogImportController {
  constructor(
    private readonly importService: CatalogImportService,
  ) {}

  @Get('template')
  @RequirePermission(P.catalogs.read)
  getTemplate(@Query('catalogType') catalogType?: string) {
    return this.importService.getTemplate(catalogType);
  }

  @Get('export')
  @RequirePermission(P.catalogs.read)
  exportCsv(@Query() query: ExportCatalogCsvQueryDto) {
    return this.importService.exportCsv({
      catalogId: query.catalogId,
      format: query.format,
    });
  }

  @Post('preview')
  @RequirePermission(P.catalogs.manage)
  previewCsv(@Body() body: ImportCatalogCsvDto) {
    return this.importService.previewCsv({
      csv: body.csv,
      catalogId: body.catalogId,
    });
  }

  @Post('csv')
  @RequirePermission(P.catalogs.manage)
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
  @RequirePermission(P.catalogs.read)
  listUnresolved() {
    return this.resolutionService.listUnresolved({});
  }
}
