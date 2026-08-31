import { isGcsSigningUnavailable } from './gcs-storage.service';

describe('isGcsSigningUnavailable', () => {
  it('treats Cloud Run signBlob denial as stream-fallback', () => {
    expect(
      isGcsSigningUnavailable(
        new Error(
          "Permission 'iam.serviceAccounts.signBlob' denied on resource (or it may not exist).",
        ),
      ),
    ).toBe(true);
  });

  it('treats local ADC cannot-sign errors as stream-fallback', () => {
    expect(
      isGcsSigningUnavailable(
        new Error('Cannot sign data without `client_email`.'),
      ),
    ).toBe(true);
  });

  it('does not swallow unrelated GCS errors', () => {
    expect(isGcsSigningUnavailable(new Error('No such object: bucket/key'))).toBe(
      false,
    );
  });
});
