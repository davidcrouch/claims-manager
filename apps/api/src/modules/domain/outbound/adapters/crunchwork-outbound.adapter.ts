import { Injectable, Logger } from '@nestjs/common';
import { CrunchworkService } from '../../../../crunchwork/crunchwork.service';
import type { OutboundAdapter, OutboundAdapterPushParams, OutboundPushResult } from '../outbound-adapter.interface';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class CrunchworkOutboundAdapter implements OutboundAdapter {
  private readonly logger = new Logger('CrunchworkOutboundAdapter');

  constructor(private readonly crunchwork: CrunchworkService) {}

  async push(params: OutboundAdapterPushParams): Promise<OutboundPushResult> {
    const { connectionId, entityType, entityId, action, payload } = params;

    this.logger.log(
      `CrunchworkOutboundAdapter.push — ${entityType}:${entityId} action=${action}`,
    );

    switch (entityType) {
      case 'job':
        return this.pushJob(connectionId, entityId, action, payload);
      case 'invoice':
        return this.pushInvoice(connectionId, entityId, action, payload);
      case 'quote':
        return this.pushQuote(connectionId, entityId, action, payload);
      case 'purchase_order':
        return this.pushPurchaseOrder(connectionId, entityId, action, payload);
      case 'task':
        return this.pushTask(connectionId, entityId, action, payload);
      case 'message':
        return this.pushMessage(connectionId, entityId, action, payload);
      case 'appointment':
        return this.pushAppointment(connectionId, entityId, action, payload);
      case 'report':
        return this.pushReport(connectionId, entityId, action, payload);
      case 'attachment':
        return this.pushAttachment(connectionId, entityId, action, payload);
      default:
        this.logger.warn(
          `CrunchworkOutboundAdapter.push — unsupported entityType '${entityType}'`,
        );
        return {};
    }
  }

  private async pushJob(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    if (action === 'create') {
      const response = await this.crunchwork.createJob({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }

    const externalId = (payload.externalId as string) ?? entityId;
    if (!UUID_RE.test(externalId)) {
      this.logger.warn(
        `CrunchworkOutboundAdapter.pushJob — externalId "${externalId}" is not a valid UUID, cannot sync to Crunchwork`,
      );
      return {};
    }
    const response = await this.crunchwork.updateJob({
      connectionId,
      jobId: externalId,
      body: this.transformJobPayload(action, payload),
    });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushInvoice(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create' || action === 'issue') {
      const response = await this.crunchwork.createInvoice({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    const response = await this.crunchwork.updateInvoice({ connectionId, invoiceId: externalId, body: payload });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushQuote(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    if (action === 'create') {
      const response = await this.crunchwork.createQuote({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    const externalId = (payload.externalId as string) ?? entityId;
    const response = await this.crunchwork.updateQuote({ connectionId, quoteId: externalId, body: payload });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushPurchaseOrder(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    const response = await this.crunchwork.updatePurchaseOrder({
      connectionId,
      purchaseOrderId: externalId,
      body: payload,
    });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushTask(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      const response = await this.crunchwork.createTask({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    const response = await this.crunchwork.updateTask({ connectionId, taskId: externalId, body: payload });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushMessage(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    if (action === 'create') {
      const response = await this.crunchwork.createMessage({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'acknowledge') {
      const response = await this.crunchwork.acknowledgeMessage({ connectionId, messageId: externalId });
      return { responsePayload: response as Record<string, unknown> };
    }
    return {};
  }

  private async pushAppointment(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      const response = await this.crunchwork.createAppointment({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    if (action === 'cancel') {
      const response = await this.crunchwork.cancelAppointment({
        connectionId,
        appointmentId: externalId,
        body: payload,
      });
      return { responsePayload: response as Record<string, unknown> };
    }
    const response = await this.crunchwork.updateAppointment({
      connectionId,
      appointmentId: externalId,
      body: payload,
    });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushReport(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    const response = await this.crunchwork.updateReport({ connectionId, reportId: externalId, body: payload });
    return { responsePayload: response as Record<string, unknown> };
  }

  private async pushAttachment(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const externalId = (payload.externalId as string) ?? entityId;
    if (action === 'create') {
      const response = await this.crunchwork.createAttachment({ connectionId, body: payload });
      const responseObj = response as Record<string, unknown>;
      return {
        externalReference: (responseObj.id as string) ?? null,
        responsePayload: responseObj,
      };
    }
    const response = await this.crunchwork.updateAttachment({
      connectionId,
      attachmentId: externalId,
      body: payload,
    });
    return { responsePayload: response as Record<string, unknown> };
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
