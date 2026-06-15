import {
  applyMarkup,
  computeLineTotals,
  formatDecimal,
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
        taxRate: '0.1',
      });
      expect(totals.subTotal).toBe('100.0000');
      expect(totals.totalTax).toBe('10.0000');
      expect(totals.total).toBe('110.0000');
    });
  });

  describe('formatDecimal', () => {
    it('formats to scale', () => {
      expect(formatDecimal(1.2, 2)).toBe('1.20');
    });
  });
});
