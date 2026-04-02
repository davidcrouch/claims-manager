/**
 * =============================================================================
 * TOKEN MANAGEMENT INTEGRATION TESTS
 * =============================================================================
 * 
 * This module contains comprehensive integration tests for the token management
 * functionality implemented in the auth server.
 * 
 * Test Coverage:
 * - Token storage and retrieval
 * - Token lifecycle management
 * - Cleanup and monitoring
 * - Performance and health checks
 * - Error handling and edge cases
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { RedisTokenStorage } from '../services/token-exchange/redis-token-storage.js';
import { BackendTokenManager } from '../services/token-exchange/backend-token-manager.js';
import { TokenCleanupService } from '../services/token-exchange/token-cleanup-service.js';
import { TokenMonitoringService } from '../services/token-exchange/token-monitoring-service.js';
import { TokenManagementService } from '../services/token-exchange/token-management-service.js';
import { EncryptionUtils } from '../utils/encryption-utils.js';
import { 
  BackendTokenRecord, 
  TokenStorageMetadata,
  TokenLifecycleState
} from '../types/backend-tokens.js';

const baseLogger = createLogger('auth-server:token-management-test', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'token-management-test', 'TokenManagementTest', 'auth-server');

// =============================================================================
// TEST CONFIGURATION
// =============================================================================

const TEST_CONFIG = {
  testOrganizationId: 'test-org-123',
  testTokenKey: 'test-token-key-456',
  testBackendToken: 'test-backend-token-789',
  testRefreshToken: 'test-refresh-token-101112'
};

// =============================================================================
// MOCK DATA
// =============================================================================

const mockBackendTokenRecord: BackendTokenRecord = {
  access_token: TEST_CONFIG.testBackendToken,
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'openid profile email',
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

// =============================================================================
// TEST SUITE
// =============================================================================

describe('Token Management System', () => {
  let redisTokenStorage: RedisTokenStorage;
  let backendTokenManager: BackendTokenManager;
  let cleanupService: TokenCleanupService;
  let monitoringService: TokenMonitoringService;
  let tokenManagementService: TokenManagementService;
  let encryptionUtils: EncryptionUtils;

  beforeAll(async () => {
    log.info({ functionName: 'beforeAll' }, 'auth-server:token-management-test - Setting up test environment');
    
    // Initialize encryption utils
    encryptionUtils = new EncryptionUtils();
    
    // Mock Redis client
    const mockRedis = {
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(mockBackendTokenRecord),
      del: jest.fn().mockResolvedValue(1),
      keys: jest.fn().mockResolvedValue([TEST_CONFIG.testTokenKey]),
      ping: jest.fn().mockResolvedValue('PONG'),
      eval: jest.fn().mockResolvedValue(1)
    };

    // Initialize services
    redisTokenStorage = new RedisTokenStorage(mockRedis as any, encryptionUtils);
    backendTokenManager = new BackendTokenManager(redisTokenStorage, {} as any);
    cleanupService = new TokenCleanupService(redisTokenStorage, backendTokenManager);
    monitoringService = new TokenMonitoringService(redisTokenStorage, backendTokenManager);
    tokenManagementService = new TokenManagementService(
      redisTokenStorage,
      backendTokenManager,
      cleanupService,
      monitoringService
    );
  });

  afterAll(async () => {
    log.info({ functionName: 'afterAll' }, 'auth-server:token-management-test - Cleaning up test environment');
    
    // Shutdown services
    await tokenManagementService.shutdown();
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  // =============================================================================
  // REDIS TOKEN STORAGE TESTS
  // =============================================================================

  describe('RedisTokenStorage', () => {
    describe('store', () => {
      it('should store a token successfully', async () => {
        const result = await redisTokenStorage.store(TEST_CONFIG.testTokenKey, mockBackendTokenRecord);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      it('should handle storage errors gracefully', async () => {
        const mockRedisWithError = {
          set: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
        };
        
        const storageWithError = new RedisTokenStorage(mockRedisWithError as any, encryptionUtils);
        const result = await storageWithError.store(TEST_CONFIG.testTokenKey, mockBackendTokenRecord);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('retrieve', () => {
      it('should retrieve a token successfully', async () => {
        const result = await redisTokenStorage.retrieve(TEST_CONFIG.testTokenKey);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(result.data?.access_token).toBe(TEST_CONFIG.testBackendToken);
      });

      it('should handle retrieval errors gracefully', async () => {
        const mockRedisWithError = {
          get: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
        };
        
        const storageWithError = new RedisTokenStorage(mockRedisWithError as any, encryptionUtils);
        const result = await storageWithError.retrieve(TEST_CONFIG.testTokenKey);

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('cleanupExpiredTokens', () => {
      it('should clean up expired tokens', async () => {
        const result = await redisTokenStorage.cleanupExpiredTokens();

        expect(result.success).toBe(true);
        expect(result.cleanedCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getStorageStats', () => {
      it('should get storage statistics', async () => {
        const result = await redisTokenStorage.getStorageStats();

        expect(result.success).toBe(true);
        expect(result.stats).toBeDefined();
        expect(result.stats?.totalTokens).toBeDefined();
        expect(result.stats?.activeTokens).toBeDefined();
        expect(result.stats?.expiredTokens).toBeDefined();
      });
    });

    describe('healthCheck', () => {
      it('should perform health check', async () => {
        const result = await redisTokenStorage.healthCheck();

        expect(result.success).toBe(true);
        expect(result.healthy).toBeDefined();
        expect(result.details).toBeDefined();
      });
    });
  });

  // =============================================================================
  // TOKEN CLEANUP SERVICE TESTS
  // =============================================================================

  describe('TokenCleanupService', () => {
    describe('performCleanup', () => {
      it('should perform cleanup successfully', async () => {
        const result = await cleanupService.performCleanup();

        expect(result.success).toBe(true);
        expect(result.cleanedCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getStorageStatistics', () => {
      it('should get storage statistics', async () => {
        const result = await cleanupService.getStorageStatistics();

        expect(result.success).toBe(true);
        expect(result.statistics).toBeDefined();
      });
    });

    describe('performHealthCheck', () => {
      it('should perform health check', async () => {
        const result = await cleanupService.performHealthCheck();

        expect(result.success).toBe(true);
        expect(result.healthy).toBeDefined();
      });
    });
  });

  // =============================================================================
  // TOKEN MONITORING SERVICE TESTS
  // =============================================================================

  describe('TokenMonitoringService', () => {
    describe('recordOperation', () => {
      it('should record successful operation', () => {
        monitoringService.recordOperation(true, 100);

        const metrics = monitoringService.getMetrics();
        expect(metrics.totalOperations).toBe(1);
        expect(metrics.successfulOperations).toBe(1);
        expect(metrics.failedOperations).toBe(0);
      });

      it('should record failed operation', () => {
        monitoringService.recordOperation(false, 200);

        const metrics = monitoringService.getMetrics();
        expect(metrics.totalOperations).toBe(2);
        expect(metrics.successfulOperations).toBe(1);
        expect(metrics.failedOperations).toBe(1);
      });
    });

    describe('getSuccessRate', () => {
      it('should calculate success rate correctly', () => {
        const successRate = monitoringService.getSuccessRate();
        expect(successRate).toBe(0.5); // 1 success out of 2 operations
      });
    });

    describe('getErrorRate', () => {
      it('should calculate error rate correctly', () => {
        const errorRate = monitoringService.getErrorRate();
        expect(errorRate).toBe(0.5); // 1 error out of 2 operations
      });
    });

    describe('resetMetrics', () => {
      it('should reset metrics', () => {
        monitoringService.resetMetrics();

        const metrics = monitoringService.getMetrics();
        expect(metrics.totalOperations).toBe(0);
        expect(metrics.successfulOperations).toBe(0);
        expect(metrics.failedOperations).toBe(0);
      });
    });
  });

  // =============================================================================
  // TOKEN MANAGEMENT SERVICE TESTS
  // =============================================================================

  describe('TokenManagementService', () => {
    describe('initialize', () => {
      it('should initialize successfully', async () => {
        await tokenManagementService.initialize();

        const status = tokenManagementService.getStatus();
        expect(status.initialized).toBe(true);
      });
    });

    describe('storeToken', () => {
      it('should store a token successfully', async () => {
        const result = await tokenManagementService.storeToken(
          TEST_CONFIG.testTokenKey,
          mockBackendTokenRecord
        );

        expect(result.success).toBe(true);
      });
    });

    describe('retrieveToken', () => {
      it('should retrieve a token successfully', async () => {
        const result = await tokenManagementService.retrieveToken(TEST_CONFIG.testTokenKey);

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });
    });

    describe('deleteToken', () => {
      it('should delete a token successfully', async () => {
        const result = await tokenManagementService.deleteToken(TEST_CONFIG.testTokenKey);

        expect(result.success).toBe(true);
      });
    });

    describe('getHealthStatus', () => {
      it('should get health status', async () => {
        const result = await tokenManagementService.getHealthStatus();

        expect(result.success).toBe(true);
        expect(result.healthy).toBeDefined();
        expect(result.details).toBeDefined();
      });
    });

    describe('getStatistics', () => {
      it('should get system statistics', async () => {
        const result = await tokenManagementService.getStatistics();

        expect(result.success).toBe(true);
        expect(result.statistics).toBeDefined();
      });
    });

    describe('performCleanup', () => {
      it('should perform manual cleanup', async () => {
        const result = await tokenManagementService.performCleanup();

        expect(result.success).toBe(true);
        expect(result.cleanedCount).toBeGreaterThanOrEqual(0);
      });
    });

    describe('getTokensByState', () => {
      it('should get tokens by state', async () => {
        const result = await tokenManagementService.getTokensByState('active');

        expect(result.success).toBe(true);
        expect(result.tokens).toBeDefined();
      });
    });

    describe('shutdown', () => {
      it('should shutdown successfully', async () => {
        await tokenManagementService.shutdown();

        const status = tokenManagementService.getStatus();
        expect(status.initialized).toBe(false);
      });
    });
  });

  // =============================================================================
  // INTEGRATION TESTS
  // =============================================================================

  describe('Integration Tests', () => {
    it('should handle complete token lifecycle', async () => {
      // Initialize service
      await tokenManagementService.initialize();

      // Store token
      const storeResult = await tokenManagementService.storeToken(
        TEST_CONFIG.testTokenKey,
        mockBackendTokenRecord
      );
      expect(storeResult.success).toBe(true);

      // Retrieve token
      const retrieveResult = await tokenManagementService.retrieveToken(TEST_CONFIG.testTokenKey);
      expect(retrieveResult.success).toBe(true);

      // Get statistics
      const statsResult = await tokenManagementService.getStatistics();
      expect(statsResult.success).toBe(true);

      // Perform cleanup
      const cleanupResult = await tokenManagementService.performCleanup();
      expect(cleanupResult.success).toBe(true);

      // Get health status
      const healthResult = await tokenManagementService.getHealthStatus();
      expect(healthResult.success).toBe(true);

      // Delete token
      const deleteResult = await tokenManagementService.deleteToken(TEST_CONFIG.testTokenKey);
      expect(deleteResult.success).toBe(true);

      // Shutdown service
      await tokenManagementService.shutdown();
    });

    it('should handle concurrent operations', async () => {
      await tokenManagementService.initialize();

      const operations = Array.from({ length: 10 }, (_, i) => 
        tokenManagementService.storeToken(
          `${TEST_CONFIG.testTokenKey}-${i}`,
          { ...mockBackendTokenRecord, access_token: `token-${i}` }
        )
      );

      const results = await Promise.all(operations);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      await tokenManagementService.shutdown();
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================

  describe('Error Handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const mockRedisWithError = {
        set: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        get: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        del: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        keys: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        ping: jest.fn().mockRejectedValue(new Error('Redis connection failed')),
        eval: jest.fn().mockRejectedValue(new Error('Redis connection failed'))
      };

      const storageWithError = new RedisTokenStorage(mockRedisWithError as any, encryptionUtils);
      const result = await storageWithError.store(TEST_CONFIG.testTokenKey, mockBackendTokenRecord);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle encryption errors gracefully', async () => {
      const mockEncryptionWithError = {
        encrypt: jest.fn().mockImplementation(() => {
          throw new Error('Encryption failed');
        }),
        decrypt: jest.fn().mockImplementation(() => {
          throw new Error('Decryption failed');
        })
      };

      const storageWithError = new RedisTokenStorage({} as any, mockEncryptionWithError as any);
      const result = await storageWithError.store(TEST_CONFIG.testTokenKey, mockBackendTokenRecord);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a mock Redis client for testing
 */
function createMockRedisClient(): any {
  return {
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(mockBackendTokenRecord),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([TEST_CONFIG.testTokenKey]),
    ping: jest.fn().mockResolvedValue('PONG'),
    eval: jest.fn().mockResolvedValue(1)
  };
}

/**
 * Create a mock backend service for testing
 */
function createMockBackendService(): any {
  return {
    refreshStoredUserTokens: jest.fn().mockResolvedValue({
      success: true,
      data: mockBackendTokenRecord
    })
  };
}

export default {
  TEST_CONFIG,
  mockBackendTokenRecord,
  createMockRedisClient,
  createMockBackendService
};
