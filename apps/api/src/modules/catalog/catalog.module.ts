import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CatalogTypesController } from './catalog-types.controller';
import { CatalogCategoriesController } from './catalog-categories.controller';
import { CatalogItemsController } from './catalog-items.controller';
import {
  CatalogImportController,
  CatalogUnresolvedController,
} from './catalog-import.controller';
import { CatalogBootstrapService } from './services/catalog-bootstrap.service';
import { CatalogTypeService } from './services/catalog-type.service';
import { CatalogCategoryService } from './services/catalog-category.service';
import { CatalogItemService } from './services/catalog-item.service';
import { CatalogAssemblyService } from './services/catalog-assembly.service';
import { CatalogPricingService } from './services/catalog-pricing.service';
import { CatalogSelectionService } from './services/catalog-selection.service';
import { CatalogImportService } from './services/catalog-import.service';
import { CatalogResolutionService } from './services/catalog-resolution.service';
import { CatalogMismatchService } from './services/catalog-mismatch.service';
import { CatalogOutboundService } from './services/catalog-outbound.service';
import { CatalogInboundService } from './services/catalog-inbound.service';

@Module({
  imports: [TenantModule],
  controllers: [
    CatalogTypesController,
    CatalogCategoriesController,
    CatalogItemsController,
    CatalogImportController,
    CatalogUnresolvedController,
  ],
  providers: [
    CatalogBootstrapService,
    CatalogTypeService,
    CatalogCategoryService,
    CatalogItemService,
    CatalogAssemblyService,
    CatalogPricingService,
    CatalogSelectionService,
    CatalogImportService,
    CatalogResolutionService,
    CatalogMismatchService,
    CatalogOutboundService,
    CatalogInboundService,
  ],
  exports: [
    CatalogSelectionService,
    CatalogPricingService,
    CatalogItemService,
    CatalogBootstrapService,
    CatalogMismatchService,
    CatalogOutboundService,
    CatalogInboundService,
    CatalogResolutionService,
  ],
})
export class CatalogModule {}
