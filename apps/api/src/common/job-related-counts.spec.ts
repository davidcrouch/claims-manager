import { jobRelatedCountValue } from './job-related-counts';

describe('jobRelatedCountValue', () => {
  it('returns 0 when the row is missing', () => {
    expect(jobRelatedCountValue(undefined)).toBe(0);
  });

  it('returns the numeric count', () => {
    expect(jobRelatedCountValue({ count: 4 })).toBe(4);
  });

  it('coerces numeric strings and treats empty values as 0', () => {
    expect(jobRelatedCountValue({ count: '7' as unknown as number })).toBe(7);
    expect(jobRelatedCountValue({ count: 0 })).toBe(0);
  });
});
