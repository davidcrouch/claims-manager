import { resolveCwQuoteExternalReference } from './quote-outbound.utils';

describe('resolveCwQuoteExternalReference', () => {
  it('prefers quoteNumber over internalNumber', () => {
    expect(
      resolveCwQuoteExternalReference({
        quoteNumber: 'EST-200073',
        internalNumber: 'EST-000001',
      }),
    ).toBe('EST-200073');
  });

  it('falls back to internalNumber when quoteNumber is blank', () => {
    expect(
      resolveCwQuoteExternalReference({
        quoteNumber: '  ',
        internalNumber: 'EST-000001',
      }),
    ).toBe('EST-000001');
  });

  it('returns undefined when both are missing', () => {
    expect(resolveCwQuoteExternalReference({})).toBeUndefined();
  });
});
