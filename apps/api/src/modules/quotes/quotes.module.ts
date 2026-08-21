import { Module } from '@nestjs/common';
import { TenantModule } from '../../tenant/tenant.module';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { CatalogModule } from '../catalog/catalog.module';
import { ExternalModule } from '../external/external.module';
import { DomainModule } from '../domain/domain.module';
import { ActivitiesModule } from '../activities/activities.module';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';

@Module({
  imports: [TenantModule, CrunchworkModule, CatalogModule, ExternalModule, DomainModule, ActivitiesModule],
  controllers: [QuotesController],
  providers: [QuotesService],
  exports: [QuotesService],
})
export class QuotesModule {}
