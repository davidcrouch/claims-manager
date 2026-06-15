import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import type { EntityTransformer } from './transformer.interface';
import { ClaimTransformer } from './claim.transformer';
import { JobTransformer } from './job.transformer';
import { QuoteTransformer } from './quote.transformer';
import { PurchaseOrderTransformer } from './purchase-order.transformer';
import { InvoiceTransformer } from './invoice.transformer';
import { TaskTransformer } from './task.transformer';
import { MessageTransformer } from './message.transformer';
import { AppointmentTransformer } from './appointment.transformer';
import { ReportTransformer } from './report.transformer';
import { AttachmentTransformer } from './attachment.transformer';

@Injectable()
export class TransformerRegistry implements OnModuleInit {
  private readonly logger = new Logger('TransformerRegistry');
  private transformers: Record<string, EntityTransformer> = {};

  constructor(
    @Optional() private readonly claimTransformer?: ClaimTransformer,
    @Optional() private readonly jobTransformer?: JobTransformer,
    @Optional() private readonly quoteTransformer?: QuoteTransformer,
    @Optional() private readonly purchaseOrderTransformer?: PurchaseOrderTransformer,
    @Optional() private readonly invoiceTransformer?: InvoiceTransformer,
    @Optional() private readonly taskTransformer?: TaskTransformer,
    @Optional() private readonly messageTransformer?: MessageTransformer,
    @Optional() private readonly appointmentTransformer?: AppointmentTransformer,
    @Optional() private readonly reportTransformer?: ReportTransformer,
    @Optional() private readonly attachmentTransformer?: AttachmentTransformer,
  ) {}

  onModuleInit(): void {
    if (this.claimTransformer) this.transformers['claim'] = this.claimTransformer;
    if (this.jobTransformer) this.transformers['job'] = this.jobTransformer;
    if (this.quoteTransformer) this.transformers['quote'] = this.quoteTransformer;
    if (this.purchaseOrderTransformer) this.transformers['purchase_order'] = this.purchaseOrderTransformer;
    if (this.invoiceTransformer) this.transformers['invoice'] = this.invoiceTransformer;
    if (this.taskTransformer) this.transformers['task'] = this.taskTransformer;
    if (this.messageTransformer) this.transformers['message'] = this.messageTransformer;
    if (this.appointmentTransformer) this.transformers['appointment'] = this.appointmentTransformer;
    if (this.reportTransformer) this.transformers['report'] = this.reportTransformer;
    if (this.attachmentTransformer) this.transformers['attachment'] = this.attachmentTransformer;

    this.logger.log(
      `TransformerRegistry.onModuleInit — registered: ${Object.keys(this.transformers).join(', ') || '(none)'}`,
    );
  }

  get(entityType: string): EntityTransformer | undefined {
    return this.transformers[entityType];
  }
}
