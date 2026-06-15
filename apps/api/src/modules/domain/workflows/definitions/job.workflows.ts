import type { WorkflowDefinition } from '../workflow.interface';

export const jobStandard: WorkflowDefinition = {
  entity: 'job',
  name: 'standard',
  description: 'Standard job lifecycle from assignment to completion',
  initialStep: 'received',
  steps: [
    {
      id: 'received',
      label: 'Received',
      transitions: [
        { to: 'accepted', action: 'accept' },
        { to: 'declined', action: 'decline' },
      ],
    },
    {
      id: 'accepted',
      label: 'Accepted',
      transitions: [
        { to: 'in_progress', action: 'start' },
      ],
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      transitions: [
        { to: 'on_hold', action: 'hold' },
        { to: 'pending_completion', action: 'complete', guards: ['allTasksClosed'] },
      ],
    },
    {
      id: 'on_hold',
      label: 'On Hold',
      transitions: [
        { to: 'in_progress', action: 'resume' },
      ],
    },
    {
      id: 'pending_completion',
      label: 'Pending Completion',
      transitions: [
        { to: 'completed', action: 'finalize', onEnter: ['syncOutbound'] },
        { to: 'in_progress', action: 'reopen' },
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
