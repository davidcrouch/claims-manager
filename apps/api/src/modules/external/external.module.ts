import { Module } from '@nestjs/common';
import { ExternalObjectService } from './external-object.service';
import { NestedEntityExtractor } from './nested-entity-extractor.service';
import { LookupResolver } from './lookup-resolver.service';
import { ConnectionResolverService } from './connection-resolver.service';
import { ExternalController } from './external.controller';
import { CrunchworkJobMapper } from './mappers/crunchwork-job.mapper';
import { CrunchworkClaimMapper } from './mappers/crunchwork-claim.mapper';
import { CrunchworkPurchaseOrderMapper } from './mappers/crunchwork-purchase-order.mapper';
import { CrunchworkInvoiceMapper } from './mappers/crunchwork-invoice.mapper';
import { CrunchworkTaskMapper } from './mappers/crunchwork-task.mapper';
import { CrunchworkMessageMapper } from './mappers/crunchwork-message.mapper';
import { CrunchworkAttachmentMapper } from './mappers/crunchwork-attachment.mapper';
import { CrunchworkQuoteMapper } from './mappers/crunchwork-quote.mapper';
import { CrunchworkReportMapper } from './mappers/crunchwork-report.mapper';
import { CrunchworkAppointmentMapper } from './mappers/crunchwork-appointment.mapper';
import { EntityMapperRegistry } from './entity-mapper.registry';
import { InProcessProjectionService } from './in-process-projection.service';
import { ParentRecoveryService } from './parent-recovery.service';
import { CrunchworkModule } from '../../crunchwork/crunchwork.module';
import { More0Module } from '../../more0/more0.module';

const mappers = [
  CrunchworkJobMapper,
  CrunchworkClaimMapper,
  CrunchworkPurchaseOrderMapper,
  CrunchworkInvoiceMapper,
  CrunchworkTaskMapper,
  CrunchworkMessageMapper,
  CrunchworkAttachmentMapper,
  CrunchworkQuoteMapper,
  CrunchworkReportMapper,
  CrunchworkAppointmentMapper,
];

@Module({
  imports: [CrunchworkModule, More0Module],
  controllers: [ExternalController],
  providers: [
    ExternalObjectService,
    NestedEntityExtractor,
    LookupResolver,
    ConnectionResolverService,
    EntityMapperRegistry,
    InProcessProjectionService,
    ParentRecoveryService,
    ...mappers,
  ],
  exports: [
    ExternalObjectService,
    NestedEntityExtractor,
    LookupResolver,
    ConnectionResolverService,
    EntityMapperRegistry,
    InProcessProjectionService,
    ParentRecoveryService,
    ...mappers,
  ],
})
export class ExternalModule {}
