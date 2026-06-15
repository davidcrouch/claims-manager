import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, ParentRef } from './transformer.interface';
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
    const parentRefs: ParentRef[] = [];

    const locationRaw = (asString(payload.location) ?? '').toUpperCase();
    const location = VALID_LOCATIONS.has(locationRaw) ? locationRaw : 'ONSITE';
    const startDate = asTimestamp(payload.startDate);
    const endDate = asTimestamp(payload.endDate);

    const entity: Record<string, unknown> = {
      tenantId,
      name: asString(payload.name) ?? 'Untitled Appointment',
      location,
      startDate,
      endDate,
      status: asString(payload.status),
      appointmentPayload: payload,
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

    // Parent: job (required for new appointments)
    const cwJobId = isPlainObject(payload.job) ? asString(payload.job.id) : undefined;
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: !params.existingEntity });

    return { entity, lookups: [], parentRefs };
  }
}
