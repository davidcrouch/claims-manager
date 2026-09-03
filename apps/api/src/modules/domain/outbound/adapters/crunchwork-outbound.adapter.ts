import { Injectable, Logger } from '@nestjs/common';
import { CrunchworkService } from '../../../../crunchwork/crunchwork.service';
import { applyCrunchworkJobDates } from '../../../jobs/job-outbound.utils';
import {
  applyInvoicedAmountOverridesToGroups,
  applyLocalPricingToCrunchworkInvoiceGroups,
  crunchworkInvoiceGroupsFromPayload,
  toInvoiceUpdateGroups,
} from '../../../invoices/invoice-publish.utils';
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
    if (action === 'publish') {
      const purchaseOrderId = payload.purchaseOrderId as string;
      const reusedCwInvoiceId = payload.reusedCwInvoiceId as string | undefined;

      let cwInvoiceId: string;
      let apiObj: Record<string, unknown>;

      if (reusedCwInvoiceId) {
        apiObj = await this.crunchwork.getInvoice({ connectionId, invoiceId: reusedCwInvoiceId });
        cwInvoiceId = reusedCwInvoiceId;
      } else {
        const createBody = {
          purchaseOrderId,
          invoiceType: { externalReference: 'Invoice' },
        };
        const createResponse = await this.crunchwork.createInvoice({ connectionId, body: createBody });
        const createObj = createResponse as Record<string, unknown>;
        cwInvoiceId = createObj.id as string;
        if (!cwInvoiceId) {
          throw new Error('Crunchwork did not return an invoice id after create');
        }
        apiObj = createObj;
      }

      const localGroups = Array.isArray(payload.localGroups)
        ? (payload.localGroups as Record<string, unknown>[])
        : [];
      const invoicedAmounts =
        payload.invoicedAmounts &&
        typeof payload.invoicedAmounts === 'object' &&
        !Array.isArray(payload.invoicedAmounts)
          ? (payload.invoicedAmounts as Record<string, number>)
          : undefined;

      if (localGroups.length > 0) {
        let cwGroups = crunchworkInvoiceGroupsFromPayload(apiObj);
        if (cwGroups.length === 0) {
          const fetched = await this.crunchwork.getInvoice({
            connectionId,
            invoiceId: cwInvoiceId,
          });
          cwGroups = crunchworkInvoiceGroupsFromPayload(fetched);
          apiObj = fetched;
        }
        if (cwGroups.length > 0) {
          const priced = applyLocalPricingToCrunchworkInvoiceGroups({
            cwGroups,
            localGroups,
          });
          const allocated = applyInvoicedAmountOverridesToGroups({
            groups: priced,
            invoicedAmounts,
          });
          const updateGroups = toInvoiceUpdateGroups(allocated);
          if (updateGroups.length > 0) {
            const updateBody: Record<string, unknown> = { groups: updateGroups };
            if (typeof payload.vendorInvoiceNumber === 'string' && payload.vendorInvoiceNumber) {
              updateBody.vendorInvoiceNumber = payload.vendorInvoiceNumber;
            }
            if (typeof payload.issueDate === 'string' && payload.issueDate) {
              updateBody.issueDate = payload.issueDate;
            }
            if (typeof payload.note === 'string' && payload.note) {
              updateBody.note = payload.note;
            }
            this.logger.log(
              `CrunchworkOutboundAdapter.pushInvoice — updating ${cwInvoiceId} groups=${updateGroups.length}`,
            );
            apiObj = (await this.crunchwork.updateInvoice({
              connectionId,
              invoiceId: cwInvoiceId,
              body: updateBody,
            })) as Record<string, unknown>;
          }
        }
      }

      return {
        externalReference: cwInvoiceId,
        responsePayload: apiObj,
      };
    }

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
    if (action === 'publish') {
      const createBody = (payload.createBody ?? payload) as Record<string, unknown>;
      const publishBody = (payload.publishBody ?? { status: 'Published' }) as Record<string, unknown>;

      const createResponse = await this.crunchwork.createQuote({ connectionId, body: createBody });
      const createObj = createResponse as Record<string, unknown>;
      const cwQuoteId = createObj.id as string;
      if (!cwQuoteId) {
        throw new Error('Crunchwork did not return a quote id after upload');
      }

      const updateResponse = await this.crunchwork.updateQuote({
        connectionId,
        quoteId: cwQuoteId,
        body: publishBody,
      });

      return {
        externalReference: cwQuoteId,
        responsePayload: updateResponse as Record<string, unknown>,
      };
    }

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
    const cwId = this.cwTaskId(payload);
    const body = this.taskBody(payload);

    // Updates must not send taskType: IAG returns name/id only
    // (externalReference is null on some types). Creates always use
    // externalReference (the canonical display name).
    if (action !== 'create' && cwId) {
      delete body.taskType;
    } else if (!this.hasCwTaskType(body.taskType)) {
      delete body.taskType;
    }

    if (action === 'create' || !cwId) {
      if (action !== 'create') {
        this.logger.log(
          `CrunchworkOutboundAdapter.pushTask — no Crunchwork id for ${entityId}, creating instead of ${action}`,
        );
      }
      const response = await this.crunchwork.createTask({ connectionId, body });
      const responseObj = response as Record<string, unknown>;
      const cwIdFromResponse = this.extractResponseId(responseObj);
      if (!cwIdFromResponse) {
        this.logger.warn(
          `CrunchworkOutboundAdapter.pushTask — create succeeded for ${entityId} but response had no id`,
        );
      }
      return {
        externalReference: cwIdFromResponse,
        responsePayload: responseObj,
      };
    }

    const response = await this.crunchwork.updateTask({
      connectionId,
      taskId: cwId,
      body,
    });
    return { responsePayload: response as Record<string, unknown> };
  }

  private cwTaskId(payload: Record<string, unknown>): string | null {
    const raw = payload.externalId;
    if (typeof raw !== 'string') return null;
    const id = raw.trim();
    return UUID_RE.test(id) ? id : null;
  }

  private hasCwTaskType(taskType: unknown): boolean {
    if (typeof taskType === 'string') return taskType.trim().length > 0;
    if (!taskType || typeof taskType !== 'object' || Array.isArray(taskType)) return false;
    const obj = taskType as Record<string, unknown>;
    for (const key of ['id', 'externalReference'] as const) {
      const raw = obj[key];
      if (typeof raw === 'string' && raw.trim()) return true;
    }
    return false;
  }

  private taskBody(payload: Record<string, unknown>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const key of [
      'name',
      'jobId',
      'claimId',
      'description',
      'dueDate',
      'priority',
      'status',
      'taskType',
      'tag',
    ] as const) {
      if (payload[key] !== undefined) body[key] = payload[key];
    }

    if (typeof body.taskType === 'string' && body.taskType.trim()) {
      body.taskType = { externalReference: body.taskType.trim() };
    }

    const status = typeof body.status === 'string' ? body.status : '';
    if (status && status !== 'Open' && status !== 'Failed' && status !== 'Completed') {
      body.status = 'Open';
    }

    return body;
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

  private extractResponseId(response: Record<string, unknown>): string | null {
    if (typeof response.id === 'string' && response.id.trim()) return response.id.trim();
    for (const nestedKey of ['data', 'appointment', 'task'] as const) {
      const nested = response[nestedKey];
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        const id = (nested as Record<string, unknown>).id;
        if (typeof id === 'string' && id.trim()) return id.trim();
      }
    }
    return null;
  }

  private cwAppointmentId(payload: Record<string, unknown>): string | null {
    const raw = payload.externalId;
    if (typeof raw !== 'string') return null;
    const id = raw.trim();
    return UUID_RE.test(id) ? id : null;
  }

  private appointmentBody(payload: Record<string, unknown>): Record<string, unknown> {
    const body: Record<string, unknown> = {};
    for (const key of [
      'name',
      'jobId',
      'location',
      'startDate',
      'endDate',
      'attendees',
      'appointmentType',
      'customData',
      'timezone',
    ] as const) {
      if (payload[key] !== undefined) body[key] = payload[key];
    }

    if (typeof body.appointmentType === 'string' && body.appointmentType.trim()) {
      body.appointmentType = { externalReference: body.appointmentType.trim() };
    }

    if (!body.customData || typeof body.customData !== 'object' || Array.isArray(body.customData)) {
      body.customData = {};
    }

    if (Array.isArray(body.attendees)) {
      body.attendees = body.attendees.map((raw) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
        const attendee = raw as Record<string, unknown>;
        if (attendee.type && attendee.attendeeValue && typeof attendee.attendeeValue === 'object') {
          const value = attendee.attendeeValue as Record<string, unknown>;
          const attendeeValue: Record<string, unknown> = {
            name: typeof value.name === 'string' ? value.name : '',
          };
          if (typeof value.externalReference === 'string' && value.externalReference.trim()) {
            attendeeValue.externalReference = value.externalReference.trim();
          }
          return { type: attendee.type, attendeeValue };
        }
        const attendeeValue: Record<string, unknown> = {
          name: typeof attendee.name === 'string' ? attendee.name : '',
        };
        if (typeof attendee.externalReference === 'string' && attendee.externalReference.trim()) {
          attendeeValue.externalReference = attendee.externalReference.trim();
        }
        return {
          type: (attendee.attendeeType as string) ?? 'CONTACT',
          attendeeValue,
        };
      });
    }

    return body;
  }

  private async pushAppointment(
    connectionId: string,
    entityId: string,
    action: string,
    payload: Record<string, unknown>,
  ): Promise<OutboundPushResult> {
    const cwId = this.cwAppointmentId(payload);
    const body = this.appointmentBody(payload);

    if (action === 'cancel') {
      if (!cwId) {
        throw new Error(
          `CrunchworkOutboundAdapter.pushAppointment — cannot cancel ${entityId} without a Crunchwork appointment id`,
        );
      }
      const response = await this.crunchwork.cancelAppointment({
        connectionId,
        appointmentId: cwId,
        body,
      });
      return { responsePayload: response as Record<string, unknown> };
    }

    if (action === 'create' || !cwId) {
      if (action !== 'create') {
        this.logger.log(
          `CrunchworkOutboundAdapter.pushAppointment — no Crunchwork id for ${entityId}, creating instead of ${action}`,
        );
      }
      const response = await this.crunchwork.createAppointment({ connectionId, body });
      const responseObj = response as Record<string, unknown>;
      const cwIdFromResponse = this.extractResponseId(responseObj);
      if (!cwIdFromResponse) {
        this.logger.warn(
          `CrunchworkOutboundAdapter.pushAppointment — create succeeded for ${entityId} but response had no id`,
        );
      }
      return {
        externalReference: cwIdFromResponse,
        responsePayload: responseObj,
      };
    }

    const response = await this.crunchwork.updateAppointment({
      connectionId,
      appointmentId: cwId,
      body,
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

    // Strip internal-only keys; flatten type-detail JSON blobs to CW top-level fields.
    const omit = new Set([
      'externalId',
      'status',
      'statusLookupId',
      'jobTypeLookupId',
      'assignedToUserId',
      'customData',
      'cwCustomData',
      'temporaryAccommodationDetails',
      'specialistDetails',
      'rectificationDetails',
      'auditDetails',
      'apiPayload',
      'vendorSnapshot',
      'vendorId',
      'claimId',
      'name',
      'parentJobId',
      'address',
    ]);

    const out: Record<string, unknown> = {};
    for (const key of [
      'temporaryAccommodationDetails',
      'specialistDetails',
      'rectificationDetails',
      'auditDetails',
    ] as const) {
      const details = payload[key];
      if (details && typeof details === 'object' && !Array.isArray(details)) {
        Object.assign(out, details as Record<string, unknown>);
      }
    }

    for (const [key, value] of Object.entries(payload)) {
      if (omit.has(key) || value === undefined) continue;
      out[key] = value;
    }

    const withDates = applyCrunchworkJobDates(out, payload);
    if (withDates.customData !== out.customData) {
      this.logger.debug(
        'CrunchworkOutboundAdapter.transformJobPayload — including bookedDate/attendanceDate in CW customData',
      );
    }
    return withDates;
  }
}
