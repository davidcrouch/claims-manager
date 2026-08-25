/**
 * Official Crunchwork Insurance REST API task types.
 * Source: CW taskType lookup (IdNameExternalReference on GET /tasks/{id}).
 */
export const CW_TASK_TYPES = [
  'Book Accommodation',
  'Book Site Attendance',
  'Call to Schedule',
  'Check out Date Changes',
  'Collect Excess',
  'Commence Repairs',
  'Customer Complaint',
  'Follow-up with Customer',
  'Make Safe Required',
  'Quote Review Required',
  'Repair Update',
  'Schedule Repairs',
  'Send Excess',
  'Send Scope/Contract',
  'Signed Scope/Contract',
  'Specialist Required',
  'Submission Required',
  'Submit Report',
  'Upload Completion Certificate',
] as const;

export type CwTaskType = (typeof CW_TASK_TYPES)[number];

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Extract canonical task type name from a Crunchwork task payload or API response.
 */
export function extractCwTaskTypeName(
  payload: Record<string, unknown> | null | undefined,
): string | null {
  if (!payload) return null;

  const taskTypeField = payload.taskType ?? payload.taskTypeLookupId;
  if (taskTypeField && typeof taskTypeField === 'object' && !Array.isArray(taskTypeField)) {
    const obj = taskTypeField as Record<string, unknown>;
    return (
      asNonEmptyString(obj.name) ??
      asNonEmptyString(obj.externalReference) ??
      asNonEmptyString(obj.id)
    );
  }

  return asNonEmptyString(taskTypeField);
}
