import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, LookupRequest, ParentRef } from './transformer.interface';
import { asString, asNumericString, asTimestamp, isPlainObject } from './transform-utils';

const PRIORITY_MAP: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const STATUS_MAP: Record<string, string> = {
  open: 'Open',
  'in progress': 'In Progress',
  'in_progress': 'In Progress',
  'inprogress': 'In Progress',
  'on hold': 'On Hold',
  'on_hold': 'On Hold',
  'onhold': 'On Hold',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
};

@Injectable()
export class TaskTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const lookups: LookupRequest[] = [];
    const parentRefs: ParentRef[] = [];

    const rawPriority = (asString(payload.priority) ?? 'low').toLowerCase();
    const rawStatus = (asString(payload.status) ?? 'open').toLowerCase();

    // createdBy user reference
    const createdByRef = isPlainObject(payload.createdBy)
      ? asString(payload.createdBy.externalReference)
      : asString(payload.createdByUserId);

    const entity: Record<string, unknown> = {
      tenantId,
      name: asString(payload.name) ?? 'Untitled Task',
      description: asString(payload.description),
      startDate: asTimestamp(payload.startDate),
      dueDate: asTimestamp(payload.dueDate),
      reminderAt: asTimestamp(payload.reminderAt),
      estimatedHours: asNumericString(payload.estimatedHours),
      notes: asString(payload.notes),
      tags: Array.isArray(payload.tags) ? payload.tags.filter((t): t is string => typeof t === 'string') : undefined,
      completedAt: asTimestamp(payload.completedAt),
      priority: PRIORITY_MAP[rawPriority] ?? 'Low',
      status: STATUS_MAP[rawStatus] ?? 'Open',
      assignedToExternalReference: asString(payload.assignedTo),
      createdByUserId: createdByRef,
      taskPayload: payload,
    };

    // Lookups — taskType (object or bare-string); also set text taskType when present
    const taskTypeField = payload.taskType ?? payload.taskTypeLookupId;
    if (isPlainObject(taskTypeField)) {
      const typeName =
        asString((taskTypeField as Record<string, unknown>).name) ??
        asString((taskTypeField as Record<string, unknown>).externalReference);
      if (typeName) entity.taskType = typeName;
      const extRef = asString((taskTypeField as Record<string, unknown>).externalReference) ?? asString((taskTypeField as Record<string, unknown>).name) ?? asString((taskTypeField as Record<string, unknown>).id);
      if (extRef) lookups.push({ field: 'taskTypeLookupId', domain: 'task_type', externalReference: extRef, name: asString((taskTypeField as Record<string, unknown>).name), autoCreate: true });
    } else if (typeof taskTypeField === 'string' && taskTypeField.trim()) {
      entity.taskType = taskTypeField.trim();
      lookups.push({ field: 'taskTypeLookupId', domain: 'task_type', externalReference: taskTypeField.trim(), name: taskTypeField.trim(), autoCreate: true });
    }

    // Parents: claim and/or job — handle both flat and nested.
    // required: true so resolveParents throws ParentNotProjectedError with the
    // provider ID, enabling inline recovery via ParentRecoveryService.
    const cwClaimId = this.extractProviderId(payload.claimId, payload.claim);
    if (cwClaimId) {
      const nested = isPlainObject(payload.claim) ? (payload.claim as Record<string, unknown>) : undefined;
      parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: true, nestedPayload: nested });
    }

    const cwJobId = this.extractProviderId(payload.jobId, payload.job);
    if (cwJobId) {
      const nested = isPlainObject(payload.job) ? (payload.job as Record<string, unknown>) : undefined;
      parentRefs.push({ entityType: 'job', externalId: cwJobId, required: true, nestedPayload: nested });
    }

    return { entity, lookups, parentRefs };
  }

  private extractProviderId(flat: unknown, nested: unknown): string | undefined {
    if (typeof flat === 'string' && flat.length > 0) return flat;
    if (isPlainObject(nested)) {
      const id = asString(nested.id);
      if (id) return id;
    }
    return undefined;
  }
}
