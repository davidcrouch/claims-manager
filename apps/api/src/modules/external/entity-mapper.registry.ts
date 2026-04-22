import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import type { EntityMapper } from './entity-mapper.interface';
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

@Injectable()
export class EntityMapperRegistry implements OnModuleInit {
  private readonly logger = new Logger('EntityMapperRegistry');
  private mappers: Record<string, EntityMapper> = {};

  constructor(
    @Optional() private readonly jobMapper?: CrunchworkJobMapper,
    @Optional() private readonly claimMapper?: CrunchworkClaimMapper,
    @Optional() private readonly poMapper?: CrunchworkPurchaseOrderMapper,
    @Optional() private readonly invoiceMapper?: CrunchworkInvoiceMapper,
    @Optional() private readonly taskMapper?: CrunchworkTaskMapper,
    @Optional() private readonly messageMapper?: CrunchworkMessageMapper,
    @Optional() private readonly attachmentMapper?: CrunchworkAttachmentMapper,
    @Optional() private readonly quoteMapper?: CrunchworkQuoteMapper,
    @Optional() private readonly reportMapper?: CrunchworkReportMapper,
    @Optional()
    private readonly appointmentMapper?: CrunchworkAppointmentMapper,
  ) {}

  onModuleInit(): void {
    if (this.jobMapper) this.mappers['job'] = this.jobMapper;
    if (this.claimMapper) this.mappers['claim'] = this.claimMapper;
    if (this.poMapper) this.mappers['purchase_order'] = this.poMapper;
    if (this.invoiceMapper) this.mappers['invoice'] = this.invoiceMapper;
    if (this.taskMapper) this.mappers['task'] = this.taskMapper;
    if (this.messageMapper) this.mappers['message'] = this.messageMapper;
    if (this.attachmentMapper)
      this.mappers['attachment'] = this.attachmentMapper;
    if (this.quoteMapper) this.mappers['quote'] = this.quoteMapper;
    if (this.reportMapper) this.mappers['report'] = this.reportMapper;
    if (this.appointmentMapper)
      this.mappers['appointment'] = this.appointmentMapper;

    this.logger.log(
      `EntityMapperRegistry.onModuleInit — registered mappers: ${Object.keys(this.mappers).join(', ')}`,
    );
  }

  get(params: { entityType: string }): EntityMapper | undefined {
    return this.mappers[params.entityType];
  }

  register(params: { entityType: string; mapper: EntityMapper }): void {
    this.mappers[params.entityType] = params.mapper;
  }

  listRegistered(): string[] {
    return Object.keys(this.mappers);
  }
}
