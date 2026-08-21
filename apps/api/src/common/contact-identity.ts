/**
 * Shared contact identity helpers used by ContactsRepository and ContactSyncService.
 */

export function normalizePhoneDigits(phone: string | null | undefined): string | null {
  if (phone == null) return null;
  const digits = String(phone).replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export function isBlankContactValue(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim() === '';
  return false;
}

/** Scalar fields that are filled only when the existing value is blank. */
export const CONTACT_FILL_BLANK_FIELDS = [
  'firstName',
  'lastName',
  'email',
  'mobilePhone',
  'homePhone',
  'workPhone',
  'notes',
  'typeLookupId',
  'preferredContactMethodLookupId',
] as const;

export type ContactFillBlankField = (typeof CONTACT_FILL_BLANK_FIELDS)[number];

/**
 * Build a partial update: fill empty scalars from inbound; always apply
 * externalReference and contactPayload when inbound provides them.
 */
export function buildContactFillBlanksUpdate(params: {
  existing: Record<string, unknown>;
  inbound: Record<string, unknown>;
}): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  for (const key of CONTACT_FILL_BLANK_FIELDS) {
    const inboundVal = params.inbound[key];
    if (isBlankContactValue(params.existing[key]) && !isBlankContactValue(inboundVal)) {
      update[key] = inboundVal;
    }
  }

  if (!isBlankContactValue(params.inbound.externalReference)) {
    update.externalReference = params.inbound.externalReference;
  }

  if (params.inbound.contactPayload !== undefined) {
    update.contactPayload = params.inbound.contactPayload;
  }

  return update;
}

/** True when the contact has at least one identity signal for match/create. */
export function hasContactIdentity(params: {
  externalReference?: string | null;
  email?: string | null;
  mobilePhone?: string | null;
  homePhone?: string | null;
  workPhone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): boolean {
  if (!isBlankContactValue(params.externalReference)) return true;
  if (!isBlankContactValue(params.email)) return true;
  if (normalizePhoneDigits(params.mobilePhone)) return true;
  if (normalizePhoneDigits(params.homePhone)) return true;
  if (normalizePhoneDigits(params.workPhone)) return true;
  if (!isBlankContactValue(params.firstName) && !isBlankContactValue(params.lastName)) {
    return true;
  }
  return false;
}
