import type { ScheduleEventType } from '@/types/api';

/** Event types that open an in-page drawer instead of navigating away. */
export function scheduleEventUsesDrawer(eventType: ScheduleEventType): boolean {
  return eventType === 'task' || eventType === 'appointment';
}

/** Map a schedule event to a registry drawer open request. */
export function scheduleEventDrawerRequest(
  eventType: ScheduleEventType,
  id: string,
): { component: string; props: Record<string, unknown> } | null {
  switch (eventType) {
    case 'task':
      return { component: 'TaskDetailDrawer', props: { taskId: id } };
    case 'appointment':
      return { component: 'AppointmentFormDrawer', props: { appointmentId: id } };
    default:
      return null;
  }
}

/** Resolve the app route for schedule entries that have detail pages. */
export function scheduleEventHref(eventType: ScheduleEventType, id: string): string {
  switch (eventType) {
    case 'appointment':
      return `/appointments?open=${encodeURIComponent(id)}`;
    case 'task':
      return `/tasks?open=${encodeURIComponent(id)}`;
    case 'work_order':
      return `/work-orders/${id}`;
    case 'purchase_order':
      return `/purchase-orders/${id}`;
    case 'rfq':
      return `/rfqs/${id}`;
    case 'bill':
      return `/bills/${id}`;
    case 'quote':
      return `/quotes/${id}`;
    default:
      return '/schedule';
  }
}
