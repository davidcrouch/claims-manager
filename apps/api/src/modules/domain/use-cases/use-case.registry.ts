import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import type { ProjectionUseCase } from './use-case.interface';
import { ProjectClaimUseCase } from './project-claim.use-case';
import { ProjectJobUseCase } from './project-job.use-case';
import { ProjectQuoteUseCase } from './project-quote.use-case';
import { ProjectPurchaseOrderUseCase } from './project-purchase-order.use-case';
import { ProjectInvoiceUseCase } from './project-invoice.use-case';
import { ProjectTaskUseCase } from './project-task.use-case';
import { ProjectMessageUseCase } from './project-message.use-case';
import { ProjectAppointmentUseCase } from './project-appointment.use-case';
import { ProjectReportUseCase } from './project-report.use-case';
import { ProjectAttachmentUseCase } from './project-attachment.use-case';

@Injectable()
export class UseCaseRegistry implements OnModuleInit {
  private readonly logger = new Logger('UseCaseRegistry');
  private useCases: Record<string, ProjectionUseCase> = {};

  constructor(
    @Optional() private readonly projectClaim?: ProjectClaimUseCase,
    @Optional() private readonly projectJob?: ProjectJobUseCase,
    @Optional() private readonly projectQuote?: ProjectQuoteUseCase,
    @Optional() private readonly projectPurchaseOrder?: ProjectPurchaseOrderUseCase,
    @Optional() private readonly projectInvoice?: ProjectInvoiceUseCase,
    @Optional() private readonly projectTask?: ProjectTaskUseCase,
    @Optional() private readonly projectMessage?: ProjectMessageUseCase,
    @Optional() private readonly projectAppointment?: ProjectAppointmentUseCase,
    @Optional() private readonly projectReport?: ProjectReportUseCase,
    @Optional() private readonly projectAttachment?: ProjectAttachmentUseCase,
  ) {}

  onModuleInit(): void {
    if (this.projectClaim) this.useCases['claim'] = this.projectClaim;
    if (this.projectJob) this.useCases['job'] = this.projectJob;
    if (this.projectQuote) this.useCases['quote'] = this.projectQuote;
    if (this.projectPurchaseOrder) this.useCases['purchase_order'] = this.projectPurchaseOrder;
    if (this.projectInvoice) this.useCases['invoice'] = this.projectInvoice;
    if (this.projectTask) this.useCases['task'] = this.projectTask;
    if (this.projectMessage) this.useCases['message'] = this.projectMessage;
    if (this.projectAppointment) this.useCases['appointment'] = this.projectAppointment;
    if (this.projectReport) this.useCases['report'] = this.projectReport;
    if (this.projectAttachment) this.useCases['attachment'] = this.projectAttachment;

    this.logger.log(
      `UseCaseRegistry.onModuleInit — registered: ${Object.keys(this.useCases).join(', ') || '(none)'}`,
    );
  }

  get(entityType: string): ProjectionUseCase | undefined {
    return this.useCases[entityType];
  }

  listRegistered(): string[] {
    return Object.keys(this.useCases);
  }
}
