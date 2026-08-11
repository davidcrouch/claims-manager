import {
  applyMarkup,
  buildComboPayload,
  comboKindFromPayload,
  computeLineTotals,
  formatDecimal,
  isCatalogBomParentKind,
  isScopeComboPayload,
  parentComboIdFromPayload,
  parseDecimal,
} from './catalog.utils';

describe('catalog.utils', () => {
  describe('parseDecimal', () => {
    it('parses numeric strings', () => {
      expect(parseDecimal('12.5')).toBe(12.5);
      expect(parseDecimal(null)).toBe(0);
    });
  });

  describe('applyMarkup', () => {
    it('applies percent markup', () => {
      expect(applyMarkup({ baseCost: 100, markupType: 'percent', markupValue: '10' })).toBeCloseTo(110);
    });

    it('applies fixed markup', () => {
      expect(applyMarkup({ baseCost: 100, markupType: 'fixed', markupValue: '25' })).toBe(125);
    });
  });

  describe('computeLineTotals', () => {
    it('computes subtotal tax and total', () => {
      const totals = computeLineTotals({
        quantity: '2',
        unitCost: '50',
        taxRate: '10',
      });
      expect(totals.subTotal).toBe('100.0000');
      expect(totals.totalTax).toBe('10.0000');
      expect(totals.total).toBe('110.0000');
    });
  });

  describe('isCatalogBomParentKind', () => {
    it('treats assembly and scope as BOM parents', () => {
      expect(isCatalogBomParentKind('assembly')).toBe(true);
      expect(isCatalogBomParentKind('scope')).toBe(true);
      expect(isCatalogBomParentKind('primitive')).toBe(false);
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

  describe('formatDecimal', () => {
    it('formats to scale', () => {
      expect(formatDecimal(1.2, 2)).toBe('1.20');
    });
  });
});
