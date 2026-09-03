import type { Job } from '@/types/api';

// ---------------------------------------------------------------------------
// Field rule — controls visibility & editability per entity field per job kind
// ---------------------------------------------------------------------------

export interface FieldRule {
  visible: boolean;
  editable: boolean;
  required?: boolean;
  label?: string;
}

const SHOW: FieldRule = { visible: true, editable: false };
const HIDE: FieldRule = { visible: false, editable: false };
const EDIT: FieldRule = { visible: true, editable: true };

// ---------------------------------------------------------------------------
// Per-entity field unions
// ---------------------------------------------------------------------------

export type JobField =
  | 'statusEditable'
  | 'vendorSection'
  | 'vendorExtRefEditable'
  | 'instructionsEditable'
  | 'excess'
  | 'collectExcess'
  | 'makeSafeRequired'
  | 'parentClaim'
  | 'providerBadge'
  | 'typeDetailsTab'
  | 'typeDetailsEditable'
  | 'cwUpdatedAt'
  | 'createMakeSafe';

export type EstimateField =
  | 'publishButton'
  | 'approveButton'
  | 'catalogPicker'
  | 'reference'
  | 'insurerRef';

export type InvoiceField =
  | 'publishButton';

export type WorkOrderField =
  | 'providerBadge'
  | 'createButton';

export type AssessmentField =
  | 'providerBadge';

// ---------------------------------------------------------------------------
// Defaults — every field starts with a sensible baseline
// ---------------------------------------------------------------------------

/** Baseline = Internal. Provider/kind entries override only what differs. */
const DEFAULT_JOB: Record<JobField, FieldRule> = {
  statusEditable:        HIDE,
  vendorSection:         SHOW,
  vendorExtRefEditable:  HIDE,
  instructionsEditable:  HIDE,
  // CW-specific financial / make-safe flags — hidden for Internal
  excess:                HIDE,
  collectExcess:         HIDE,
  makeSafeRequired:      HIDE,
  parentClaim:           HIDE,
  providerBadge:         HIDE,
  typeDetailsTab:        HIDE,
  typeDetailsEditable:   HIDE,
  cwUpdatedAt:           HIDE,
  createMakeSafe:        HIDE,
};

const DEFAULT_ESTIMATE: Record<EstimateField, FieldRule> = {
  publishButton:  SHOW,
  approveButton:  SHOW,
  catalogPicker:  SHOW,
  // CW-only — hidden for Internal
  reference:      HIDE,
  insurerRef:     HIDE,
};

const DEFAULT_INVOICE: Record<InvoiceField, FieldRule> = {
  publishButton: SHOW,
};

const DEFAULT_WORK_ORDER: Record<WorkOrderField, FieldRule> = {
  providerBadge: HIDE,
  // Internal only — hide Create Work Order for provider job kinds
  createButton:  SHOW,
};

const DEFAULT_ASSESSMENT: Record<AssessmentField, FieldRule> = {
  providerBadge: HIDE,
};

// ---------------------------------------------------------------------------
// withOverrides — merge only the fields that differ from the default
// ---------------------------------------------------------------------------

function withOverrides<K extends string>(
  defaults: Record<K, FieldRule>,
  overrides: Partial<Record<K, Partial<FieldRule>>>,
): Record<K, FieldRule> {
  const result = { ...defaults };
  for (const [key, rule] of Object.entries(overrides) as [K, Partial<FieldRule>][]) {
    result[key] = { ...defaults[key], ...rule };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Capabilities shape
// ---------------------------------------------------------------------------

export interface JobKindCapabilities {
  providerCode: string;
  providerLabel: string;
  jobTypeKind: string;

  publishTarget: 'none' | 'crunchwork' | (string & {});
  catalogScope: 'internal' | 'crunchwork' | (string & {});
  publishMode: 'internal' | 'external';
  workflowCapability: string | null;

  job: Record<JobField, FieldRule>;
  estimate: Record<EstimateField, FieldRule>;
  invoice: Record<InvoiceField, FieldRule>;
  workOrder: Record<WorkOrderField, FieldRule>;
  assessment: Record<AssessmentField, FieldRule>;

  /** Quote type options for Create / edit estimate. */
  estimateQuoteTypes: readonly string[];

  create: {
    userCanCreate: boolean;
    requiresClaim: boolean;
    autoMakeSafe: boolean;
  };
}

// ---------------------------------------------------------------------------
// Estimate quote-type option lists (per provider)
// ---------------------------------------------------------------------------

/** Internal Create / edit estimate: Quote | Variation only. */
export const INTERNAL_ESTIMATE_QUOTE_TYPES = ['Quote', 'Variation'] as const;

/** Crunchwork estimate quote types (CW quoteType name / externalReference). */
export const CW_ESTIMATE_QUOTE_TYPES = [
  'Validation',
  'Variation',
  'Tender Quote',
  'Variation - PC/PS',
  'Liability Quote',
  'Scope Of Work',
  'Quote',
] as const;

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

const INTERNAL_BASE: JobKindCapabilities = {
  providerCode: 'direct',
  providerLabel: 'Internal',
  jobTypeKind: 'general',

  publishTarget: 'none',
  catalogScope: 'internal',
  publishMode: 'internal',
  workflowCapability: null,

  job: { ...DEFAULT_JOB },
  estimate: { ...DEFAULT_ESTIMATE },
  invoice: { ...DEFAULT_INVOICE },
  workOrder: { ...DEFAULT_WORK_ORDER },
  assessment: { ...DEFAULT_ASSESSMENT },

  estimateQuoteTypes: INTERNAL_ESTIMATE_QUOTE_TYPES,

  create: { userCanCreate: true, requiresClaim: false, autoMakeSafe: false },
};

const CW_BASE_JOB = withOverrides(DEFAULT_JOB, {
  statusEditable:       EDIT,
  vendorSection:        SHOW,
  vendorExtRefEditable: EDIT,
  instructionsEditable: EDIT,
  excess:               SHOW,
  collectExcess:        SHOW,
  makeSafeRequired:     SHOW,
  parentClaim:          SHOW,
  providerBadge:        SHOW,
  cwUpdatedAt:          SHOW,
  createMakeSafe:       SHOW,
});

const CW_BASE_ESTIMATE = withOverrides(DEFAULT_ESTIMATE, {
  approveButton: HIDE,
  reference:     EDIT,
  insurerRef:    SHOW,
});

const CW_BASE_WORK_ORDER = withOverrides(DEFAULT_WORK_ORDER, {
  providerBadge: SHOW,
  createButton:  HIDE,
});

const CW_BASE_ASSESSMENT = withOverrides(DEFAULT_ASSESSMENT, {
  providerBadge: SHOW,
});

const REGISTRY: JobKindCapabilities[] = [
  // ── Internal ──────────────────────────────────────────────────────
  INTERNAL_BASE,

  // ── Crunchwork: Builder Make Safe ─────────────────────────────────
  {
    providerCode: 'crunchwork',
    providerLabel: 'Crunchwork',
    jobTypeKind: 'make-safe',

    publishTarget: 'crunchwork',
    catalogScope: 'crunchwork',
    publishMode: 'external',
    workflowCapability: 'workflow.job.make-safe',

    job: { ...CW_BASE_JOB },
    estimate: { ...CW_BASE_ESTIMATE },
    invoice: { ...DEFAULT_INVOICE },
    workOrder: { ...CW_BASE_WORK_ORDER },
    assessment: { ...CW_BASE_ASSESSMENT },

    estimateQuoteTypes: CW_ESTIMATE_QUOTE_TYPES,

    create: { userCanCreate: true, requiresClaim: true, autoMakeSafe: true },
  },

  // ── Crunchwork: Builder Assessment ────────────────────────────────
  {
    providerCode: 'crunchwork',
    providerLabel: 'Crunchwork',
    jobTypeKind: 'assessment',

    publishTarget: 'crunchwork',
    catalogScope: 'crunchwork',
    publishMode: 'external',
    workflowCapability: 'workflow.job.assessment',

    job: withOverrides(CW_BASE_JOB, {
      createMakeSafe: HIDE,
    }),
    estimate: { ...CW_BASE_ESTIMATE },
    invoice: { ...DEFAULT_INVOICE },
    workOrder: { ...CW_BASE_WORK_ORDER },
    assessment: { ...CW_BASE_ASSESSMENT },

    estimateQuoteTypes: CW_ESTIMATE_QUOTE_TYPES,

    create: { userCanCreate: false, requiresClaim: true, autoMakeSafe: false },
  },

  // ── Crunchwork: Builder Works ─────────────────────────────────────
  {
    providerCode: 'crunchwork',
    providerLabel: 'Crunchwork',
    jobTypeKind: 'works',

    publishTarget: 'crunchwork',
    catalogScope: 'crunchwork',
    publishMode: 'external',
    workflowCapability: 'workflow.job.works',

    job: withOverrides(CW_BASE_JOB, {
      createMakeSafe: HIDE,
    }),
    estimate: { ...CW_BASE_ESTIMATE },
    invoice: { ...DEFAULT_INVOICE },
    workOrder: { ...CW_BASE_WORK_ORDER },
    assessment: { ...CW_BASE_ASSESSMENT },

    estimateQuoteTypes: CW_ESTIMATE_QUOTE_TYPES,

    create: { userCanCreate: false, requiresClaim: true, autoMakeSafe: false },
  },
];

// ---------------------------------------------------------------------------
// Job-type-name → jobTypeKind mapping (replaces old getJobTypeKind heuristic)
// ---------------------------------------------------------------------------

const JOB_TYPE_KIND_MAP: Array<{ pattern: RegExp; kind: string }> = [
  { pattern: /\bmake\s*safe\b/i, kind: 'make-safe' },
  { pattern: /\bassessment\b/i, kind: 'assessment' },
  { pattern: /\bworks\b/i, kind: 'works' },
];

function resolveJobTypeKind(jobTypeName?: string | null, extRef?: string | null): string {
  const haystack = `${jobTypeName ?? ''} ${extRef ?? ''}`.toLowerCase();
  for (const { pattern, kind } of JOB_TYPE_KIND_MAP) {
    if (pattern.test(haystack)) return kind;
  }
  return 'general';
}

// ---------------------------------------------------------------------------
// Provider resolution — maps API `job.provider` to registry providerCode
// ---------------------------------------------------------------------------

function resolveProviderCode(provider?: string | null): string {
  if (!provider || provider === 'internal') return 'direct';
  return provider;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the full capabilities for a job based on its provider and type.
 *
 * Matching order:
 *  1. Exact match on providerCode + jobTypeKind
 *  2. First entry for providerCode (provider default)
 *  3. INTERNAL_BASE fallback
 */
export function resolveJobKindCaps(job: {
  provider?: string | null;
  jobType?: { name?: string | null; externalReference?: string | null } | null;
}): JobKindCapabilities {
  const providerCode = resolveProviderCode(job.provider);
  const jobTypeKind = resolveJobTypeKind(job.jobType?.name, job.jobType?.externalReference);

  const exactMatch = REGISTRY.find(
    (e) => e.providerCode === providerCode && e.jobTypeKind === jobTypeKind,
  );
  if (exactMatch) return exactMatch;

  const providerDefault = REGISTRY.find((e) => e.providerCode === providerCode);
  if (providerDefault) return providerDefault;

  return INTERNAL_BASE;
}

/**
 * Resolve caps from discrete provider + job-type-name strings (for create flows
 * where a full Job object isn't available yet).
 */
export function resolveJobKindCapsFromParts(params: {
  providerCode: string;
  jobTypeName?: string | null;
  jobTypeExtRef?: string | null;
}): JobKindCapabilities {
  return resolveJobKindCaps({
    provider: params.providerCode === 'direct' ? 'internal' : params.providerCode,
    jobType: { name: params.jobTypeName, externalReference: params.jobTypeExtRef },
  });
}

/**
 * All registry entries (read-only). Useful for create-flow iteration.
 */
export function listJobKindEntries(): readonly JobKindCapabilities[] {
  return REGISTRY;
}
