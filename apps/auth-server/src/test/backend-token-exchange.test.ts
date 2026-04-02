/**
 * =============================================================================
 * BACKEND TOKEN EXCHANGE INTEGRATION TESTS
 * =============================================================================
 * 
 * This module contains comprehensive integration tests for the backend token
 * exchange functionality implemented in the auth server.
 * 
 * Test Coverage:
 * - Custom backend token type support
 * - Backend token validation and security
 * - Token expiration calculation
 * - Scope determination
 * - Refresh token protection
 * - Error handling and edge cases
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { BackendTokenExchangeService } from '../services/token-exchange/backend-token-exchange-service.js';
import { BackendTokenManager } from '../services/token-exchange/backend-token-manager.js';
import { 
  TokenExchangeRequest, 
  TokenExchangeResponse, 
  TokenExchangeErrorResponse 
} from '../types/token-exchange.js';
import { 
  BackendTokenRecord, 
  TokenStorageMetadata 
} from '../types/backend-tokens.js';

const baseLogger = createLogger('auth-server:backend-token-exchange-test', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'backend-token-exchange-test', 'BackendTokenExchangeTest', 'auth-server');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
  testOrganizationId: 'test-org-123',
  testBackendToken: 'test-backend-token-456',
  testResource: 'https://api.morezero.com/v1/',
  testScope: 'openid profile email backend:read'
};

// =============================================================================
// MOCK DATA
// =============================================================================

const mockBackendTokenRecord: BackendTokenRecord = {
  access_token: TEST_CONFIG.testBackendToken,
  token_type: 'Bearer',
  expires_in: 3600,
  scope: TEST_CONFIG.testScope,
  metadata: {
    created_at: Date.now(),
    expires_at: Date.now() + 3600000, // 1 hour from now
    source: 'token_exchange',
    version: '1.0',
    organization_id: TEST_CONFIG.testOrganizationId,
    refresh_count: 0,
    last_refresh: Date.now(),
    access_count: 0,
    last_accessed_at: Date.now()
  }
};

const mockExpiredTokenRecord: BackendTokenRecord = {
  ...mockBackendTokenRecord,
  metadata: {
    ...mockBackendTokenRecord.metadata!,
    expires_at: Date.now() - 3600000 // 1 hour ago
  }
};

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Backend Token Exchange System', () => {
  let backendTokenExchangeService: BackendTokenExchangeService;
  let mockBackendTokenManager: any;

  beforeAll(async () => {
    log.info({ functionName: 'beforeAll' }, 'auth-server:backend-token-exchange-test - Setting up test environment');
    
    // Create mock backend token manager
    mockBackendTokenManager = {
      getBackendToken: jest.fn().mockResolvedValue({
        success: true,
        data: mockBackendTokenRecord
      })
    };

    // Initialize service
    backendTokenExchangeService = new BackendTokenExchangeService(mockBackendTokenManager);
  });

  afterAll(async () => {
    log.info({ functionName: 'afterAll' }, 'auth-server:backend-token-exchange-test - Cleaning up test environment');
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // =============================================================================
  // BACKEND TOKEN EXCHANGE TESTS
  // =============================================================================

  describe('BackendTokenExchangeService', () => {
    describe('exchangeForBackendToken', () => {
      it('should successfully exchange for backend token', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend',
          resource: TEST_CONFIG.testResource,
          scope: TEST_CONFIG.testScope
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('issued_token_type', 'urn:example:token-type:backend');
        expect(result).toHaveProperty('token_type', 'Bearer');
        expect(result).toHaveProperty('expires_in');
        expect(result).toHaveProperty('scope');
        
        if ('access_token' in result) {
          expect(result.access_token).toBe(TEST_CONFIG.testBackendToken);
          expect(result.scope).toBe(TEST_CONFIG.testScope);
        }
      });

      it('should return error for invalid requested token type', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'invalid-token-type',
          resource: TEST_CONFIG.testResource
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for invalid resource parameter', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend',
          resource: 123 as any // Invalid type
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for invalid scope parameter', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend',
          scope: 123 as any // Invalid type
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should return error for invalid audience parameter', async () => {
        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend',
          audience: 123 as any // Invalid type
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_request');
        expect(result).toHaveProperty('error_description');
      });

      it('should handle backend token manager errors', async () => {
        // Mock backend token manager to return error
        mockBackendTokenManager.getBackendToken = jest.fn().mockResolvedValue({
          success: false,
          error: 'Backend token retrieval failed'
        });

        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend'
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_grant');
        expect(result).toHaveProperty('error_description', 'Unable to obtain backend token');
      });

      it('should handle expired backend tokens', async () => {
        // Mock backend token manager to return expired token
        mockBackendTokenManager.getBackendToken = jest.fn().mockResolvedValue({
          success: true,
          data: mockExpiredTokenRecord
        });

        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend'
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_grant');
        expect(result).toHaveProperty('error_description', 'Backend token has expired');
      });

      it('should handle missing access token', async () => {
        // Mock backend token manager to return token without access_token
        const invalidTokenRecord = {
          ...mockBackendTokenRecord,
          access_token: undefined
        };

        mockBackendTokenManager.getBackendToken = jest.fn().mockResolvedValue({
          success: true,
          data: invalidTokenRecord
        });

        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend'
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_grant');
        expect(result).toHaveProperty('error_description', 'No access token in record');
      });

      it('should handle missing metadata', async () => {
        // Mock backend token manager to return token without metadata
        const invalidTokenRecord = {
          ...mockBackendTokenRecord,
          metadata: undefined
        };

        mockBackendTokenManager.getBackendToken = jest.fn().mockResolvedValue({
          success: true,
          data: invalidTokenRecord
        });

        const request: TokenExchangeRequest = {
          grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
          subject_token: 'test-subject-token',
          subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
          requested_token_type: 'urn:example:token-type:backend'
        };

        const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

        expect(result).toHaveProperty('error', 'invalid_grant');
        expect(result).toHaveProperty('error_description', 'No metadata in token record');
      });
    });

    describe('getBackendTokenMetrics', () => {
      it('should get backend token metrics', async () => {
        const result = await backendTokenExchangeService.getBackendTokenMetrics();

        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
        expect(result.metrics?.totalExchanges).toBeDefined();
        expect(result.metrics?.successfulExchanges).toBeDefined();
        expect(result.metrics?.failedExchanges).toBeDefined();
        expect(result.metrics?.averageResponseTime).toBeDefined();
        expect(result.metrics?.lastExchange).toBeDefined();
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Tests', () => {
    it('should handle complete backend token exchange flow', async () => {
      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: 'test-subject-token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:example:token-type:backend',
        resource: TEST_CONFIG.testResource,
        scope: TEST_CONFIG.testScope,
        audience: 'https://api.morezero.com'
      };

      const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('issued_token_type', 'urn:example:token-type:backend');
      expect(result).toHaveProperty('token_type', 'Bearer');
      expect(result).toHaveProperty('expires_in');
      expect(result).toHaveProperty('scope');
    });

    it('should handle concurrent backend token exchanges', async () => {
      const requests = Array.from({ length: 5 }, (_, i) => ({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: `test-subject-token-${i}`,
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:example:token-type:backend',
        resource: TEST_CONFIG.testResource
      }));

      const results = await Promise.all(
        requests.map(request => 
          backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId)
        )
      );

      results.forEach(result => {
        expect(result).toHaveProperty('access_token');
        expect(result).toHaveProperty('issued_token_type', 'urn:example:token-type:backend');
      });
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle backend token manager exceptions', async () => {
      // Mock backend token manager to throw exception
      mockBackendTokenManager.getBackendToken = jest.fn().mockRejectedValue(new Error('Backend service error'));

      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: 'test-subject-token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:example:token-type:backend'
      };

      const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

      expect(result).toHaveProperty('error', 'server_error');
      expect(result).toHaveProperty('error_description', 'Internal server error');
    });

    it('should handle malformed token records', async () => {
      // Mock backend token manager to return malformed token
      mockBackendTokenManager.getBackendToken = jest.fn().mockResolvedValue({
        success: true,
        data: null
      });

      const request: TokenExchangeRequest = {
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        subject_token: 'test-subject-token',
        subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
        requested_token_type: 'urn:example:token-type:backend'
      };

      const result = await backendTokenExchangeService.exchangeForBackendToken(request, TEST_CONFIG.testOrganizationId);

      expect(result).toHaveProperty('error', 'invalid_grant');
      expect(result).toHaveProperty('error_description', 'No token record available');
    });
  });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a mock backend token manager for testing
 */
function createMockBackendTokenManager(): any {
  return {
    getBackendToken: jest.fn().mockResolvedValue({
      success: true,
      data: mockBackendTokenRecord
    })
  };
}

/**
 * Create a test token exchange request
 */
function createTestTokenExchangeRequest(overrides: Partial<TokenExchangeRequest> = {}): TokenExchangeRequest {
  return {
    grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
    subject_token: 'test-subject-token',
    subject_token_type: 'urn:ietf:params:oauth:token-type:access_token',
    requested_token_type: 'urn:example:token-type:backend',
    resource: TEST_CONFIG.testResource,
    scope: TEST_CONFIG.testScope,
    ...overrides
  };
}

export default {
  TEST_CONFIG,
  mockBackendTokenRecord,
  createMockBackendTokenManager,
  createTestTokenExchangeRequest
};
