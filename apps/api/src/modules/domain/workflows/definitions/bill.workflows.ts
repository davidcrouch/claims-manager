import type { WorkflowDefinition } from '../workflow.interface';

export const billStandard: WorkflowDefinition = {
  entity: 'bill',
  name: 'standard',
  description:
    'Bill lifecycle: received → reviewed → approved/declined/disputed → paid',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'reviewed', action: 'approve', onEnter: ['syncStatusLookup'] },
        { to: 'under_review', action: 'review', onEnter: ['syncStatusLookup'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'reviewed',
      label: 'Reviewed',
      transitions: [
        { to: 'received', action: 'edit', onEnter: ['syncStatusLookup'] },
        { to: 'approved', action: 'confirm', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'paid', action: 'pay', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'under_review',
      label: 'Under Review',
      transitions: [
        { to: 'approved', action: 'approve', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
        { to: 'disputed', action: 'dispute', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'approved',
      label: 'Approved',
      transitions: [
        { to: 'paid', action: 'pay', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    {
      id: 'disputed',
      label: 'Disputed',
      transitions: [
        { to: 'under_review', action: 'review', onEnter: ['syncStatusLookup'] },
        { to: 'declined', action: 'decline', onEnter: ['syncStatusLookup', 'publishCrossTenantEvent'] },
      ],
    },
    { id: 'paid', label: 'Paid', isFinal: true, transitions: [] },
    {
      id: 'declined',
      label: 'Declined',
      transitions: [
        { to: 'received', action: 'edit', onEnter: ['syncStatusLookup'] },
      ],
    },
  ],
};
