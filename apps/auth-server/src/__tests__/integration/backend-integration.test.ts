import request from 'supertest';
import { createServer } from '../../../src/server.js';

// Mock the backend service for integration tests
jest.mock('../../../src/services/backend-service', () => {
  return {
    BackendService: jest.fn().mockImplementation(() => ({
      login: jest.fn().mockResolvedValue({
        success: true,
        result: {
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          user: {
            userId: '123',
            email: 'test@example.com',
            name: 'Test User',
            compName: 'Test Company',
            compId: 'comp-123',
            isAdmin: false,
            roleInCompany: 'Manager',
            avatarURL: 'https://example.com/avatar.jpg',
            phone: '+1234567890'
          }
        }
      }),
      createUserToken: jest.fn().mockResolvedValue({
        success: true,
        result: {
          accessToken: 'mock-user-token',
          refreshToken: 'mock-refresh-token',
          user: {
            userId: '123',
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      }),
      validateUserToken: jest.fn().mockResolvedValue({
        success: true,
        result: {
          valid: true,
          user: {
            userId: '123',
            email: 'test@example.com',
            name: 'Test User'
          }
        }
      })
    }))
  };
});

describe('Backend Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    const serverInstance = await createServer();
    app = serverInstance.app;
    server = serverInstance.server;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Backend API Integration', () => {
    it('should integrate with backend login endpoint', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('accessToken');
      expect(response.body.result).toHaveProperty('user');
      expect(response.body.result.user).toHaveProperty('userId', '123');
      expect(response.body.result.user).toHaveProperty('email', 'test@example.com');
    });

    it('should integrate with backend createUserToken endpoint', async () => {
      const response = await request(app)
        .post('/auth/createUserToken')
        .send({
          email: 'test@example.com'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('accessToken');
      expect(response.body.result).toHaveProperty('user');
    });

    it('should integrate with backend validateUserToken endpoint', async () => {
      const response = await request(app)
        .post('/auth/validateUserToken')
        .send({
          token: 'valid-token'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('valid', true);
      expect(response.body.result).toHaveProperty('user');
    });
  });

  describe('Error Handling', () => {
    it('should handle backend service errors gracefully', async () => {
      // Mock backend service to throw error
      const { BackendService } = require('../../../src/services/backend-service');
      const mockInstance = new BackendService();
      mockInstance.login = jest.fn().mockRejectedValue(new Error('Backend service unavailable'));

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        })
        .expect(500);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Backend service unavailable');
    });
  });
});
