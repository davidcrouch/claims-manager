import type { WorkflowDefinition } from '../workflow.interface';

export const workOrderStandard: WorkflowDefinition = {
  entity: 'work_order',
  name: 'standard',
  description: 'Standard WO lifecycle: received → acceptance → execution → completion',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'accepted', action: 'accept', onEnter: ['publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
      transitions: [
        { to: 'scheduled', action: 'schedule' },
        { to: 'in_progress', action: 'start' },
        { to: 'declined', action: 'decline', onEnter: ['publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      transitions: [
        { to: 'in_progress', action: 'start' },
        { to: 'accepted', action: 'unschedule' },
      ],
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      transitions: [
        { to: 'completed', action: 'complete', onEnter: ['publishCrossTenantEvent'] },
        { to: 'accepted', action: 'pause' },
      ],
    },
    {
      id: 'completed',
      label: 'Completed',
      isFinal: true,
      transitions: [],
    },
    {
      id: 'declined',
      label: 'Declined',
      isFinal: true,
      transitions: [],
    },
  ],
};
