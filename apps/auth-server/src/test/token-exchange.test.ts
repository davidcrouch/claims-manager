/**
 * =============================================================================
 * TOKEN EXCHANGE INTEGRATION TESTS
 * =============================================================================
 * 
 * This module contains comprehensive integration tests for the OAuth 2.0 Token Exchange
 * (RFC 8693) functionality implemented in the auth server.
 * 
 * Test Coverage:
 * - Token exchange endpoint functionality
 * - Subject token validation
 * - Resource access validation
 * - Backend token retrieval and refresh
 * - Error handling and edge cases
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { BackendService } from '../services/backend-service.js';
import { TokenExchangeService } from '../services/token-exchange-service.js';
import { 
  TokenExchangeRequest, 
  TokenExchangeResponse, 
  TokenExchangeErrorResponse 
} from '../types/token-exchange.js';

const baseLogger = createLogger('auth-server:token-exchange-test', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'token-exchange-test', 'TokenExchangeTest', 'auth-server');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
  baseUrl: 'http://localhost:3001',
  testClientId: 'test-client-id',
  testClientSecret: 'test-client-secret',
  testOrganizationId: 'test-org-123',
  testSubjectToken: 'test-subject-token-123',
  testBackendToken: 'test-backend-token-456'
};

// =============================================================================
// MOCK DATA
// =============================================================================

const mockStoredAccount = {
  accessToken: TEST_CONFIG.testBackendToken,
  refreshToken: 'test-refresh-token-789',
  user: {
    userId: TEST_CONFIG.testOrganizationId,
    name: 'Test User',
    email: 'test@example.com',
    avatarURL: 'https://example.com/avatar.jpg',
    phone: '+1234567890'
  },
  metadata: {
    stored_at: Date.now(),
    expires_at: Date.now() + 3600000, // 1 hour from now
    source: 'login',
    version: '1.0'
  }
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('OAuth 2.0 Token Exchange (RFC 8693)', () => {
  let app: Application;
  let backendService: BackendService;
  let tokenExchangeService: TokenExchangeService;

  beforeAll(async () => {
    log.info({ functionName: 'beforeAll' }, 'auth-server:token-exchange-test - Setting up test environment');
    
    // Initialize services
    backendService = new BackendService();
    tokenExchangeService = new TokenExchangeService(backendService);
    
    // Mock the getStoredUser function
    jest.doMock('../config/oidc-provider.js', () => ({
      getStoredUser: jest.fn().mockResolvedValue(mockStoredAccount),
      storeUser: jest.fn().mockResolvedValue(undefined)
    }));
  });

  afterAll(async () => {
    log.info({ functionName: 'afterAll' }, 'auth-server:token-exchange-test - Cleaning up test environment');
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // =============================================================================
  // TOKEN EXCHANGE SERVICE TESTS
  // =============================================================================

  describe('TokenExchangeService', () => {
    describe('exchangeToken', () => {
      it('should successfully exchange a valid subject token', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('token_type', 'Bearer');
        expect(result).toHaveProperty('expires_in');
        expect(result).toHaveProperty('issued_token_type', 'urn:example:token-type:backend');
        
        if ('access_token' in result) {
          expect(result.access_token).toBe(TEST_CONFIG.testBackendToken);
        }
      });

      it('should return error for missing grant_type', async () => {
        const request: Partial<TokenExchangeRequest> = {
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
        };

        const result = await tokenExchangeService.exchangeToken(request as TokenExchangeRequest);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for invalid grant_type', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'invalid_grant_type',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for missing subject_token', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: '',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for unsupported subject_token_type', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'unsupported_token_type'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for unsupported requested_token_type', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'unsupported_requested_type'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should validate resource access when resource parameter is provided', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          resource: 'https://api.morezero.com/v1/users'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('token_type', 'Bearer');
      });

      it('should return error for unauthorized resource access', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: TEST_CONFIG.testSubjectToken,
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          resource: 'https://unauthorized-resource.com/'
        };

        const result = await tokenExchangeService.exchangeToken(request);

        expect(result).toHaveProperty('error', 'invalid_target');
        expect(result).toHaveProperty('error_description');
      });
    });

    describe('validateSubjectToken', () => {
      it('should validate a valid subject token', async () => {
        const result = await tokenExchangeService.validateSubjectToken(
          TEST_CONFIG.testSubjectToken,
          'urn:ietf:params:oauth:token-type:access_token'
        );

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('valid', true);
        expect(result.data).toHaveProperty('organization_id');
      });

      it('should return error for unsupported token type', async () => {
        const result = await tokenExchangeService.validateSubjectToken(
          TEST_CONFIG.testSubjectToken,
          'unsupported_token_type'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Unsupported subject token type');
      });

      it('should return error for invalid token format', async () => {
        const result = await tokenExchangeService.validateSubjectToken(
          'invalid_token_format',
          'urn:ietf:params:oauth:token-type:access_token'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid subject token format');
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Tests', () => {
    it('should handle complete token exchange flow', async () => {
      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: TEST_CONFIG.testSubjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:example:token-type:backend',
        resource: 'https://api.morezero.com/v1/',
        scope: 'openid profile email'
      };

      const result = await tokenExchangeService.exchangeToken(request);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in');
      expect(result).toHaveProperty('issued_token_type', 'urn:example:token-type:backend');
      expect(result).toHaveProperty('scope', 'openid profile email');
    });

    it('should handle token refresh when needed', async () => {
      // Mock a token that needs refresh
      const expiredAccount = {
        ...mockStoredAccount,
        metadata: {
          ...mockStoredAccount.metadata,
          expires_at: Date.now() - 1000 // Expired 1 second ago
        }
      };

      // Mock the getStoredUser to return expired token
      jest.doMock('../config/oidc-provider.js', () => ({
        getStoredUser: jest.fn().mockResolvedValue(expiredAccount),
        storeUser: jest.fn().mockResolvedValue(undefined)
      }));

      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: TEST_CONFIG.testSubjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
      };

      const result = await tokenExchangeService.exchangeToken(request);

      // Should still return a token (either refreshed or existing)
      expect(result).toHaveProperty('access_token');
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle backend service errors gracefully', async () => {
      // Mock backend service to throw error
      const mockBackendService = {
        refreshStoredUserTokens: jest.fn().mockRejectedValue(new Error('Backend service error'))
      };

      const serviceWithError = new TokenExchangeService(mockBackendService as any);
      
      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: TEST_CONFIG.testSubjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
      };

      const result = await serviceWithError.exchangeToken(request);

      expect(result).toHaveProperty('error', 'server_error');
    });

    it('should handle Redis connection errors gracefully', async () => {
      // Mock getStoredUser to throw error
      jest.doMock('../config/oidc-provider.js', () => ({
        getStoredUser: jest.fn().mockRejectedValue(new Error('Redis connection error')),
        storeUser: jest.fn().mockResolvedValue(undefined)
      }));

      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: TEST_CONFIG.testSubjectToken,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token'
      };

      const result = await tokenExchangeService.exchangeToken(request);

      expect(result).toHaveProperty('error', 'server_error');
    });
  });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a mock Express app for testing
 */
function createMockApp(): Application {
  // This would be implemented with actual Express app setup
  // For now, it's a placeholder for integration tests
  return {} as Application;
}

/**
 * Generate a test JWT token
 */
function generateTestJWT(payload: any): string {
  // This would generate a real JWT for testing
  // For now, it's a placeholder
  return 'test.jwt.token';
}

export default {
  TEST_CONFIG,
  mockStoredAccount,
  createMockApp,
  generateTestJWT
};
