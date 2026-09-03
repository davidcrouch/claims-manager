/**
 * Backend-side job-kind capability map.
 *
 * Mirrors the frontend registry in apps/frontend/src/lib/job-kind-registry.ts.
 * Resolves workflow capabilities from job-type names.
 */

const WORKFLOW_CAP_ENTRIES: Array<{ pattern: RegExp; capability: string }> = [
  { pattern: /\bmake\s*safe\b/i, capability: 'workflow.job.make-safe' },
  { pattern: /\bassessment\b/i, capability: 'workflow.job.assessment' },
  { pattern: /\bworks\b/i, capability: 'workflow.job.works' },
  { pattern: /\bscope\s+of\s+works\b/i, capability: 'workflow.job.works' },
];

export function resolveWorkflowCapability(
  jobTypeName?: string | null,
): string | null {
  if (!jobTypeName) return null;
  for (const { pattern, capability } of WORKFLOW_CAP_ENTRIES) {
    if (pattern.test(jobTypeName)) return capability;
  }
  return null;
}
