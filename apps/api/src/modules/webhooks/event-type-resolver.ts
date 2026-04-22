/**
 * Shared mapping from Crunchwork webhook event types to the normalized
 * provider entity type used across the webhook pipeline and the More0
 * `claims-manager-webhook` app.
 *
 * Historically this lived as a static helper on `ExternalToolsController`.
 * It was extracted so the More0 tool implementations can be hosted inside
 * `apps/api/more0/src/` without creating a dependency from that app back
 * into the webhooks module.
 */
export const EVENT_TYPE_TO_ENTITY: Record<string, string> = {
  NEW_JOB: 'job',
  UPDATE_JOB: 'job',
  NEW_CLAIM: 'claim',
  UPDATE_CLAIM: 'claim',
  NEW_PURCHASE_ORDER: 'purchase_order',
  UPDATE_PURCHASE_ORDER: 'purchase_order',
  NEW_INVOICE: 'invoice',
  UPDATE_INVOICE: 'invoice',
  NEW_MESSAGE: 'message',
  NEW_TASK: 'task',
  UPDATE_TASK: 'task',
  NEW_ATTACHMENT: 'attachment',
  UPDATE_ATTACHMENT: 'attachment',
  NEW_QUOTE: 'quote',
  UPDATE_QUOTE: 'quote',
  NEW_REPORT: 'report',
  UPDATE_REPORT: 'report',
  NEW_APPOINTMENT: 'appointment',
  UPDATE_APPOINTMENT: 'appointment',
};

export function resolveEntityType(eventType: string): string | null {
  return EVENT_TYPE_TO_ENTITY[eventType] ?? null;
}
