/**
 * Hardcoded registry of integration providers supported by the app.
 *
 * Providers are NOT user-generated data — each requires bespoke auth, webhook,
 * and field handling in code. The registry replaces the former
 * `integration_providers` DB table. `code` is the primary key used everywhere
 * (DB columns, API paths, frontend dispatch).
 *
 * Consumers must NOT assume a UUID; use `code` (e.g. 'crunchwork').
 */

export interface ProviderRegistryEntry {
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
}

export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    description: 'Crunchwork Insurance claims management platform',
    isActive: true,
    metadata: {},
  },
];

export function findProviderByCode(
  code: string,
): ProviderRegistryEntry | undefined {
  return PROVIDER_REGISTRY.find((p) => p.code === code);
}

export function listActiveProviderCodes(): string[] {
  return PROVIDER_REGISTRY.filter((p) => p.isActive).map((p) => p.code);
}
