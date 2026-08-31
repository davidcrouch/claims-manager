import {
  csvEscape,
  csvRow,
  formatCsvBool,
  formatCwMarkupType,
  formatMetadataCsvValue,
  formatRateForCsv,
  getNestedValue,
  parseMetadataJson,
  catalogFilenameSlug,
  kindSortRank,
} from './catalog-export.utils';

describe('catalog-export.utils', () => {
  it('escapes commas and quotes', () => {
    expect(csvEscape('plain')).toBe('plain');
    expect(csvEscape('a,b')).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvRow(['a', 'b,c', null])).toBe('a,"b,c",');
  });

  it('emits Crunchwork percentage points and TRUE/FALSE', () => {
    expect(
      formatRateForCsv({
        value: '0.19',
        format: 'crunchwork',
        asPercentPoints: true,
      }),
    ).toBe('19');
    expect(
      formatRateForCsv({
        value: '0.19',
        format: 'internal',
        asPercentPoints: true,
      }),
    ).toBe('0.19');
    expect(
      formatRateForCsv({
        value: '12.5',
        format: 'crunchwork',
        markupType: 'fixed',
        asPercentPoints: true,
      }),
    ).toBe('12.5');
    expect(formatCsvBool(true)).toBe('TRUE');
    expect(formatCwMarkupType('percent')).toBe('Percentage');
  });

  it('reads nested metadata', () => {
    expect(getNestedValue({ locks: { qty: true } }, 'locks.qty')).toBe(true);
    expect(formatMetadataCsvValue(['a', 'b'])).toBe('a,b');
  });

  describe('parseMetadataJson', () => {
    it('parses valid JSON object', () => {
      expect(parseMetadataJson('{"defaultQuantity":4,"locks":{"qty":true}}')).toEqual({
        defaultQuantity: 4,
        locks: { qty: true },
      });
    });

    it('returns null for empty string', () => {
      expect(parseMetadataJson('')).toBeNull();
    });

    it('returns null for invalid JSON', () => {
      expect(parseMetadataJson('{broken')).toBeNull();
    });

    it('returns null for non-object JSON (array)', () => {
      expect(parseMetadataJson('[1,2,3]')).toBeNull();
    });

    it('returns null for primitive JSON', () => {
      expect(parseMetadataJson('"hello"')).toBeNull();
    });
  });

  describe('catalogFilenameSlug', () => {
    it('slugifies catalogue name', () => {
      expect(catalogFilenameSlug('Ensure Catalogue')).toBe('ensure-catalogue');
    });

    it('strips special characters', () => {
      expect(catalogFilenameSlug('CW 2026-04/35')).toBe('cw-2026-04-35');
    });

    it('truncates long names', () => {
      const long = 'a'.repeat(100);
      expect(catalogFilenameSlug(long).length).toBeLessThanOrEqual(60);
    });
  });

  describe('kindSortRank', () => {
    it('orders scope < assembly < primitive', () => {
      expect(kindSortRank('scope')).toBeLessThan(kindSortRank('assembly'));
      expect(kindSortRank('assembly')).toBeLessThan(kindSortRank('primitive'));
    });
  });

  describe('formatMetadataCsvValue', () => {
    it('formats booleans as TRUE/FALSE', () => {
      expect(formatMetadataCsvValue(true)).toBe('TRUE');
      expect(formatMetadataCsvValue(false)).toBe('FALSE');
    });

    it('formats null/undefined as empty string', () => {
      expect(formatMetadataCsvValue(null)).toBe('');
      expect(formatMetadataCsvValue(undefined)).toBe('');
    });

    it('formats numbers as strings', () => {
      expect(formatMetadataCsvValue(42)).toBe('42');
    });
  });
});
