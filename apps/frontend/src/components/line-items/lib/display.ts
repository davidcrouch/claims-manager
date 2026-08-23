/** Matches standard UUID strings (case-insensitive). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Returns the value for UI display, or undefined when empty or an opaque id (e.g. catalog UUID in component).
 */
export function displayLabelText(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || UUID_RE.test(trimmed)) return undefined;
  return trimmed;
}
