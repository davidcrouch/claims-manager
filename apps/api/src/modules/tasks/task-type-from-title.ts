export type TaskTypeMatchMode = 'exact' | 'normalized' | 'prefix' | 'contains';

export interface TaskTypeMappingRule {
  titlePattern: string;
  matchMode: TaskTypeMatchMode | string;
  taskType: string;
  priority?: number;
  isActive?: boolean;
}

/** Canonical task type labels used by the UI and default seed mappings. */
export const CANONICAL_TASK_TYPES = [
  'Call to Schedule',
  'Book Site Attendance',
  'Follow-up with Customer',
  'Submit Report',
  'Customer Complaint',
  'Quote Review Required',
  'Submission Required',
  'Repair Update',
  'Commence Repairs',
  'Send Scope/Contract',
  'Upload Completion Certificate',
  'Schedule Repairs',
  'Send Excess',
  'Make Safe Required',
  'Signed Scope/Contract',
  'Collect Excess',
  'Review Claim',
  'Review Specialist Report',
  'Update Required',
  'Tender Update',
  'Specialist Required',
  'Check out Date Changes',
  'Book Accommodation',
  'Follow-up with Supplier',
  'Other',
] as const;

/**
 * Normalize a task title for matching:
 * - trim + lowercase
 * - strip trailing "#N" retry suffixes
 * - treat "/" as whitespace
 * - collapse whitespace
 */
export function normalizeTaskTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/#\d+\s*$/u, '')
    .replace(/\//gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
}

function ruleMatches(title: string, normalizedTitle: string, rule: TaskTypeMappingRule): boolean {
  const pattern = rule.titlePattern ?? '';
  if (!pattern.trim()) return false;

  const mode = (rule.matchMode || 'normalized').toLowerCase();
  switch (mode) {
    case 'exact':
      return title.trim() === pattern.trim();
    case 'prefix':
      return normalizedTitle.startsWith(normalizeTaskTitle(pattern));
    case 'contains':
      return normalizedTitle.includes(normalizeTaskTitle(pattern));
    case 'normalized':
    default:
      return normalizedTitle === normalizeTaskTitle(pattern);
  }
}

/**
 * Resolve a task type from a title using ordered mapping rules.
 * First active match by ascending priority wins; ties keep array order.
 */
export function resolveTaskTypeFromTitle(params: {
  title: string | null | undefined;
  rules: TaskTypeMappingRule[];
}): string | null {
  const title = (params.title ?? '').trim();
  if (!title) return null;

  const active = params.rules
    .filter((r) => r.isActive !== false && r.taskType?.trim())
    .slice()
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100));

  const normalizedTitle = normalizeTaskTitle(title);
  for (const rule of active) {
    if (ruleMatches(title, normalizedTitle, rule)) {
      return rule.taskType.trim();
    }
  }
  return null;
}

/** Default seed rows: identity mappings for each canonical type (normalized). */
export function defaultTaskTypeMappingSpecs(): Array<{
  titlePattern: string;
  matchMode: TaskTypeMatchMode;
  taskType: string;
  priority: number;
}> {
  return CANONICAL_TASK_TYPES.filter((t) => t !== 'Other').map((taskType) => ({
    titlePattern: taskType,
    matchMode: 'normalized' as const,
    taskType,
    priority: 100,
  }));
}
