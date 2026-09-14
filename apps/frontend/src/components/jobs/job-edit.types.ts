export type LookupOption = {
  id: string;
  name?: string;
  externalReference?: string;
};

export type MobilityOption = {
  name: string;
  externalReference: string;
};

export type JobOverviewDraft = {
  customerContactDate: string;
  bookedDate: string;
  attendanceDate: string;
  estimatedStartDate: string;
  estimatedCompletionDate: string;
  claimRecommendation: string;
  statusLookupId: string;
  statusExternalReference: string;
  jobInstructions: string;
  vendorExtRef: string;
};

/** Draft fields collected from Overview + Type Details before save. */
export type JobEditPending = {
  customerContactDate?: string | null;
  bookedDate?: string | null;
  attendanceDate?: string | null;
  estimatedStartDate?: string | null;
  estimatedCompletionDate?: string | null;
  claimRecommendation?: string | null;
  assignedToUserId?: string | null;
  /** Crunchwork-updatable overview fields */
  statusLookupId?: string | null;
  statusExternalReference?: string | null;
  externalReference?: string | null;
  collectExcess?: boolean | null;
  excess?: string | null;
  makeSafeRequired?: boolean | null;
  jobInstructions?: string | null;
  vendorExternalReference?: string | null;
  /** Type-specific CW fields (top-level API shape) */
  typeDetails?: Record<string, unknown> | null;
  temporaryAccommodationDetails?: Record<string, unknown> | null;
  specialistDetails?: Record<string, unknown> | null;
  rectificationDetails?: Record<string, unknown> | null;
  auditDetails?: Record<string, unknown> | null;
  mobilityConsiderations?: MobilityOption[] | null;
};

export const MOBILITY_OPTIONS: MobilityOption[] = [
  { name: 'Disabled (Accessible)', externalReference: 'Disabled (Accessible)' },
  { name: 'No-Stair', externalReference: 'No-Stair' },
];

export const SPECIALIST_CATEGORY_OPTIONS = [
  { name: 'Plumbing', externalReference: 'Plumbing' },
  { name: 'Roofing', externalReference: 'Roofing' },
  { name: 'Surveyors', externalReference: 'Surveyors' },
];

export const SPECIALIST_REPORT_OPTIONS = [
  { name: 'Causation Report', externalReference: 'Causation Report' },
  { name: 'Specialist Advice', externalReference: 'Specialist Advice' },
];

export const AUDIT_TYPE_OPTIONS = [
  { name: 'Desktop', externalReference: 'Desktop' },
];

export const PREFERRED_CONTACT_OPTIONS = [
  { name: 'Email', externalReference: 'Email' },
  { name: 'Home Phone', externalReference: 'Home Phone' },
  { name: 'Mobile Phone', externalReference: 'Mobile Phone' },
  { name: 'Work Phone', externalReference: 'Work Phone' },
];

/** Builder Assessment Claim Recommendation (CW enum). Stored value = display label (matches workflows). */
export const CLAIM_RECOMMENDATION_OPTIONS: Array<{
  id: string;
  name: string;
  externalReference: string;
}> = [
  {
    id: 'acceptReviewComponentOfClaimRequiresCashSettlement',
    name: 'Accept - Review: Component of claim requires cash settlement',
    externalReference: 'Accept - Review: Component of claim requires cash settlement',
  },
  {
    id: 'acceptReviewCannotWarrantTheWork',
    name: 'Accept - Review: Cannot warrant the work',
    externalReference: 'Accept - Review: Cannot warrant the work',
  },
  {
    id: 'acceptReviewReplacementRequired',
    name: 'Accept - Review: Replacement Required',
    externalReference: 'Accept - Review: Replacement Required',
  },
  {
    id: 'acceptReviewClientSeeksAlternateSettlementMethod',
    name: 'Accept - Review: Client seeks alternate settlement method',
    externalReference: 'Accept - Review: Client seeks alternate settlement method',
  },
  { id: 'accept', name: 'Accept', externalReference: 'Accept' },
  {
    id: 'acceptCashSettlementRequired',
    name: 'Accept - Cash Settlement Required',
    externalReference: 'Accept - Cash Settlement Required',
  },
  {
    id: 'cancelNoResultantDamage',
    name: 'Cancel - No Resultant Damage',
    externalReference: 'Cancel - No Resultant Damage',
  },
  {
    id: 'doNotAcceptNotCovered',
    name: 'Do Not Accept - Not Covered',
    externalReference: 'Do Not Accept - Not Covered',
  },
  {
    id: 'cancelClientWishesToWithdrawClaim',
    name: 'Cancel - Client Wishes to Withdraw Claim',
    externalReference: 'Cancel - Client Wishes to Withdraw Claim',
  },
  {
    id: 'cancelUnderExcess',
    name: 'Cancel - Under Excess',
    externalReference: 'Cancel - Under Excess',
  },
  {
    id: 'acceptReviewMaintenanceRequiredByCustomer',
    name: 'Accept - Review: Maintenance required by customer',
    externalReference: 'Accept - Review: Maintenance required by customer',
  },
  {
    id: 'unsurePolicyCoverage',
    name: 'Unsure - Policy Coverage',
    externalReference: 'Unsure - Policy Coverage',
  },
];

/** Normalize CW technical key or display label to the stored display label. */
export function normalizeClaimRecommendation(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const byId = CLAIM_RECOMMENDATION_OPTIONS.find((o) => o.id === trimmed);
  if (byId) return byId.externalReference;
  const byLabel = CLAIM_RECOMMENDATION_OPTIONS.find(
    (o) => o.externalReference === trimmed || o.name === trimmed,
  );
  if (byLabel) return byLabel.externalReference;
  return trimmed;
}
