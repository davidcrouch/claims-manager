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
 * Build the CW POST /jobs body from local create fields + claim context.
 */
export function buildCrunchworkJobCreateBody(params: {
  cwClaimId: string;
  jobType: { externalReference: string; name?: string };
  status?: { externalReference: string; name?: string } | null;
  contacts: CwContactOutbound[];
  address?: Record<string, unknown> | null;
  makeSafeRequired?: boolean;
  excess?: number | string | null;
  jobInstructions?: string | null;
  requestDate?: string | null;
  collectExcess?: boolean | null;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    claimId: params.cwClaimId,
    jobType: params.jobType,
    contacts: params.contacts,
  };

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

  return body;
}
