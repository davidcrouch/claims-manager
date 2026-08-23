import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Type } from '@nestjs/common';
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

const USE_CASE_ENTRIES: Array<[string, Type<ProjectionUseCase>]> = [
  ['claim', ProjectClaimUseCase],
  ['job', ProjectJobUseCase],
  ['quote', ProjectQuoteUseCase],
  ['purchase_order', ProjectPurchaseOrderUseCase],
  ['invoice', ProjectInvoiceUseCase],
  ['task', ProjectTaskUseCase],
  ['message', ProjectMessageUseCase],
  ['appointment', ProjectAppointmentUseCase],
  ['report', ProjectReportUseCase],
  ['attachment', ProjectAttachmentUseCase],
];

/**
 * Resolves projection use cases via ModuleRef during onModuleInit so the
 * Domain ↔ External circular import cannot leave @Optional() deps undefined
 * and silently register an empty mapper set (skipped_no_mapper on every webhook).
 */
@Injectable()
export class UseCaseRegistry implements OnModuleInit {
  private readonly logger = new Logger('UseCaseRegistry');
  private useCases: Record<string, ProjectionUseCase> = {};

  // Explicit @Inject: SWC emitDecoratorMetadata collapses constructor types to Object
  constructor(@Inject(ModuleRef) private readonly moduleRef: ModuleRef) {}

  onModuleInit(): void {
    for (const [entityType, token] of USE_CASE_ENTRIES) {
      try {
        const useCase = this.moduleRef.get(token, { strict: false });
        if (useCase) {
          this.useCases[entityType] = useCase;
        } else {
          this.logger.warn(
            `UseCaseRegistry.onModuleInit — ${entityType} resolved to undefined`,
          );
        }
      } catch (err) {
        this.logger.error(
          `UseCaseRegistry.onModuleInit — ${entityType} unavailable: ${(err as Error).message}`,
          (err as Error).stack,
        );
      }
    }

    const registered = Object.keys(this.useCases);
    this.logger.log(
      `UseCaseRegistry.onModuleInit — registered: ${registered.join(', ') || '(none)'}`,
    );
    if (registered.length === 0) {
      this.logger.error(
        'UseCaseRegistry.onModuleInit — no use cases registered; inbound projections will be skipped_no_mapper',
      );
    }
  }

  get(entityType: string): ProjectionUseCase | undefined {
    return this.useCases[entityType];
  }

  listRegistered(): string[] {
    return Object.keys(this.useCases);
  }
}
