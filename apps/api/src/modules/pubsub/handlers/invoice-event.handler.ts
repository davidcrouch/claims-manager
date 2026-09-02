import { Injectable, Logger, Inject } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../../database/drizzle.module';
import { bills, invoices } from '../../../database/schema';
import type { EventHandler } from '../pubsub-subscriber.service';
import type { DomainEventEnvelope } from '../envelope';

@Injectable()
export class InvoiceEventHandler implements EventHandler {
  readonly entityType = 'invoice';
  readonly eventTypes = [
    'invoice.submit',
    'invoice.approve',
    'invoice.decline',
  ];

  private readonly logger = new Logger('InvoiceEventHandler');

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async handle(envelope: DomainEventEnvelope): Promise<void> {
    const logPrefix = 'InvoiceEventHandler.handle';
    const { eventType } = envelope;

    this.logger.log(
      `${logPrefix} — processing ${eventType} for entity=${envelope.entityId}`,
    );

    switch (eventType) {
      case 'invoice.approve': {
        await this.updateLinkedBill(envelope, { invoiceApproved: true, invoiceApprovedAt: envelope.occurredAt });
        break;
      }
      case 'invoice.decline': {
        await this.updateLinkedBill(envelope, { invoiceDeclined: true, invoiceDeclinedAt: envelope.occurredAt });
        break;
      }
      default:
        this.logger.debug(`${logPrefix} — unhandled eventType=${eventType}`);
    }
  }

  private async updateLinkedBill(
    envelope: DomainEventEnvelope,
    statusUpdate: Record<string, unknown>,
  ) {
    const logPrefix = 'InvoiceEventHandler.updateLinkedBill';

    const [invoice] = await this.db
      .select({
        tenantId: invoices.tenantId,
        invoiceNumber: invoices.invoiceNumber,
      })
      .from(invoices)
      .where(eq(invoices.id, envelope.entityId))
      .limit(1);

    if (!invoice?.invoiceNumber) {
      this.logger.debug(`${logPrefix} — invoice=${envelope.entityId} missing invoiceNumber`);
      return;
    }

    const [bill] = await this.db
      .select({ id: bills.id })
      .from(bills)
      .where(
        and(
          eq(bills.sourceTenantId, invoice.tenantId),
          eq(bills.sourceExternalReference, invoice.invoiceNumber),
        ),
      )
      .limit(1);

    if (!bill) {
      this.logger.debug(`${logPrefix} — no linked bill for invoice=${envelope.entityId}`);
      return;
    }

    await this.db
      .update(bills)
      .set({
        billPayload: sql`COALESCE(${bills.billPayload}, '{}'::jsonb) || ${JSON.stringify(statusUpdate)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(bills.id, bill.id));

    this.logger.log(`${logPrefix} — updated bill=${bill.id} with invoice status: ${JSON.stringify(statusUpdate)}`);
  }
}
