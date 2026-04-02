import request from 'supertest';
import express from 'express';
import createIatRoutes from '../../../src/routes/iat-routes';

// Mock dependencies
jest.mock('../../../src/services/jwt-service');
jest.mock('../../../src/services/backend-service');

const app = express();
app.use(express.json());
createIatRoutes(app);

describe('IAT Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /oauth/initial-access-token', () => {
    it('should issue IAT token with valid user token', async () => {
      const mockUserToken = 'valid-user-token';
      const mockIatToken = 'mock-iat-token';

      // Mock JWT service
      const { JwtService } = require('../../../src/services/jwt-service');
      JwtService.prototype.verifyToken = jest.fn().mockReturnValue({
        userId: '123',
        email: 'test@example.com'
      });
      JwtService.prototype.signToken = jest.fn().mockReturnValue(mockIatToken);

      const response = await request(app)
        .post('/oauth/initial-access-token')
        .send({ userToken: mockUserToken })
        .expect(200);

      expect(response.body).toHaveProperty('initial_access_token');
      expect(response.body.initial_access_token).toBe(mockIatToken);
      expect(response.body).toHaveProperty('as_reg_endpoint');
      expect(response.body).toHaveProperty('expires_in');
      expect(response.body).toHaveProperty('token_type', 'Bearer');
    });

    it('should return 400 for missing user token', async () => {
      const response = await request(app)
        .post('/oauth/initial-access-token')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('userToken is required');
    });

    it('should return 401 for invalid user token', async () => {
      const { JwtService } = require('../../../src/services/jwt-service');
      JwtService.prototype.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/oauth/initial-access-token')
        .send({ userToken: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('Invalid user token');
    });
  });

  describe('POST /oauth/validate-iat', () => {
    it('should validate IAT token successfully', async () => {
      const mockIatToken = 'valid-iat-token';
      const mockDecodedToken = {
        typ: 'dcr-iat',
        userId: '123',
        email: 'test@example.com',
        scopes: ['mcp:read', 'mcp:write'],
        max_clients: 10
      };

      const { JwtService } = require('../../../src/services/jwt-service');
      JwtService.prototype.verifyToken = jest.fn().mockReturnValue(mockDecodedToken);

      const response = await request(app)
        .post('/oauth/validate-iat')
        .send({ iatToken: mockIatToken })
        .expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('claims');
      expect(response.body.claims).toEqual(mockDecodedToken);
    });

    it('should return 400 for missing IAT token', async () => {
      const response = await request(app)
        .post('/oauth/validate-iat')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('iatToken is required');
    });

    it('should return 401 for invalid IAT token', async () => {
      const { JwtService } = require('../../../src/services/jwt-service');
      JwtService.prototype.verifyToken = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const response = await request(app)
        .post('/oauth/validate-iat')
        .send({ iatToken: 'invalid-iat-token' })
        .expect(401);

      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error');
    });
  });
});
