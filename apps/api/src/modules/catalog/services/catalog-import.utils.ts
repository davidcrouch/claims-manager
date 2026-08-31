import type { CatalogItemKind } from '../catalog.utils';
import {
  bomComponentRuleMessage,
  isAllowedBomComponent,
  isCatalogBomParentKind,
} from '../catalog.utils';
import type { CatalogType } from './catalogs.service';

/** Prefer CSV headers over catalogue type so CW exports import into any catalogue. */
export function detectImportFormat(
  header: string[],
  catalogType: CatalogType,
): 'internal' | 'crunchwork' {
  const cols = new Set(header.map((h) => h.trim().toLowerCase()));

  // CW Items exports use `id` + `type` (Material/Labour/…). `kind` and optional `code`
  // may also be present after hierarchy enrichment.
  const looksCrunchwork =
    cols.has('id') &&
    (cols.has('name') || cols.has('type')) &&
    !cols.has('type_code') &&
    !cols.has('display_name');
  if (looksCrunchwork) return 'crunchwork';

  const looksInternal =
    cols.has('code') || cols.has('type_code') || cols.has('display_name') || cols.has('kind');
  if (looksInternal) return 'internal';

  return catalogType === 'crunchwork' ? 'crunchwork' : 'internal';
}

export function parseCatalogItemKind(raw: string, importFormat: 'internal' | 'crunchwork'): CatalogItemKind | '' {
  const key = raw.trim().toLowerCase();
  if (key === 'primitive' || key === 'assembly' || key === 'scope') return key;
  if (!key && importFormat === 'crunchwork') return 'primitive';
  return '';
}

/**
 * Order data-row indexes so parents are upserted before children.
 * `getCode` / `getParentCode` receive the data row cells.
 */
export function sortImportRowIndexes(params: {
  dataRowIndexes: number[];
  getCode: (rowIndex: number) => string;
  getParentCode: (rowIndex: number) => string;
}): number[] {
  const { dataRowIndexes, getCode, getParentCode } = params;
  // Multi-parent exports repeat the same code on multiple rows — keep every index.
  const codeToIndexes = new Map<string, number[]>();
  for (const idx of dataRowIndexes) {
    const code = getCode(idx);
    if (!code) continue;
    const key = code.toLowerCase();
    const list = codeToIndexes.get(key);
    if (list) list.push(idx);
    else codeToIndexes.set(key, [idx]);
  }

  const pending = new Set(dataRowIndexes);
  const ordered: number[] = [];
  const visiting = new Set<number>();

  const visit = (idx: number) => {
    if (!pending.has(idx) || visiting.has(idx)) return;
    visiting.add(idx);
    const parent = getParentCode(idx);
    if (parent) {
      const parentIndexes = codeToIndexes.get(parent.toLowerCase()) ?? [];
      // Prefer parent rows with no parent of their own first (definition rows).
      const sortedParents = [...parentIndexes].sort((a, b) => {
        const aHas = getParentCode(a) ? 1 : 0;
        const bHas = getParentCode(b) ? 1 : 0;
        return aHas - bHas;
      });
      for (const parentIdx of sortedParents) {
        if (pending.has(parentIdx)) visit(parentIdx);
      }
    }
    visiting.delete(idx);
    pending.delete(idx);
    ordered.push(idx);
  };

  // Stable: walk in original order so siblings keep file order.
  for (const idx of dataRowIndexes) {
    visit(idx);
  }

  return ordered;
}

export function validateBomParentChildKinds(params: {
  parentKind: string;
  childKind: string;
}): string | null {
  if (!isCatalogBomParentKind(params.parentKind)) {
    return `Parent kind must be assembly or scope (got ${params.parentKind || '(missing)'})`;
  }
  if (!isAllowedBomComponent(params.parentKind, params.childKind)) {
    return bomComponentRuleMessage(params.parentKind, params.childKind);
  }
  return null;
}
