import {
  applyMarkup,
  bomComponentRuleMessage,
  buildComboPayload,
  comboKindFromPayload,
  copyUnitCostToBuyCostForCrunchwork,
  computeLineTotals,
  formatDecimal,
  hoistProviderCombos,
  isAllowedBomComponent,
  isCatalogBomParentKind,
  isScopeComboPayload,
  parentComboIdFromPayload,
  parseDecimal,
  normalizeProviderCodes,
  catalogItemAllowsProvider,
  defaultProviderCodesForImport,
  isEnsureCatalogName,
  providerCodesForEnsureCatalogItem,
  resolveCatalogItemProviderCodes,
} from './catalog.utils';

describe('catalog.utils', () => {
  describe('parseDecimal', () => {
    it('parses numeric strings', () => {
      expect(parseDecimal('12.5')).toBe(12.5);
      expect(parseDecimal(null)).toBe(0);
    });
  });

  describe('copyUnitCostToBuyCostForCrunchwork', () => {
    it('copies unitCost onto buyCost', () => {
      const item = { unitCost: 45.5, buyCost: 12 };
      copyUnitCostToBuyCostForCrunchwork(item);
      expect(item.buyCost).toBe(45.5);
    });

    it('leaves buyCost unchanged when unitCost is missing', () => {
      const item = { buyCost: 12 };
      copyUnitCostToBuyCostForCrunchwork(item);
      expect(item.buyCost).toBe(12);
    });
  });

  describe('applyMarkup', () => {
    it('applies percent markup from decimal rate', () => {
      expect(applyMarkup({ baseCost: 100, markupType: 'percent', markupValue: '0.10' })).toBeCloseTo(110);
    });

    it('applies fixed markup', () => {
      expect(applyMarkup({ baseCost: 100, markupType: 'fixed', markupValue: '25' })).toBe(125);
    });
  });

  describe('computeLineTotals', () => {
    it('computes subtotal tax and total from decimal tax rate', () => {
      const totals = computeLineTotals({
        quantity: '2',
        unitCost: '50',
        taxRate: '0.10',
      });
      expect(totals.subTotal).toBe('100.0000');
      expect(totals.totalTax).toBe('10.0000');
      expect(totals.total).toBe('110.0000');
    });

    it('coerces legacy percentage-point tax rates', () => {
      const totals = computeLineTotals({
        quantity: '1',
        unitCost: '100',
        taxRate: '10',
      });
      expect(totals.totalTax).toBe('10.0000');
    });
  });

  describe('isCatalogBomParentKind', () => {
    it('treats assembly and scope as BOM parents', () => {
      expect(isCatalogBomParentKind('assembly')).toBe(true);
      expect(isCatalogBomParentKind('scope')).toBe(true);
      expect(isCatalogBomParentKind('primitive')).toBe(false);
    });
  });

  describe('isAllowedBomComponent', () => {
    it('allows only primitives under assemblies', () => {
      expect(isAllowedBomComponent('assembly', 'primitive')).toBe(true);
      expect(isAllowedBomComponent('assembly', 'assembly')).toBe(false);
      expect(isAllowedBomComponent('assembly', 'scope')).toBe(false);
    });

    it('allows primitives and assemblies under scopes', () => {
      expect(isAllowedBomComponent('scope', 'primitive')).toBe(true);
      expect(isAllowedBomComponent('scope', 'assembly')).toBe(true);
      expect(isAllowedBomComponent('scope', 'scope')).toBe(false);
    });

    it('rejects non-BOM parents', () => {
      expect(isAllowedBomComponent('primitive', 'primitive')).toBe(false);
    });
  });

  describe('bomComponentRuleMessage', () => {
    it('explains nesting violations', () => {
      expect(bomComponentRuleMessage('assembly', 'assembly')).toMatch(/primitive/i);
      expect(bomComponentRuleMessage('scope', 'scope')).toMatch(/cannot be nested/i);
    });
  });

  describe('comboKindFromPayload', () => {
    it('reads kind from payload or nested comboPayload', () => {
      expect(comboKindFromPayload({ kind: 'scope' })).toBe('scope');
      expect(comboKindFromPayload({ comboPayload: { kind: 'scope' } })).toBe('scope');
      expect(comboKindFromPayload({ kind: 'assembly' })).toBe('assembly');
      expect(comboKindFromPayload({})).toBe('assembly');
      expect(comboKindFromPayload(null)).toBe('assembly');
    });

    it('detects scope combo payloads', () => {
      expect(isScopeComboPayload({ kind: 'scope' })).toBe(true);
      expect(isScopeComboPayload({ kind: 'assembly' })).toBe(false);
    });
  });

  describe('parentComboIdFromPayload', () => {
    it('reads parentComboId from payload or nested comboPayload', () => {
      expect(parentComboIdFromPayload({ parentComboId: 'scope-1' })).toBe('scope-1');
      expect(parentComboIdFromPayload({ comboPayload: { parentComboId: 'scope-2' } })).toBe(
        'scope-2',
      );
      expect(parentComboIdFromPayload({ kind: 'assembly' })).toBeNull();
      expect(parentComboIdFromPayload(null)).toBeNull();
    });
  });

  describe('buildComboPayload', () => {
    it('includes parentComboId only when set', () => {
      expect(buildComboPayload({ kind: 'scope' })).toEqual({ kind: 'scope' });
      expect(buildComboPayload({ kind: 'assembly', parentComboId: 'scope-1' })).toEqual({
        kind: 'assembly',
        parentComboId: 'scope-1',
      });
    });
  });

  describe('hoistProviderCombos', () => {
    type Combo = { id: string; comboPayload: unknown; name: string };
    type Item = { id: string };

    it('strips scopes and hoists primitive children onto the group', () => {
      const scope: Combo = {
        id: 'scope-1',
        name: 'Ensure scope',
        comboPayload: { kind: 'scope' },
      };
      const itemsByComboId = new Map<string, Item[]>([['scope-1', [{ id: 'p1' }, { id: 'p2' }]]]);

      const result = hoistProviderCombos({
        combos: [scope],
        itemsByComboId,
        keepCombo: () => false,
      });

      expect(result.strippedComboCount).toBe(1);
      expect(result.kept).toEqual([]);
      expect(result.groupItems.map((i) => i.id)).toEqual(['p1', 'p2']);
    });

    it('keeps provider assemblies and attaches their items', () => {
      const assembly: Combo = {
        id: 'asm-1',
        name: 'Kit',
        comboPayload: { kind: 'assembly' },
      };
      const itemsByComboId = new Map<string, Item[]>([['asm-1', [{ id: 'p1' }]]]);

      const result = hoistProviderCombos({
        combos: [assembly],
        itemsByComboId,
        keepCombo: () => true,
      });

      expect(result.strippedComboCount).toBe(0);
      expect(result.groupItems).toEqual([]);
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].combo.id).toBe('asm-1');
      expect(result.kept[0].items.map((i) => i.id)).toEqual(['p1']);
    });

    it('strips nested scopes and promotes a kept child assembly to the group', () => {
      const scope: Combo = {
        id: 'scope-1',
        name: 'Scope',
        comboPayload: { kind: 'scope' },
      };
      const assembly: Combo = {
        id: 'asm-1',
        name: 'Kit',
        comboPayload: { kind: 'assembly', parentComboId: 'scope-1' },
      };
      const itemsByComboId = new Map<string, Item[]>([['asm-1', [{ id: 'p1' }]]]);

      const result = hoistProviderCombos({
        combos: [scope, assembly],
        itemsByComboId,
        keepCombo: (c) => c.id === 'asm-1',
      });

      expect(result.strippedComboCount).toBe(1);
      expect(result.groupItems).toEqual([]);
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].combo.id).toBe('asm-1');
      expect(result.kept[0].items.map((i) => i.id)).toEqual(['p1']);
    });

    it('hoists items from stripped descendants into a kept ancestor combo', () => {
      const assembly: Combo = {
        id: 'asm-1',
        name: 'Kit',
        comboPayload: { kind: 'assembly' },
      };
      const nestedScope: Combo = {
        id: 'scope-2',
        name: 'Nested scope',
        comboPayload: { kind: 'scope', parentComboId: 'asm-1' },
      };
      const itemsByComboId = new Map<string, Item[]>([
        ['asm-1', [{ id: 'own' }]],
        ['scope-2', [{ id: 'nested' }]],
      ]);

      const result = hoistProviderCombos({
        combos: [assembly, nestedScope],
        itemsByComboId,
        keepCombo: (c) => c.id === 'asm-1',
      });

      expect(result.strippedComboCount).toBe(1);
      expect(result.kept).toHaveLength(1);
      expect(result.kept[0].items.map((i) => i.id)).toEqual(['own', 'nested']);
    });
  });

  describe('formatDecimal', () => {
    it('formats to scale', () => {
      expect(formatDecimal(1.2, 2)).toBe('1.20');
    });
  });

  describe('normalizeProviderCodes', () => {
    it('trims, lowercases, and dedupes', () => {
      expect(normalizeProviderCodes([' Internal ', 'CRUNCHWORK', 'internal'])).toEqual([
        'internal',
        'crunchwork',
      ]);
    });

    it('returns empty for non-arrays', () => {
      expect(normalizeProviderCodes(null)).toEqual([]);
      expect(normalizeProviderCodes('crunchwork')).toEqual([]);
    });
  });

  describe('catalogItemAllowsProvider', () => {
    it('keeps all items when providerCode is absent', () => {
      expect(catalogItemAllowsProvider(['internal'], undefined)).toBe(true);
      expect(catalogItemAllowsProvider([], null)).toBe(true);
    });

    it('strips items without the target provider tag', () => {
      expect(catalogItemAllowsProvider(['internal'], 'crunchwork')).toBe(false);
      expect(catalogItemAllowsProvider(['crunchwork'], 'crunchwork')).toBe(true);
      expect(catalogItemAllowsProvider(['internal', 'crunchwork'], 'crunchwork')).toBe(true);
    });

    it('strips items with empty provider tags when filtering', () => {
      expect(catalogItemAllowsProvider([], 'crunchwork')).toBe(false);
      expect(catalogItemAllowsProvider(undefined, 'crunchwork')).toBe(false);
    });
  });

  describe('defaultProviderCodesForImport', () => {
    it('defaults crunchwork imports to crunchwork', () => {
      expect(defaultProviderCodesForImport('crunchwork')).toEqual(['crunchwork']);
    });

    it('defaults internal imports to internal', () => {
      expect(defaultProviderCodesForImport('internal')).toEqual(['internal']);
    });

    it('forces scopes to internal even for crunchwork imports', () => {
      expect(defaultProviderCodesForImport('crunchwork', 'scope')).toEqual(['internal']);
    });
  });

  describe('isEnsureCatalogName', () => {
    it('matches Ensure and Ensure Catalogue', () => {
      expect(isEnsureCatalogName('Ensure')).toBe(true);
      expect(isEnsureCatalogName('Ensure Catalogue')).toBe(true);
      expect(isEnsureCatalogName('ensure catalogue')).toBe(true);
      expect(isEnsureCatalogName('Crunchwork 2026-04-35')).toBe(false);
      expect(isEnsureCatalogName('Default')).toBe(false);
    });
  });

  describe('providerCodesForEnsureCatalogItem', () => {
    it('tags Ensure primitives as crunchwork and scopes as internal', () => {
      expect(providerCodesForEnsureCatalogItem('primitive')).toEqual(['crunchwork']);
      expect(providerCodesForEnsureCatalogItem('scope')).toEqual(['internal']);
      expect(providerCodesForEnsureCatalogItem('assembly')).toEqual(['internal']);
    });
  });

  describe('resolveCatalogItemProviderCodes', () => {
    it('forces scopes to internal', () => {
      expect(
        resolveCatalogItemProviderCodes({
          kind: 'scope',
          providerCodes: ['crunchwork'],
          catalogType: 'crunchwork',
        }),
      ).toEqual(['internal']);
    });

    it('defaults non-scopes from catalogue type', () => {
      expect(
        resolveCatalogItemProviderCodes({
          kind: 'primitive',
          catalogType: 'crunchwork',
        }),
      ).toEqual(['crunchwork']);
    });
  });
});
