import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asTimestamp, isPlainObject } from './transform-utils';

const VALID_LOCATIONS = new Set(['ONSITE', 'DIGITAL']);

@Injectable()
export class AppointmentTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    const locationRaw = (asString(payload.location) ?? '').toUpperCase();
    const location = VALID_LOCATIONS.has(locationRaw) ? locationRaw : 'ONSITE';
    const startDate = asTimestamp(payload.startDate);
    const endDate = asTimestamp(payload.endDate);

    // appointmentPayload bucket — store attendees, travel, notes, reminders
    const appointmentPayload: Record<string, unknown> = { ...payload as object };
    if (Array.isArray(payload.attendees)) appointmentPayload.attendees = payload.attendees;
    if (isPlainObject(payload.travel)) appointmentPayload.travel = payload.travel;
    if (asString(payload.notes)) appointmentPayload.notes = payload.notes;
    if (Array.isArray(payload.reminders)) appointmentPayload.reminders = payload.reminders;

    // cancellationDetails — stored in its own column
    const cancellationDetails = isPlainObject(payload.cancellationDetails) ? payload.cancellationDetails : {};

    const entity: Record<string, unknown> = {
      tenantId,
      name: asString(payload.name) ?? 'Untitled Appointment',
      location,
      startDate,
      endDate,
      status: asString(payload.status),
      cancellationDetails,
      appointmentPayload,
    };

    // Skip on create if missing required dates (update path is fine)
    if (!params.existingEntity && (!startDate || !endDate)) {
      return {
        entity,
        lookups: [],
        parentRefs: [],
        skip: 'skipped_incomplete_payload',
      };
    }

    // Parent: job — nested object or flat string (required for new appointments)
    const cwJobId = isPlainObject(payload.job)
      ? asString((payload.job as Record<string, unknown>).id)
      : asString(payload.jobId);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: !params.existingEntity });

    // Parent: claim — nested object or flat string (no column, resolved via projection)
    const cwClaimId = isPlainObject(payload.claim)
      ? asString((payload.claim as Record<string, unknown>).id)
      : asString(payload.claimId);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    // Lookups — appointmentType (object or bare-string)
    if (isPlainObject(payload.appointmentType)) {
      const extRef = asString(payload.appointmentType.externalReference) ?? asString(payload.appointmentType.name) ?? asString(payload.appointmentType.id);
      if (extRef) lookups.push({ field: 'appointmentTypeLookupId', domain: 'appointment_type', externalReference: extRef, name: asString(payload.appointmentType.name), autoCreate: true });
    } else if (typeof payload.appointmentType === 'string' && payload.appointmentType.trim()) {
      lookups.push({ field: 'appointmentTypeLookupId', domain: 'appointment_type', externalReference: payload.appointmentType.trim(), name: payload.appointmentType.trim(), autoCreate: true });
    }

    return { entity, lookups, parentRefs };
  }
}
