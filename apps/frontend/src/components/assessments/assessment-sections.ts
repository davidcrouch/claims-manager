import type { Assessment, AssessmentSectionKey } from '@/types/api';

export const ASSESSMENT_SECTIONS: AssessmentSectionKey[] = [
  'attendance',
  'building',
  'habitability',
  'hazards',
  'damage',
  'makeSafe',
  'temporaryAccommodation',
  'specialists',
  'recommendation',
  'extras',
];

export type AssessmentSections = Record<AssessmentSectionKey, Record<string, unknown>>;

export function emptySections(): AssessmentSections {
  return {
    attendance: {},
    building: {},
    habitability: {},
    hazards: {},
    damage: {},
    makeSafe: {},
    temporaryAccommodation: {},
    specialists: {},
    recommendation: {},
    extras: {},
  };
}

export function sectionsFromAssessment(a: Partial<Assessment> | undefined): AssessmentSections {
  const empty = emptySections();
  if (!a) return empty;
  for (const key of ASSESSMENT_SECTIONS) {
    const value = a[key];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      empty[key] = { ...(value as Record<string, unknown>) };
    }
  }
  return empty;
}

export function sectionDict(
  a: Partial<Assessment> | undefined,
  key: AssessmentSectionKey,
): Record<string, unknown> {
  const value = a?.[key];
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asStr(value: unknown): string {
  return value == null ? '' : String(value);
}

export function asBool(value: unknown): boolean {
  return value === true;
}

export function isAssessmentLocked(status?: string | null): boolean {
  const value = (status ?? '').toLowerCase();
  return value === 'published' || value === 'archived';
}

export function additionalStructuresFromFlags(flags: {
  detachedGarage?: boolean;
  sheds?: boolean;
  swimmingPool?: boolean;
  detachedGrannyFlat?: boolean;
}): string {
  return [
    flags.detachedGarage ? 'Detached Garage' : null,
    flags.sheds ? 'Sheds' : null,
    flags.swimmingPool ? 'Swimming Pool' : null,
    flags.detachedGrannyFlat ? 'Granny Flat' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

export function flagsFromAdditionalStructures(value: unknown): {
  detachedGarage: boolean;
  sheds: boolean;
  swimmingPool: boolean;
  detachedGrannyFlat: boolean;
} {
  const text = asStr(value);
  return {
    detachedGarage: text.includes('Garage'),
    sheds: text.includes('Shed'),
    swimmingPool: text.includes('Pool'),
    detachedGrannyFlat: text.includes('Granny'),
  };
}

export function hazardDetailEntry(
  details: Record<string, unknown>,
  key: string,
): { flagged: boolean; comment: string } {
  const entry = details[key];
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    const rec = entry as Record<string, unknown>;
    return { flagged: rec.flagged === true, comment: asStr(rec.comment) };
  }
  return { flagged: false, comment: '' };
}

export const OCCUPANCY_TYPES = ['Vacant', 'Occupied', 'Partially Occupied'];
export const CLAIM_RECOMMENDATIONS = ['Approve', 'Decline', 'Refer', 'Pending'];
export const MAKE_SAFE_TYPES = ['Tarp', 'Board Up', 'Temporary Fence', 'Other'];
export const DESIGN_TYPES = ['Standard', 'Custom', 'Heritage', 'Multi-storey'];
export const CONSTRUCTION_TYPES = [
  'Brick Veneer',
  'Double Brick',
  'Weatherboard',
  'Fibro',
  'Concrete',
  'Steel Frame',
  'Other',
];
export const ROOF_TYPES = ['Tile', 'Metal', 'Slate', 'Flat', 'Colorbond', 'Other'];
export const BUILDING_TYPES = ['House', 'Unit', 'Townhouse', 'Duplex', 'Commercial', 'Other'];
export const DAMAGE_COVERED_OPTIONS = ['Yes', 'No', 'Partial'];
export const TA_REQUIRED_OPTIONS = ['No', 'Yes, Temporary Accommodation', 'Yes, Loss of Rent'];
export const REPAIR_DURATION_UNITS = ['Days', 'Weeks', 'Months'];
