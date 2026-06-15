import { Injectable, Logger } from '@nestjs/common';
import { CrunchworkService } from '../../../../crunchwork/crunchwork.service';
import type { OutboundAdapter, OutboundAdapterPushParams } from '../outbound-adapter.interface';

@Injectable()
export class CrunchworkOutboundAdapter implements OutboundAdapter {
  private readonly logger = new Logger('CrunchworkOutboundAdapter');

  constructor(private readonly crunchwork: CrunchworkService) {}

  async push(params: OutboundAdapterPushParams): Promise<void> {
    const { connectionId, entityType, entityId, action, payload } = params;

    this.logger.log(
      `CrunchworkOutboundAdapter.push — ${entityType}:${entityId} action=${action}`,
    );

    switch (entityType) {
      case 'job':
        await this.pushJob(connectionId, entityId, action, payload);
        break;
      case 'invoice':
        await this.pushInvoice(connectionId, entityId, action, payload);
        break;
      case 'quote':
        await this.pushQuote(connectionId, entityId, action, payload);
        break;
      case 'purchase_order':
        await this.pushPurchaseOrder(connectionId, entityId, action, payload);
        break;
      case 'task':
        await this.pushTask(connectionId, entityId, action, payload);
        break;
      case 'message':
        await this.pushMessage(connectionId, entityId, action, payload);
        break;
      case 'appointment':
        await this.pushAppointment(connectionId, entityId, action, payload);
        break;
      case 'report':
        await this.pushReport(connectionId, entityId, action, payload);
        break;
      case 'attachment':
        await this.pushAttachment(connectionId, entityId, action, payload);
        break;
      default:
        this.logger.warn(
          `CrunchworkOutboundAdapter.push — unsupported entityType '${entityType}'`,
        );
    }
  }

  private async pushJob(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      // Job creation not yet supported outbound
      this.logger.warn('CrunchworkOutboundAdapter.pushJob — create not supported');
      return;
    }
    await this.crunchwork.updateJob({
      connectionId,
      jobId: externalId,
      body: this.transformJobPayload(action, payload),
    });
  }

  private async pushInvoice(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create' || action === 'issue') {
      await this.crunchwork.createInvoice({ connectionId, body: payload });
      return;
    }
    await this.crunchwork.updateInvoice({ connectionId, invoiceId: externalId, body: payload });
  }

  private async pushQuote(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      // Quote creation — pass-through
      this.logger.warn('CrunchworkOutboundAdapter.pushQuote — create not yet mapped');
      return;
    }
    // For update/status_change, use the get + compare pattern (future)
    this.logger.debug(`CrunchworkOutboundAdapter.pushQuote — ${action} for ${externalId}`);
  }

  private async pushPurchaseOrder(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    await this.crunchwork.updatePurchaseOrder({
      connectionId,
      purchaseOrderId: externalId,
      body: payload,
    });
  }

  private async pushTask(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      await this.crunchwork.createTask({ connectionId, body: payload });
      return;
    }
    await this.crunchwork.updateTask({ connectionId, taskId: externalId, body: payload });
  }

  private async pushMessage(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    if (action === 'create') {
      await this.crunchwork.createMessage({ connectionId, body: payload });
      return;
    }
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'acknowledge') {
      await this.crunchwork.acknowledgeMessage({ connectionId, messageId: externalId });
    }
  }

  private async pushAppointment(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      await this.crunchwork.createAppointment({ connectionId, body: payload });
      return;
    }
    if (action === 'cancel') {
      await this.crunchwork.cancelAppointment({
        connectionId,
        appointmentId: externalId,
        body: payload,
      });
      return;
    }
    await this.crunchwork.updateAppointment({
      connectionId,
      appointmentId: externalId,
      body: payload,
    });
  }

  private async pushReport(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    await this.crunchwork.updateReport({ connectionId, reportId: externalId, body: payload });
  }

  private async pushAttachment(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      await this.crunchwork.createAttachment({ connectionId, body: payload });
      return;
    }
    await this.crunchwork.updateAttachment({
      connectionId,
      attachmentId: externalId,
      body: payload,
    });
  }

  private transformJobPayload(
    action: string,
    payload: Record<string, unknown>,
  ): Record<string, unknown> {
    if (action === 'status_change') {
      return { status: payload.step ?? payload.status };
    }
    return payload;
  }
}
