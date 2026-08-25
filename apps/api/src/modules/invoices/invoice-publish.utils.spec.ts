import { preferExistingAmount } from './invoice-publish.utils';

describe('preferExistingAmount', () => {
  it('keeps a local total when the provider returns 0', () => {
    expect(preferExistingAmount(0, '1526.29')).toBe('1526.29');
    expect(preferExistingAmount('0.00', '100')).toBe('100');
  });

  it('uses the provider total when it is non-zero', () => {
    expect(preferExistingAmount(88.5, '100')).toBe('88.5');
  });

  it('falls back to existing when the provider omits the field', () => {
    expect(preferExistingAmount(undefined, '42')).toBe('42');
    expect(preferExistingAmount(null, null)).toBeUndefined();
  });
});
