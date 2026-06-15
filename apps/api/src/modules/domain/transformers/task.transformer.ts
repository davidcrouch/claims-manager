import { Injectable } from '@nestjs/common';
import type { EntityTransformer, TransformResult, ParentRef } from './transformer.interface';
import { asString, asTimestamp, isPlainObject } from './transform-utils';

const PRIORITY_MAP: Record<string, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const STATUS_MAP: Record<string, string> = { open: 'Open', completed: 'Completed', failed: 'Failed' };

@Injectable()
export class TaskTransformer implements EntityTransformer {
  transform(params: {
    payload: Record<string, unknown>;
    tenantId: string;
    existingEntity?: Record<string, unknown>;
  }): TransformResult<Record<string, unknown>> {
    const { payload, tenantId } = params;
    const parentRefs: ParentRef[] = [];

    const rawPriority = (asString(payload.priority) ?? 'low').toLowerCase();
    const rawStatus = (asString(payload.status) ?? 'open').toLowerCase();

    const entity: Record<string, unknown> = {
      tenantId,
      name: asString(payload.name) ?? 'Untitled Task',
      description: asString(payload.description),
      dueDate: asTimestamp(payload.dueDate),
      priority: PRIORITY_MAP[rawPriority] ?? 'Low',
      status: STATUS_MAP[rawStatus] ?? 'Open',
      assignedToExternalReference: asString(payload.assignedTo),
      taskPayload: payload,
    };

    // Parents: claim and/or job
    const cwClaimId = this.extractProviderId(payload.claimId, payload.claim);
    if (cwClaimId) parentRefs.push({ entityType: 'claim', externalId: cwClaimId, required: false });

    const cwJobId = this.extractProviderId(payload.jobId, payload.job);
    if (cwJobId) parentRefs.push({ entityType: 'job', externalId: cwJobId, required: false });

    return { entity, lookups: [], parentRefs };
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
