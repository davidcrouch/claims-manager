import {
  escapeRegExp,
  nextVariationInternalNumber,
} from './variation-number';

describe('nextVariationInternalNumber', () => {
  it('appends -1 when no siblings exist', () => {
    expect(nextVariationInternalNumber('EST-200206', [])).toBe('EST-200206-1');
  });

  it('increments past existing direct siblings', () => {
    expect(
      nextVariationInternalNumber('EST-200206', ['EST-200206-1', 'EST-200206-3']),
    ).toBe('EST-200206-4');
  });

  it('ignores nested variation numbers of siblings', () => {
    expect(
      nextVariationInternalNumber('EST-200206', [
        'EST-200206-1',
        'EST-200206-1-1',
        'EST-200206-2',
      ]),
    ).toBe('EST-200206-3');
  });

  it('appends another suffix when varying a variation', () => {
    expect(nextVariationInternalNumber('EST-200206-1', [])).toBe('EST-200206-1-1');
    expect(
      nextVariationInternalNumber('EST-200206-1', ['EST-200206-1-1']),
    ).toBe('EST-200206-1-2');
  });
});

describe('escapeRegExp', () => {
  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('EST-200206')).toBe('EST-200206');
    expect(escapeRegExp('A.B+C')).toBe('A\\.B\\+C');
  });
});
