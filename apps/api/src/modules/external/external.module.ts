import { Module, forwardRef } from '@nestjs/common';
import { ExternalObjectService } from './external-object.service';
import { LookupResolver } from './lookup-resolver.service';
import { ConnectionResolverService } from './connection-resolver.service';
import { ExternalController } from './external.controller';
import { InProcessProjectionService } from './in-process-projection.service';
import { ParentRecoveryService } from './parent-recovery.service';
import { ConnectionIdentifiersRepository } from '../../database/repositories';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { More0Module } from '../../more0/more0.module';
import { DomainModule } from '../domain/domain.module';
import { CatalogModule } from '../catalog/catalog.module';

@Module({
  imports: [CrunchworkModule, More0Module, CatalogModule, forwardRef(() => DomainModule)],
  controllers: [ExternalController],
  providers: [
    ExternalObjectService,
    LookupResolver,
    ConnectionResolverService,
    ConnectionIdentifiersRepository,
    InProcessProjectionService,
    ParentRecoveryService,
  ],
  exports: [
    ExternalObjectService,
    LookupResolver,
    ConnectionResolverService,
    ConnectionIdentifiersRepository,
    InProcessProjectionService,
    ParentRecoveryService,
  ],
})
export class ExternalModule {}
