import {
  detectImportFormat,
  parseCatalogItemKind,
  sortImportRowIndexes,
  validateBomParentChildKinds,
} from './catalog-import.utils';

describe('catalog-import.utils', () => {
  describe('detectImportFormat', () => {
    it('detects crunchwork even when kind/parent columns are present', () => {
      const header = [
        'id',
        'name',
        'description',
        'kind',
        'parent',
        'type',
        'category',
        'unit',
      ];
      expect(detectImportFormat(header, 'internal')).toBe('crunchwork');
    });

    it('detects internal format from type_code / display_name', () => {
      expect(
        detectImportFormat(['code', 'display_name', 'kind', 'type_code'], 'crunchwork'),
      ).toBe('internal');
    });
  });

  describe('parseCatalogItemKind', () => {
    it('defaults missing kind to primitive for crunchwork', () => {
      expect(parseCatalogItemKind('', 'crunchwork')).toBe('primitive');
    });

    it('parses assembly and scope', () => {
      expect(parseCatalogItemKind('Assembly', 'internal')).toBe('assembly');
      expect(parseCatalogItemKind('scope', 'crunchwork')).toBe('scope');
    });
  });

  describe('sortImportRowIndexes', () => {
    it('orders parents before children', () => {
      const rows = [
        { code: 'child-a', parent: 'scope-1' },
        { code: 'scope-1', parent: '' },
        { code: 'child-b', parent: 'scope-1' },
        { code: 'orphan', parent: '' },
      ];
      const ordered = sortImportRowIndexes({
        dataRowIndexes: [0, 1, 2, 3],
        getCode: (i) => rows[i].code,
        getParentCode: (i) => rows[i].parent,
      });
      expect(ordered.indexOf(1)).toBeLessThan(ordered.indexOf(0));
      expect(ordered.indexOf(1)).toBeLessThan(ordered.indexOf(2));
      expect(ordered).toContain(3);
    });

    it('handles multi-level hierarchy', () => {
      const rows = [
        { code: 'prim', parent: 'asm' },
        { code: 'asm', parent: 'scope' },
        { code: 'scope', parent: '' },
      ];
      const ordered = sortImportRowIndexes({
        dataRowIndexes: [0, 1, 2],
        getCode: (i) => rows[i].code,
        getParentCode: (i) => rows[i].parent,
      });
      expect(ordered).toEqual([2, 1, 0]);
    });

    it('visits all rows for a multi-parent code before dependents', () => {
      const rows = [
        { code: 'prim', parent: 'asm' },
        { code: 'asm', parent: 'scope-b' },
        { code: 'asm', parent: 'scope-a' },
        { code: 'scope-a', parent: '' },
        { code: 'scope-b', parent: '' },
      ];
      const ordered = sortImportRowIndexes({
        dataRowIndexes: [0, 1, 2, 3, 4],
        getCode: (i) => rows[i].code,
        getParentCode: (i) => rows[i].parent,
      });
      expect(ordered.indexOf(3)).toBeLessThan(ordered.indexOf(0));
      expect(ordered.indexOf(4)).toBeLessThan(ordered.indexOf(0));
      expect(ordered.indexOf(1)).toBeLessThan(ordered.indexOf(0));
      expect(ordered.indexOf(2)).toBeLessThan(ordered.indexOf(0));
    });
  });

  describe('validateBomParentChildKinds', () => {
    it('allows scope → primitive and scope → assembly', () => {
      expect(validateBomParentChildKinds({ parentKind: 'scope', childKind: 'primitive' })).toBeNull();
      expect(validateBomParentChildKinds({ parentKind: 'scope', childKind: 'assembly' })).toBeNull();
    });

    it('rejects assembly → assembly and nested scopes', () => {
      expect(validateBomParentChildKinds({ parentKind: 'assembly', childKind: 'assembly' })).toMatch(
        /primitive/i,
      );
      expect(validateBomParentChildKinds({ parentKind: 'scope', childKind: 'scope' })).toMatch(
        /cannot be nested/i,
      );
    });
  });
});
