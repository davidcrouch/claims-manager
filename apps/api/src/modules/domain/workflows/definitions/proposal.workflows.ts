import type { WorkflowDefinition } from '../workflow.interface';

export const proposalStandard: WorkflowDefinition = {
  entity: 'proposal',
  name: 'standard',
  description: 'Standard proposal lifecycle: received → under review → accepted/declined',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'under_review', action: 'review' },
        { to: 'accepted', action: 'accept', onEnter: ['publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'under_review',
      label: 'Under Review',
      transitions: [
        { to: 'accepted', action: 'accept', onEnter: ['publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
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
