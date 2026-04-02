import { BackendService } from '../../../src/services/backend-service';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('BackendService', () => {
  let backendService: BackendService;

  beforeEach(() => {
    backendService = new BackendService();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: {
              userId: '123',
              email: 'test@example.com',
              name: 'Test User'
            }
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await backendService.login({ email: 'test@example.com', password: 'password123' });

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          userId: '123',
          email: 'test@example.com',
          name: 'Test User',
          compName: undefined,
          compId: undefined,
          isAdmin: false,
          roleInCompany: undefined,
          avatarURL: undefined,
          phone: undefined
        }
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/v2/login'),
        expect.any(Object),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded'
          })
        })
      );
    });

    it('should handle login failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Login failed'));

      await expect(backendService.login({ email: 'test@example.com', password: 'wrongpassword' }))
        .rejects.toThrow('Login failed');
    });

    it('should handle network errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network Error'));

      await expect(backendService.login({ email: 'test@example.com', password: 'password123' }))
        .rejects.toThrow('Network Error');
    });
  });

  describe('createUserToken', () => {
    it('should successfully create user token', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: {
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token',
            user: {
              userId: '123',
              email: 'test@example.com',
              name: 'Test User'
            }
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await backendService.createUserToken({ email: 'test@example.com' });

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user: {
          userId: '123',
          email: 'test@example.com',
          name: 'Test User',
          compName: undefined,
          compId: undefined,
          isAdmin: false,
          roleInCompany: undefined,
          avatarURL: undefined,
          phone: undefined
        }
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/createUserToken'),
        expect.objectContaining({
          email: 'test@example.com'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle createUserToken failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Token creation failed'));

      await expect(backendService.createUserToken({ email: 'test@example.com' }))
        .rejects.toThrow('Token creation failed');
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh token', async () => {
      const mockResponse = {
        data: {
          success: true,
          result: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            csrfToken: 'csrf-token',
            expires_in: 3600
          }
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await backendService.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        csrfToken: 'csrf-token',
        expires_in: 3600
      });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/auth/refresh-token'),
        expect.objectContaining({
          refreshToken: 'valid-refresh-token'
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle invalid refresh token', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid refresh token'
        }
      };

      mockedAxios.post.mockResolvedValue(mockResponse);

      await expect(backendService.refreshToken('invalid-refresh-token'))
        .rejects.toThrow('Invalid refresh token');
    });
  });
});
