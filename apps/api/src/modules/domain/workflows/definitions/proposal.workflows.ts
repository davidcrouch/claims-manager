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
        { to: 'under_review', action: 'review', onEnter: ['syncStatusLookup'] },
        { to: 'accepted', action: 'accept', onEnter: ['syncStatusLookup', 'createPurchaseOrder', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'under_review',
      label: 'Under Review',
      transitions: [
        { to: 'accepted', action: 'accept', onEnter: ['syncStatusLookup', 'createPurchaseOrder', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
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
