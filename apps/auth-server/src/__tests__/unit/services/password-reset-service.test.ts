jest.mock('../../../src/lib/cache/global-cache-manager.js', () => ({
  GlobalCacheManager: {
    getInstance: jest.fn(),
  },
}));

jest.mock('../../../src/config/env-validation.js', () => ({
  getBaseUrl: () => 'https://auth-staging.example.com',
}));

jest.mock('../../../src/services/email/index.js', () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../src/services/identity-registration-service.js', () => ({
  getUserByEmail: jest.fn(),
  setPasswordForUser: jest.fn(),
}));

import { GlobalCacheManager } from '../../../src/lib/cache/global-cache-manager.js';
import { getUserByEmail, setPasswordForUser } from '../../../src/services/identity-registration-service.js';
import { confirmPasswordReset } from '../../../src/services/password-reset-service.js';

const getUserByEmailMock = getUserByEmail as jest.MockedFunction<typeof getUserByEmail>;
const setPasswordForUserMock = setPasswordForUser as jest.MockedFunction<typeof setPasswordForUser>;
const getInstanceMock = GlobalCacheManager.getInstance as jest.Mock;

describe('confirmPasswordReset', () => {
  const redis = {
    get: jest.fn(),
    del: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    getInstanceMock.mockResolvedValue(redis);
  });

  it('updates the existing password identity and consumes the token', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ email: 'chris@ensureconstructions.com.au', createdAt: Date.now() }));
    getUserByEmailMock.mockResolvedValue({
      userId: '6afc0d80-fe9f-49c9-a0c3-ec02b50d9a48',
      email: 'chris@ensureconstructions.com.au',
    });
    setPasswordForUserMock.mockResolvedValue({ success: true, identityId: 'id-1' });
    redis.del.mockResolvedValue(1);

    const result = await confirmPasswordReset({ token: 'reset-token', password: 'newpassword1' });

    expect(result).toEqual({ success: true });
    expect(setPasswordForUserMock).toHaveBeenCalledWith({
      userId: '6afc0d80-fe9f-49c9-a0c3-ec02b50d9a48',
      email: 'chris@ensureconstructions.com.au',
      password: 'newpassword1',
    });
    expect(redis.del).toHaveBeenCalled();
  });

  it('does not report success or consume the token when persist fails', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ email: 'dave@more0.com.au', createdAt: Date.now() }));
    getUserByEmailMock.mockResolvedValue({
      userId: 'b7f432cd-75d7-490f-b2b2-2a963a2a2d91',
      email: 'dave@more0.com.au',
    });
    setPasswordForUserMock.mockResolvedValue({
      success: false,
      error: 'Password identity already exists for this account',
      errorCode: 'IDENTITY_ALREADY_EXISTS',
    });

    const result = await confirmPasswordReset({ token: 'reset-token', password: 'newpassword1' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
    expect(redis.del).not.toHaveBeenCalled();
  });
});
