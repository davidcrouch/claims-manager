/**
 * Pure helpers for building Crunchwork outbound job create payloads.
 */

export function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

export type CwContactOutbound = {
  externalReference: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobilePhone?: string;
  homePhone?: string;
  workPhone?: string;
  notes?: string;
  type: { externalReference: string; name?: string };
};

/**
 * Map claim.api_payload.contacts into CW write shape.
 * When CW omits contacts[].externalReference, fall back to contacts[].id
 * (same pattern used for claim assignees inbound).
 */
export function claimApiContactsToOutbound(
  claimApiPayload: Record<string, unknown> | null | undefined,
): CwContactOutbound[] {
  const raw = Array.isArray(claimApiPayload?.contacts)
    ? claimApiPayload.contacts
    : [];
  const out: CwContactOutbound[] = [];

  for (const entry of raw) {
    if (!isPlainObject(entry)) continue;
    const externalReference =
      asNonEmptyString(entry.externalReference) ?? asNonEmptyString(entry.id);
    if (!externalReference) continue;

    const typeField = entry.type;
    let typeExt: string | undefined;
    let typeName: string | undefined;
    if (isPlainObject(typeField)) {
      typeExt = asNonEmptyString(typeField.externalReference);
      typeName = asNonEmptyString(typeField.name);
    } else if (typeof typeField === 'string') {
      typeExt = asNonEmptyString(typeField);
      typeName = typeExt;
    }
    if (!typeExt) continue;

    out.push({
      externalReference,
      firstName: asNonEmptyString(entry.firstName),
      lastName: asNonEmptyString(entry.lastName),
      email: asNonEmptyString(entry.email),
      mobilePhone: asNonEmptyString(entry.mobilePhone),
      homePhone: asNonEmptyString(entry.homePhone),
      workPhone: asNonEmptyString(entry.workPhone),
      notes: asNonEmptyString(entry.notes),
      type: {
        externalReference: typeExt,
        ...(typeName ? { name: typeName } : {}),
      },
    });
  }

  return out;
}

/** Strip seed-/internal-only lookup refs that CW will reject. */
export function isCwUsableLookupRef(externalReference: string | null | undefined): boolean {
  const ref = asNonEmptyString(externalReference);
  if (!ref) return false;
  const lower = ref.toLowerCase();
  return !(
    lower.startsWith('seed-') ||
    lower.startsWith('direct-') ||
    lower.startsWith('internal-')
  );
}

export function lookupToCwObject(lookup: {
  name?: string | null;
  externalReference?: string | null;
} | null | undefined): { externalReference: string; name?: string } | null {
  const externalReference = asNonEmptyString(lookup?.externalReference);
  if (!externalReference || !isCwUsableLookupRef(externalReference)) return null;
  const name = asNonEmptyString(lookup?.name);
  return {
    externalReference,
    ...(name ? { name } : {}),
  };
}

/**
 * Human job number for CW API body `vendorJobNumber` (not a local DB column).
 * Prefer insurer/CW job number (`externalJobId`), else local `internalNumber`.
 * Never use local `jobs.externalReference` (that stores the CW UUID).
 */
export function resolveCwVendorJobNumber(job: {
  externalJobId?: string | null;
  internalNumber?: string | null;
}): string | undefined {
  return (
    asNonEmptyString(job.externalJobId) ?? asNonEmptyString(job.internalNumber)
  );
}

/**
 * Build the CW POST /jobs body from local create fields + claim context.
 */
export function buildCrunchworkJobCreateBody(params: {
  cwClaimId: string;
  jobType: { externalReference: string; name?: string };
  status?: { externalReference: string; name?: string } | null;
  /** Omit on create — CW copies claim contacts; re-sending them returns 400/500. */
  contacts?: CwContactOutbound[];
  address?: Record<string, unknown> | null;
  makeSafeRequired?: boolean;
  excess?: number | string | null;
  jobInstructions?: string | null;
  requestDate?: string | null;
  collectExcess?: boolean | null;
  /** CW body field only — our local job number for the vendor tenancy. */
  vendorJobNumber?: string | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    claimId: params.cwClaimId,
    jobType: params.jobType,
  };

  if (params.contacts && params.contacts.length > 0) {
    body.contacts = params.contacts;
  }
  if (params.status) body.status = params.status;
  if (params.address && Object.keys(params.address).length > 0) {
    body.address = params.address;
  }
  if (params.makeSafeRequired != null) body.makeSafeRequired = params.makeSafeRequired;
  if (params.collectExcess != null) body.collectExcess = params.collectExcess;
  if (params.excess != null && params.excess !== '') body.excess = params.excess;
  const instructions = asNonEmptyString(params.jobInstructions);
  if (instructions) body.jobInstructions = instructions;
  const requestDate = asNonEmptyString(params.requestDate);
  if (requestDate) body.requestDate = requestDate;
  const vendorJobNumber = asNonEmptyString(params.vendorJobNumber);
  if (vendorJobNumber) body.vendorJobNumber = vendorJobNumber;

  return body;
}

export const CRUNCHWORK_JOB_DATE_FIELDS = [
  'bookedDate',
  'attendanceDate',
  'estimatedStartDate',
  'estimatedCompletionDate',
] as const;

export type CrunchworkJobDateField = (typeof CRUNCHWORK_JOB_DATE_FIELDS)[number];

/** Convert a date-only or ISO string to the ISO-8601 datetime CW expects. */
export function toCrunchworkDate(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return trimmed;
  return parsed.toISOString();
}

/**
 * Read booked/attendance/estimated schedule dates from an outbound job payload.
 * Local edits live on customData; some inbound CW payloads also set them top-level.
 */
export function pickCrunchworkJobDates(
  payload: Record<string, unknown>,
): Partial<Record<CrunchworkJobDateField, string>> {
  const custom = isPlainObject(payload.customData) ? payload.customData : {};
  const out: Partial<Record<CrunchworkJobDateField, string>> = {};
  for (const key of CRUNCHWORK_JOB_DATE_FIELDS) {
    const iso = toCrunchworkDate(payload[key] ?? custom[key]);
    if (iso) out[key] = iso;
  }
  return out;
}

/**
 * CW job status for POST /jobs/{id}/status (and create body).
 * Accepts a resolved `{ externalReference }` object, or a string ref / workflow step.
 */
export function pickCrunchworkJobStatus(
  payload: Record<string, unknown>,
): { externalReference: string; name?: string } | undefined {
  const raw = payload.status !== undefined ? payload.status : payload.step;
  if (raw == null) return undefined;

  if (typeof raw === 'string') {
    const externalReference = asNonEmptyString(raw);
    if (!externalReference || !isCwUsableLookupRef(externalReference)) {
      return undefined;
    }
    return { externalReference };
  }

  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return lookupToCwObject(
      raw as { name?: string | null; externalReference?: string | null },
    ) ?? undefined;
  }

  return undefined;
}

/**
 * Read claimRecommendation from an outbound job payload.
 * Local edits live on customData; legacy callers may still set it top-level.
 */
export function pickCrunchworkClaimRecommendation(
  payload: Record<string, unknown>,
): string | null | undefined {
  const custom = isPlainObject(payload.customData) ? payload.customData : {};
  const raw =
    payload.claimRecommendation !== undefined
      ? payload.claimRecommendation
      : custom.claimRecommendation !== undefined
        ? custom.claimRecommendation
        : undefined;
  if (raw === undefined) return undefined;
  if (raw == null) return null;
  if (typeof raw !== 'string') return null;
  return raw;
}

/**
 * Overlay CW-bound customData fields (schedule dates + claimRecommendation)
 * onto the outbound body, preserving existing CW keys.
 * Local-only customData keys are not forwarded.
 */
export function applyCrunchworkJobDates(
  body: Record<string, unknown>,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const dates = pickCrunchworkJobDates(payload);
  const claimRecommendation = pickCrunchworkClaimRecommendation(payload);
  if (Object.keys(dates).length === 0 && claimRecommendation === undefined) {
    return body;
  }

  const existingCwCustom = isPlainObject(payload.cwCustomData)
    ? payload.cwCustomData
    : {};
  // Never forward claimRecommendation as a CW top-level field.
  const { claimRecommendation: _omitTopLevel, ...rest } = body;
  return {
    ...rest,
    customData: {
      ...existingCwCustom,
      ...dates,
      ...(claimRecommendation !== undefined
        ? { claimRecommendation }
        : {}),
    },
  };
}
