/**
 * Allowed message subjects (CW messageType.externalReference values).
 * Enforced at the API layer only — not a DB constraint — so the list can change.
 */
export const MESSAGE_SUBJECTS = [
  'Contentious claim',
  'General',
  'Repair Update',
  'Status Update',
  'Customer Complaint - Supplier Services',
  'Vulnerable Customer',
  'Customer Complaint - Insurance Services',
  'Cancellation Request',
  'Cash Settlement Request',
  'Update Required',
] as const;

export type MessageSubject = (typeof MESSAGE_SUBJECTS)[number];

export function isMessageSubject(value: unknown): value is MessageSubject {
  return typeof value === 'string' && (MESSAGE_SUBJECTS as readonly string[]).includes(value);
}
