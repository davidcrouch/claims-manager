export const ASSESSMENT_SECTIONS = [
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
] as const;

export type AssessmentSectionKey = (typeof ASSESSMENT_SECTIONS)[number];

export type AssessmentSections = Record<AssessmentSectionKey, Record<string, unknown>>;

export function emptyAssessmentSections(): AssessmentSections {
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

export function asSectionDict(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mergeSection(
  existing: unknown,
  patch: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!patch) return asSectionDict(existing);
  return { ...asSectionDict(existing), ...patch };
}
