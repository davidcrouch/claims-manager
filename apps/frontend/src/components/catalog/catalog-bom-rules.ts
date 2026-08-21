'use client';

/**
 * Shared BOM nesting helpers for catalogue UI (mirrors API catalog.utils).
 * assembly → primitive only; scope → assembly | primitive; scopes never nest.
 */

export type CatalogItemKind = 'primitive' | 'assembly' | 'scope';

export function isAllowedBomComponent(
  parentKind: string,
  componentKind: string,
): boolean {
  if (componentKind === 'scope') return false;
  if (parentKind === 'assembly') return componentKind === 'primitive';
  if (parentKind === 'scope') {
    return componentKind === 'primitive' || componentKind === 'assembly';
  }
  return false;
}

export function filterBomCandidates<T extends { kind: string }>(
  parentKind: string,
  items: T[],
): T[] {
  return items.filter((item) => isAllowedBomComponent(parentKind, item.kind));
}

export function bomParentHint(parentKind: string): string {
  if (parentKind === 'assembly') {
    return 'Assemblies can only include primitive items.';
  }
  if (parentKind === 'scope') {
    return 'Scopes can include assemblies and primitive items.';
  }
  return 'Only assemblies and scopes have a bill of materials.';
}
