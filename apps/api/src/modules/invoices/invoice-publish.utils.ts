/**
 * CW create-invoice often echoes totals as 0. Keep a non-zero local amount
 * instead of overwriting it with a stub provider value.
 */
export function preferExistingAmount(
  providerValue: unknown,
  existing: string | number | null | undefined,
): string | undefined {
  const existingRaw =
    existing == null || existing === '' ? undefined : String(existing);
  const existingN = existingRaw != null ? Number(existingRaw) : NaN;
  const hasExisting = Number.isFinite(existingN) && existingN !== 0;

  if (providerValue == null || providerValue === '') {
    return existingRaw;
  }
  const providerRaw = String(providerValue);
  const providerN = Number(providerRaw);
  if ((!Number.isFinite(providerN) || providerN === 0) && hasExisting) {
    return existingRaw;
  }
  return providerRaw;
}
