import { isRetryableCrunchworkFailure } from './crunchwork-errors';

describe('isRetryableCrunchworkFailure', () => {
  it('retries empty 500s and HTML gateway pages', () => {
    expect(isRetryableCrunchworkFailure({ status: 500 })).toBe(true);
    expect(
      isRetryableCrunchworkFailure({
        status: 502,
        body: '<html><body>Bad Gateway</body></html>',
      }),
    ).toBe(true);
  });

  it('does not retry 500s with a plain-text business rule', () => {
    expect(
      isRetryableCrunchworkFailure({
        status: 500,
        body: 'Unable to create a new vendor tax invoice, as the current purchase order total is less than the configured partial-invoicing minimum total.',
      }),
    ).toBe(false);
  });

  it('retries 429', () => {
    expect(isRetryableCrunchworkFailure({ status: 429, body: 'slow down' })).toBe(true);
  });
});
