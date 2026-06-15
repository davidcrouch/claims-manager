import type { WorkflowDefinition } from '../workflow.interface';

export const contactOnboarding: WorkflowDefinition = {
  entity: 'contact',
  name: 'onboarding',
  description: 'New contact onboarding flow',
  initialStep: 'pending',
  steps: [
    {
      id: 'pending',
      label: 'Pending Verification',
      transitions: [
        { to: 'verified', action: 'verify', guards: ['hasEmailOrPhone'] },
        { to: 'rejected', action: 'reject' },
      ],
    },
    {
      id: 'verified',
      label: 'Verified',
      transitions: [
        { to: 'active', action: 'activate' },
      ],
    },
    {
      id: 'active',
      label: 'Active',
      isFinal: true,
      transitions: [],
    },
    {
      id: 'rejected',
      label: 'Rejected',
      isFinal: true,
      transitions: [],
    },
  ],
};

export const contactRemoval: WorkflowDefinition = {
  entity: 'contact',
  name: 'removal',
  description: 'Contact removal/offboarding flow',
  initialStep: 'active',
  steps: [
    {
      id: 'active',
      label: 'Active',
      transitions: [
        { to: 'pending_removal', action: 'request_removal' },
      ],
    },
    {
      id: 'pending_removal',
      label: 'Pending Removal',
      transitions: [
        { to: 'removed', action: 'confirm_removal' },
        { to: 'active', action: 'cancel' },
      ],
    },
    {
      id: 'removed',
      label: 'Removed',
      isFinal: true,
      transitions: [],
    },
  ],
};
