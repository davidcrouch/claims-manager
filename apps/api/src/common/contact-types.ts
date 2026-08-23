export function readContactTypeLookupIds(contact: {
  typeLookupId?: string | null;
  contactPayload?: unknown;
}): string[] {
  const payload = contact.contactPayload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const raw = (payload as Record<string, unknown>).typeLookupIds;
    if (Array.isArray(raw)) {
      const ids = raw.filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      );
      if (ids.length > 0) {
        return [...new Set(ids.map((id) => id.trim()))];
      }
    }
  }

  const primary = contact.typeLookupId?.trim();
  return primary ? [primary] : [];
}

export function resolveContactTypeLookupIds(params: {
  typeLookupIds?: string[];
  typeLookupId?: string;
}): string[] {
  if (params.typeLookupIds?.length) {
    return [
      ...new Set(
        params.typeLookupIds.map((id) => id.trim()).filter((id) => id.length > 0),
      ),
    ];
  }
  const single = params.typeLookupId?.trim();
  return single ? [single] : [];
}

export function buildContactTypeFields(params: {
  existingPayload?: unknown;
  typeLookupIds: string[];
}): {
  typeLookupId: string | null;
  contactPayload: Record<string, unknown>;
} {
  const unique = resolveContactTypeLookupIds({ typeLookupIds: params.typeLookupIds });
  const existing =
    params.existingPayload &&
    typeof params.existingPayload === 'object' &&
    !Array.isArray(params.existingPayload)
      ? (params.existingPayload as Record<string, unknown>)
      : {};

  return {
    typeLookupId: unique[0] ?? null,
    contactPayload: {
      ...existing,
      typeLookupIds: unique,
    },
  };
}
