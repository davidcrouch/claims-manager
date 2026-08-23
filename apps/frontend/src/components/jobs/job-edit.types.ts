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
  bookedDate: string;
  attendanceDate: string;
  statusLookupId: string;
  statusExternalReference: string;
  jobInstructions: string;
  vendorExtRef: string;
};

/** Draft fields collected from Overview + Type Details before save. */
export type JobEditPending = {
  bookedDate?: string | null;
  attendanceDate?: string | null;
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
