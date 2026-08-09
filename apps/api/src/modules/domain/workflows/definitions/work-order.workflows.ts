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
        { to: 'accepted', action: 'accept', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
      transitions: [
        { to: 'scheduled', action: 'schedule', onEnter: ['syncStatusLookup'] },
        { to: 'in_progress', action: 'start', onEnter: ['syncStatusLookup'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'scheduled',
      label: 'Scheduled',
      transitions: [
        { to: 'in_progress', action: 'start', onEnter: ['syncStatusLookup'] },
        { to: 'accepted', action: 'unschedule', onEnter: ['syncStatusLookup'] },
      ],
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      transitions: [
        { to: 'completed', action: 'complete', onEnter: ['syncStatusLookup', 'enableInvoiceCreation', 'publishCrossTenantEvent'] },
        { to: 'accepted', action: 'pause', onEnter: ['syncStatusLookup'] },
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
