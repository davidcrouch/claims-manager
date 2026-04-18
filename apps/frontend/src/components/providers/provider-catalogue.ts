/**
 * UI-side catalogue mirroring the backend provider registry. Used to drive
 * the provider picker in the create drawer and to dispatch to the correct
 * provider-specific form component. Not a source of truth — when a new
 * provider is added to `apps/api/src/modules/providers/provider-registry.ts`
 * append the matching entry here.
 */

export type ProviderCode = 'crunchwork';

export interface ProviderCatalogueEntry {
  code: ProviderCode;
  name: string;
  description: string;
}

export const PROVIDER_CATALOGUE: ProviderCatalogueEntry[] = [
  {
    code: 'crunchwork',
    name: 'Crunchwork',
    description: 'Crunchwork Insurance claims management platform',
  },
];

export function findProviderCatalogueEntry(
  code: string,
): ProviderCatalogueEntry | undefined {
  return PROVIDER_CATALOGUE.find((entry) => entry.code === code);
}
