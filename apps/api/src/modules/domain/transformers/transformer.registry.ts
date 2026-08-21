import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Type } from '@nestjs/common';
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

const TRANSFORMER_ENTRIES: Array<[string, Type<EntityTransformer>]> = [
  ['claim', ClaimTransformer],
  ['job', JobTransformer],
  ['quote', QuoteTransformer],
  ['purchase_order', PurchaseOrderTransformer],
  ['invoice', InvoiceTransformer],
  ['task', TaskTransformer],
  ['message', MessageTransformer],
  ['appointment', AppointmentTransformer],
  ['report', ReportTransformer],
  ['attachment', AttachmentTransformer],
];

/**
 * Resolves transformers via ModuleRef during onModuleInit to avoid empty
 * registration when constructor @Optional() deps are undefined under circular imports.
 */
@Injectable()
export class TransformerRegistry implements OnModuleInit {
  private readonly logger = new Logger('TransformerRegistry');
  private transformers: Record<string, EntityTransformer> = {};

  // Explicit @Inject: SWC emitDecoratorMetadata collapses constructor types to Object
  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    for (const [entityType, token] of TRANSFORMER_ENTRIES) {
      try {
        const transformer = this.moduleRef.get(token, { strict: false });
        if (transformer) {
          this.transformers[entityType] = transformer;
        } else {
          this.logger.warn(
            `TransformerRegistry.onModuleInit — ${entityType} resolved to undefined`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `TransformerRegistry.onModuleInit — ${entityType} unavailable: ${(err as Error).message}`,
        );
      }
    }

    const registered = Object.keys(this.transformers);
    this.logger.log(
      `TransformerRegistry.onModuleInit — registered: ${registered.join(', ') || '(none)'}`,
    );
    if (registered.length === 0) {
      this.logger.error(
        'TransformerRegistry.onModuleInit — no transformers registered',
      );
    }
  }

  get(entityType: string): EntityTransformer | undefined {
    return this.transformers[entityType];
  }
}
