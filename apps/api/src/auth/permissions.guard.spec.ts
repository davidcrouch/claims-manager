import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './guards/permissions.guard';
import { PERMISSIONS_KEY } from './decorators/require-permission.decorator';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

function makeContext(user: Record<string, unknown> | undefined) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, path: '/test' }),
    }),
  } as never;
}

describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  it('allows public routes', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });
    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('allows endpoints with no required permissions', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return [];
      return undefined;
    });
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('allows when all required permissions are held (AND)', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['claims.read', 'claims.update'];
      return undefined;
    });
    expect(
      guard.canActivate(
        makeContext({
          permissions: ['claims.read', 'claims.update', 'claims.create'],
        }),
      ),
    ).toBe(true);
  });

  it('allows prefix wildcards', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['claims.read'];
      return undefined;
    });
    expect(guard.canActivate(makeContext({ permissions: ['claims.*'] }))).toBe(
      true,
    );
  });

  it('denies when a required permission is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['claims.read', 'claims.update'];
      return undefined;
    });
    expect(() =>
      guard.canActivate(makeContext({ permissions: ['claims.read'] })),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when permissions claim is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === PERMISSIONS_KEY) return ['claims.read'];
      return undefined;
    });
    expect(() =>
      guard.canActivate(makeContext({ permissions: undefined })),
    ).toThrow(ForbiddenException);
  });
});
