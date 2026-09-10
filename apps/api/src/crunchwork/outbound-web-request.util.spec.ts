import {
  appendQueryParamsToUrl,
  parseEntityFromPath,
  sanitizeJsonBody,
} from './outbound-web-request.util';

describe('appendQueryParamsToUrl', () => {
  it('returns the url unchanged when there are no query params', () => {
    expect(
      appendQueryParamsToUrl('https://example.com/rest/jobs/abc', {}),
    ).toBe('https://example.com/rest/jobs/abc');
  });

  it('appends query params to an absolute url', () => {
    expect(
      appendQueryParamsToUrl('https://example.com/rest/claims', {
        claimNumber: 'RAV260465608',
      }),
    ).toBe('https://example.com/rest/claims?claimNumber=RAV260465608');
  });

  it('does not duplicate keys already present on the url', () => {
    expect(
      appendQueryParamsToUrl(
        'https://example.com/rest/claims?claimNumber=RAV260465608',
        { claimNumber: 'RAV260465608' },
      ),
    ).toBe('https://example.com/rest/claims?claimNumber=RAV260465608');
  });
});

describe('parseEntityFromPath', () => {
  it('maps collection paths without an id', () => {
    expect(parseEntityFromPath('/jobs')).toEqual({
      entityType: 'job',
      entityId: null,
    });
  });

  it('extracts entity id from the second segment', () => {
    expect(parseEntityFromPath('/jobs/abc-123/status')).toEqual({
      entityType: 'job',
      entityId: 'abc-123',
    });
  });

  it('maps hyphenated collections', () => {
    expect(parseEntityFromPath('/purchase-orders/po-1')).toEqual({
      entityType: 'purchase_order',
      entityId: 'po-1',
    });
  });

  it('treats allocation as a collection action, not an id', () => {
    expect(parseEntityFromPath('/vendors/allocation')).toEqual({
      entityType: 'vendor',
      entityId: null,
    });
  });

  it('handles the quotes revison typo path', () => {
    expect(parseEntityFromPath('/quotes/revison/rev-9')).toEqual({
      entityType: 'quote',
      entityId: 'rev-9',
    });
  });
});

describe('sanitizeJsonBody', () => {
  it('redacts sensitive keys', () => {
    expect(
      sanitizeJsonBody({
        clientSecret: 'shh',
        access_token: 'tok',
        name: 'ok',
      }),
    ).toEqual({
      clientSecret: '[redacted]',
      access_token: '[redacted]',
      name: 'ok',
    });
  });

  it('truncates oversized payloads', () => {
    const result = sanitizeJsonBody({ blob: 'x'.repeat(20_000) }, 100);
    expect(result).toEqual(
      expect.objectContaining({ _truncated: true }),
    );
  });
});
