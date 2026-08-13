import { matchPermission, hasPlatformAdminCapability } from './permission-match';

describe('permission-match', () => {
  it('matches exact, wildcard, and prefix permissions', () => {
    expect(matchPermission(['claims.read'], 'claims.read')).toBe(true);
    expect(matchPermission(['*'], 'claims.delete')).toBe(true);
    expect(matchPermission(['claims.*'], 'claims.create')).toBe(true);
    expect(matchPermission(['org.*'], 'platform.users.manage')).toBe(false);
    expect(matchPermission([], 'claims.read')).toBe(false);
    expect(matchPermission(undefined, 'claims.read')).toBe(false);
  });

  it('derives platform admin capability from permissions', () => {
    expect(hasPlatformAdminCapability(['*'])).toBe(true);
    expect(hasPlatformAdminCapability(['platform.users.manage'])).toBe(true);
    expect(hasPlatformAdminCapability(['claims.read'])).toBe(false);
  });
});
