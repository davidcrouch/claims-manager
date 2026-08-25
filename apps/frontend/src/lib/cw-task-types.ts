/** Official Crunchwork task types — keep in sync with apps/api/src/modules/tasks/cw-task-types.ts */
export const CW_TASK_TYPES = [
  'Book Accommodation',
  'Book Site Attendance',
  'Call to Schedule',
  'Check out Date Changes',
  'Collect Excess',
  'Commence Repairs',
  'Customer Complaint',
  'Follow-up with Customer',
  'Make Safe Required',
  'Quote Review Required',
  'Repair Update',
  'Schedule Repairs',
  'Send Excess',
  'Send Scope/Contract',
  'Signed Scope/Contract',
  'Specialist Required',
  'Submission Required',
  'Submit Report',
  'Upload Completion Certificate',
] as const;

export type CwTaskType = (typeof CW_TASK_TYPES)[number];
