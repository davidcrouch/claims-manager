/**
 * =============================================================================
 * REDIS TOKEN STORAGE SERVICE
 * =============================================================================
 * 
 * This module provides Redis-based token storage for the auth server token exchange system.
 * It handles encrypted storage, retrieval, and lifecycle management of backend tokens.
 * 
 * Key Features:
 * - Encrypted token storage in Redis
 * - Token retrieval and updates
 * - Expiration management
 * - Atomic operations
 * - Distributed locking
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { Redis } from '@upstash/redis';
import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { EncryptionUtils, EncryptedData } from '../../utils/encryption-utils.js';
import { 
  BackendTokenRecord, 
  TokenStorageKey, 
  TokenStorageOptions, 
  TokenStorageResult,
  BackendTokenMetadata as TokenStorageMetadata,
  TokenLifecycleState
} from '../../types/backend-tokens.js';
import { 
  RedisStorageResult, 
  RedisStorageOperation,
  DistributedLock,
  DistributedLockResult
} from '../../types/redis-storage.js';

const baseLogger = createLogger('auth-server:redis-token-storage', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'redis-token-storage', 'RedisTokenStorage', 'auth-server');

// =============================================================================
// REDIS TOKEN STORAGE CLASS
// =============================================================================

/**
 * Redis-based token storage service
 * Uses the existing Upstash Redis connection from the auth-server
 */
export class RedisTokenStorage {
  private redis: Redis;
  private encryptionUtils: EncryptionUtils;
  private keyPrefix: string = 'auth:token';

  constructor(redis: Redis, encryptionUtils: EncryptionUtils) {
    this.redis = redis;
    this.encryptionUtils = encryptionUtils;
    
    log.info({
      keyPrefix: this.keyPrefix,
      encryptionEnabled: true,
      redisType: 'upstash'
    }, 'RedisTokenStorage initialized with existing Upstash connection');
  }

  /**
   * Generate storage key for a token
   */
  private generateStorageKey(organizationId: string, resource: string, components?: string[]): string {
    const keyParts = [this.keyPrefix, organizationId, resource];
    
    if (components && components.length > 0) {
      keyParts.push(...components);
    }
    
    return keyParts.join(':');
  }

  /**
   * Generate lock key for distributed locking
   */
  private generateLockKey(organizationId: string, resource: string): string {
    return `lock:${this.keyPrefix}:${organizationId}:${resource}`;
  }

  /**
   * Store a backend token in Redis
   */
  public async storeToken(
    tokenRecord: BackendTokenRecord,
    options: TokenStorageOptions = {}
  ): Promise<TokenStorageResult> {
    const startTime = Date.now();
    
    try {
      const key = this.generateStorageKey(tokenRecord.organization_id, tokenRecord.resource);
      
      log.debug({
        key,
        organizationId: tokenRecord.organization_id,
        resource: tokenRecord.resource,
        encrypt: options.encrypt !== false
      }, 'Storing backend token');

      let dataToStore: any = tokenRecord;
      
      // Encrypt the token if encryption is enabled
      if (options.encrypt !== false) {
        const encryptedData = await this.encryptionUtils.encryptObject(tokenRecord);
        dataToStore = encryptedData;
      }

      // Set TTL if provided
      const ttl = options.ttl || 3600; // Default 1 hour
      
      if (options.atomic) {
        // Use atomic operation
        await this.redis.set(key, dataToStore, { ex: ttl });
      } else {
        // Use regular set operation
        await this.redis.set(key, dataToStore, { ex: ttl });
      }

      // Store metadata
      const metadata: TokenStorageMetadata = {
        version: '1.0',
        source: 'exchange'
      };

      const metadataKey = `${key}:metadata`;
      await this.redis.set(metadataKey, metadata, { ex: ttl });

      const duration = Date.now() - startTime;
      
      log.info({
        key,
        organizationId: tokenRecord.organization_id,
        resource: tokenRecord.resource,
        duration_ms: duration,
        encrypted: options.encrypt !== false,
        ttl_seconds: ttl
      }, 'Backend token stored successfully');

      return {
        success: true,
        token_record: tokenRecord,
        metadata: {
          duration_ms: duration,
          storage_key: key,
          encrypted: options.encrypt !== false
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        organizationId: tokenRecord.organization_id,
        resource: tokenRecord.resource,
        duration_ms: duration
      }, 'Failed to store backend token');

      return {
        success: false,
        error: error.message,
        metadata: {
          duration_ms: duration,
          storage_key: this.generateStorageKey(tokenRecord.organization_id, tokenRecord.resource),
          encrypted: options.encrypt !== false
        }
      };
    }
  }

  /**
   * Retrieve a backend token from Redis
   */
  public async getToken(
    organizationId: string,
    resource: string,
    options: TokenStorageOptions = {}
  ): Promise<TokenStorageResult> {
    const startTime = Date.now();
    
    try {
      const key = this.generateStorageKey(organizationId, resource);
      
      log.debug({
        key,
        organizationId,
        resource
      }, 'Retrieving backend token');

      const storedData = await this.redis.get(key);
      
      if (!storedData) {
        log.debug({
          key,
          organizationId,
          resource
        }, 'Backend token not found');

        return {
          success: false,
          error: 'Token not found',
          metadata: {
            duration_ms: Date.now() - startTime,
            storage_key: key,
            encrypted: false
          }
        };
      }

      let tokenRecord: BackendTokenRecord;
      
      // Check if data is encrypted
      if (this.isEncryptedData(storedData)) {
        tokenRecord = await this.encryptionUtils.decryptObject<BackendTokenRecord>(storedData as any);
      } else {
        tokenRecord = storedData as BackendTokenRecord;
      }

      // Update access metadata
      await this.updateAccessMetadata(key);

      const duration = Date.now() - startTime;
      
      log.info({
        key,
        organizationId,
        resource,
        duration_ms: duration,
        encrypted: this.isEncryptedData(storedData)
      }, 'Backend token retrieved successfully');

      return {
        success: true,
        token_record: tokenRecord,
        metadata: {
          duration_ms: duration,
          storage_key: key,
          encrypted: this.isEncryptedData(storedData)
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        organizationId,
        resource,
        duration_ms: duration
      }, 'Failed to retrieve backend token');

      return {
        success: false,
        error: error.message,
        metadata: {
          duration_ms: duration,
          storage_key: this.generateStorageKey(organizationId, resource),
          encrypted: false
        }
      };
    }
  }

  /**
   * Update a backend token in Redis
   */
  public async updateToken(
    organizationId: string,
    resource: string,
    updates: Partial<BackendTokenRecord>,
    options: TokenStorageOptions = {}
  ): Promise<TokenStorageResult> {
    const startTime = Date.now();
    
    try {
      // First, get the existing token
      const getResult = await this.getToken(organizationId, resource, options);
      
      if (!getResult.success || !getResult.token_record) {
        return {
          success: false,
          error: 'Token not found for update',
          metadata: {
            duration_ms: Date.now() - startTime,
            storage_key: this.generateStorageKey(organizationId, resource),
            encrypted: false
          }
        };
      }

      // Merge updates with existing token
      const updatedToken: BackendTokenRecord = {
        ...getResult.token_record,
        ...updates,
        organization_id: organizationId,
        resource: resource
      };

      // Store the updated token
      return await this.storeToken(updatedToken, options);
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        organizationId,
        resource,
        duration_ms: duration
      }, 'Failed to update backend token');

      return {
        success: false,
        error: error.message,
        metadata: {
          duration_ms: duration,
          storage_key: this.generateStorageKey(organizationId, resource),
          encrypted: false
        }
      };
    }
  }

  /**
   * Delete a backend token from Redis
   */
  public async deleteToken(
    organizationId: string,
    resource: string
  ): Promise<TokenStorageResult> {
    const startTime = Date.now();
    
    try {
      const key = this.generateStorageKey(organizationId, resource);
      const metadataKey = `${key}:metadata`;
      
      log.debug({
        key,
        organizationId,
        resource
      }, 'Deleting backend token');

      // Delete both token and metadata
      await Promise.all([
        this.redis.del(key),
        this.redis.del(metadataKey)
      ]);

      const duration = Date.now() - startTime;
      
      log.info({
        key,
        organizationId,
        resource,
        duration_ms: duration
      }, 'Backend token deleted successfully');

      return {
        success: true,
        metadata: {
          duration_ms: duration,
          storage_key: key,
          encrypted: false
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        organizationId,
        resource,
        duration_ms: duration
      }, 'Failed to delete backend token');

      return {
        success: false,
        error: error.message,
        metadata: {
          duration_ms: duration,
          storage_key: this.generateStorageKey(organizationId, resource),
          encrypted: false
        }
      };
    }
  }

  /**
   * Check if a token exists in Redis
   */
  public async tokenExists(
    organizationId: string,
    resource: string
  ): Promise<boolean> {
    try {
      const key = this.generateStorageKey(organizationId, resource);
      const exists = await this.redis.exists(key);
      
      log.debug({
        key,
        organizationId,
        resource,
        exists: !!exists
      }, 'Checked token existence');

      return !!exists;
    } catch (error) {
      log.error({
        error: error.message,
        organizationId,
        resource
      }, 'Failed to check token existence');
      
      return false;
    }
  }

  /**
   * Get token TTL
   */
  public async getTokenTTL(
    organizationId: string,
    resource: string
  ): Promise<number> {
    try {
      const key = this.generateStorageKey(organizationId, resource);
      const ttl = await this.redis.ttl(key);
      
      log.debug({
        key,
        organizationId,
        resource,
        ttl_seconds: ttl
      }, 'Retrieved token TTL');

      return ttl;
    } catch (error) {
      log.error({
        error: error.message,
        organizationId,
        resource
      }, 'Failed to get token TTL');
      
      return -1;
    }
  }

  /**
   * Set token TTL
   */
  public async setTokenTTL(
    organizationId: string,
    resource: string,
    ttlSeconds: number
  ): Promise<boolean> {
    try {
      const key = this.generateStorageKey(organizationId, resource);
      const result = await this.redis.expire(key, ttlSeconds);
      
      log.debug({
        key,
        organizationId,
        resource,
        ttl_seconds: ttlSeconds,
        success: result
      }, 'Set token TTL');

      return result === 1;
    } catch (error) {
      log.error({
        error: error.message,
        organizationId,
        resource,
        ttl_seconds: ttlSeconds
      }, 'Failed to set token TTL');
      
      return false;
    }
  }

  /**
   * Acquire a distributed lock for token operations
   */
  public async acquireLock(
    organizationId: string,
    resource: string,
    timeoutMs: number = 5000
  ): Promise<DistributedLockResult> {
    const startTime = Date.now();
    
    try {
      const lockKey = this.generateLockKey(organizationId, resource);
      const lockValue = this.encryptionUtils.generateToken(32);
      const lockTimeout = Math.ceil(timeoutMs / 1000); // Convert to seconds
      
      log.debug({
        lockKey,
        organizationId,
        resource,
        timeout_ms: timeoutMs
      }, 'Acquiring distributed lock');

      // Try to acquire the lock
      const acquired = await this.redis.set(lockKey, lockValue, { 
        ex: lockTimeout, 
        nx: true 
      });

      if (acquired) {
        const lock: DistributedLock = {
          key: lockKey,
          value: lockValue,
          timeout_ms: timeoutMs,
          created_at: Date.now(),
          expires_at: Date.now() + timeoutMs,
          active: true,
          metadata: {
            owner: 'token-exchange-service',
            purpose: 'token-operation',
            priority: 1,
            retry_count: 0
          }
        };

        const duration = Date.now() - startTime;
        
        log.info({
          lockKey,
          organizationId,
          resource,
          duration_ms: duration
        }, 'Distributed lock acquired successfully');

        return {
          acquired: true,
          lock,
          duration_ms: duration,
          metadata: {
            key: lockKey,
            value: lockValue,
            timeout_ms: timeoutMs,
            retry_attempts: 0
          }
        };
      } else {
        const duration = Date.now() - startTime;
        
        log.debug({
          lockKey,
          organizationId,
          resource,
          duration_ms: duration
        }, 'Failed to acquire distributed lock - already locked');

        return {
          acquired: false,
          duration_ms: duration,
          metadata: {
            key: lockKey,
            value: lockValue,
            timeout_ms: timeoutMs,
            retry_attempts: 0
          }
        };
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        organizationId,
        resource,
        timeout_ms: timeoutMs,
        duration_ms: duration
      }, 'Failed to acquire distributed lock');

      return {
        acquired: false,
        error: error.message,
        duration_ms: duration,
        metadata: {
          key: this.generateLockKey(organizationId, resource),
          value: '',
          timeout_ms: timeoutMs,
          retry_attempts: 0
        }
      };
    }
  }

  /**
   * Release a distributed lock
   */
  public async releaseLock(lock: DistributedLock): Promise<boolean> {
    try {
      log.debug({
        lockKey: lock.key,
        lockValue: lock.value
      }, 'Releasing distributed lock');

      // Use Lua script to ensure atomic release
      const script = `
        if redis.call("GET", KEYS[1]) == ARGV[1] then
          return redis.call("DEL", KEYS[1])
        else
          return 0
        end
      `;

      const result = await this.redis.eval(script, [lock.key], [lock.value]);
      
      log.info({
        lockKey: lock.key,
        success: result === 1
      }, 'Distributed lock released');

      return result === 1;
    } catch (error) {
      log.error({
        error: error.message,
        lockKey: lock.key
      }, 'Failed to release distributed lock');
      
      return false;
    }
  }

  /**
   * Clean up expired tokens
   */
  public async cleanupExpiredTokens(): Promise<number> {
    const startTime = Date.now();
    
    try {
      log.debug({}, 'Starting expired token cleanup');

      // Get all token keys
      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);
      
      let cleanedCount = 0;
      const now = Date.now();

      for (const key of keys) {
        try {
          // Skip metadata keys
          if (key.endsWith(':metadata')) {
            continue;
          }

          // Get token data
          const tokenData = await this.redis.get(key);
          if (!tokenData) {
            continue;
          }

          let tokenRecord: BackendTokenRecord;
          
          // Decrypt if necessary
          if (this.isEncryptedData(tokenData)) {
            tokenRecord = await this.encryptionUtils.decryptObject<BackendTokenRecord>(tokenData as any);
          } else {
            tokenRecord = tokenData as BackendTokenRecord;
          }

          // Check if token is expired
          if (tokenRecord.expires_at < now) {
            const metadataKey = `${key}:metadata`;
            
            // Delete both token and metadata
            await Promise.all([
              this.redis.del(key),
              this.redis.del(metadataKey)
            ]);
            
            cleanedCount++;
            
            log.debug({
              key,
              organizationId: tokenRecord.organization_id,
              resource: tokenRecord.resource,
              expired_at: tokenRecord.expires_at
            }, 'Cleaned up expired token');
          }
        } catch (error) {
          log.warn({
            error: error.message,
            key
          }, 'Failed to process token during cleanup');
        }
      }

      const duration = Date.now() - startTime;
      
      log.info({
        cleaned_count: cleanedCount,
        total_keys_checked: keys.length,
        duration_ms: duration
      }, 'Expired token cleanup completed');

      return cleanedCount;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      log.error({
        error: error.message,
        duration_ms: duration
      }, 'Failed to cleanup expired tokens');
      
      return 0;
    }
  }

  /**
   * Check if data is encrypted
   */
  private isEncryptedData(data: any): boolean {
    return data && 
           typeof data === 'object' && 
           'encryptedData' in data && 
           'iv' in data && 
           'algorithm' in data;
  }

  /**
   * Update access metadata for a token
   */
  private async updateAccessMetadata(key: string): Promise<void> {
    try {
      const metadataKey = `${key}:metadata`;
      const metadata = await this.redis.get<TokenStorageMetadata>(metadataKey);
      
      if (metadata) {
        (metadata as any).access_count = ((metadata as any).access_count || 0) + 1;
        (metadata as any).last_accessed_at = Date.now();
        
        await this.redis.set(metadataKey, metadata, { ex: 3600 }); // 1 hour TTL
      }
    } catch (error) {
      log.warn({
        error: error.message,
        key
      }, 'Failed to update access metadata');
    }
  }

  // =============================================================================
  // TOKEN LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Get token storage statistics
   */
  public async getStorageStats(): Promise<{
    success: boolean;
    stats?: {
      totalTokens: number;
      expiredTokens: number;
      activeTokens: number;
      averageTokenAge: number;
      oldestToken: number;
      newestToken: number;
    };
    error?: string;
  }> {
    try {
      log.debug({}, 'auth-server:redis-token-storage:getStorageStats - Getting storage statistics');

      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);
      
      const now = Date.now();
      let expiredTokens = 0;
      let activeTokens = 0;
      let totalAge = 0;
      let oldestToken = now;
      let newestToken = 0;

      for (const key of keys) {
        try {
          const tokenData = await this.redis.get(key);
          if (tokenData && typeof tokenData === 'object') {
            const tokenRecord = tokenData as any;
            const expiresAt = tokenRecord.metadata?.expires_at || tokenRecord.expires_at;
            const createdAt = tokenRecord.metadata?.created_at || tokenRecord.created_at || 0;
            
            if (expiresAt && expiresAt < now) {
              expiredTokens++;
            } else {
              activeTokens++;
            }

            if (createdAt > 0) {
              const age = now - createdAt;
              totalAge += age;
              
              if (createdAt < oldestToken) {
                oldestToken = createdAt;
              }
              if (createdAt > newestToken) {
                newestToken = createdAt;
              }
            }
          }
        } catch (keyError) {
          log.warn({
            error: keyError.message,
            key
          }, 'auth-server:redis-token-storage:getStorageStats - Failed to process key');
        }
      }

      const averageTokenAge = activeTokens > 0 ? totalAge / activeTokens : 0;

      const stats = {
        totalTokens: keys.length,
        expiredTokens,
        activeTokens,
        averageTokenAge: Math.round(averageTokenAge),
        oldestToken: oldestToken === now ? 0 : oldestToken,
        newestToken
      };

      log.info({
        stats
      }, 'auth-server:redis-token-storage:getStorageStats - Storage statistics retrieved');

      return {
        success: true,
        stats
      };
    } catch (error) {
      log.error({
        error: error.message
      }, 'auth-server:redis-token-storage:getStorageStats - Failed to get storage statistics');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Refresh token metadata and update lifecycle state
   */
  public async refreshTokenMetadata(
    key: string, 
    updates: Partial<TokenStorageMetadata>
  ): Promise<TokenStorageResult> {
    try {
      log.debug({
        key,
        updates
      }, 'auth-server:redis-token-storage:refreshTokenMetadata - Refreshing token metadata');

      const existingData = await this.redis.get(key);
      if (!existingData) {
        return {
          success: false,
          error: 'Token not found'
        };
      }

      const tokenRecord = existingData as any;
      const updatedMetadata = {
        ...tokenRecord.metadata,
        ...updates,
        last_updated: Date.now()
      };

      const updatedRecord = {
        ...tokenRecord,
        metadata: updatedMetadata
      };

      await this.redis.set(key, updatedRecord);

      log.info({
        key,
        metadata: updatedMetadata
      }, 'auth-server:redis-token-storage:refreshTokenMetadata - Token metadata refreshed successfully');

      return {
        success: true,
        token_record: updatedRecord
      };
    } catch (error) {
      log.error({
        error: error.message,
        key,
        updates
      }, 'auth-server:redis-token-storage:refreshTokenMetadata - Failed to refresh token metadata');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get tokens by lifecycle state
   */
  public async getTokensByState(state: TokenLifecycleState): Promise<{
    success: boolean;
    tokens?: string[];
    error?: string;
  }> {
    try {
      log.debug({
        state
      }, 'auth-server:redis-token-storage:getTokensByState - Getting tokens by state');

      const pattern = `${this.keyPrefix}:*`;
      const keys = await this.redis.keys(pattern);
      
      const matchingTokens: string[] = [];
      const now = Date.now();

      for (const key of keys) {
        try {
          const tokenData = await this.redis.get(key);
          if (tokenData && typeof tokenData === 'object') {
            const tokenRecord = tokenData as any;
            const expiresAt = tokenRecord.metadata?.expires_at || tokenRecord.expires_at;
            const isExpired = expiresAt && expiresAt < now;
            
            let matchesState = false;
            
            if (state === 'all' as any) {
              matchesState = true;
            } else {
              switch (state) {
                case 'active':
                  matchesState = !isExpired;
                  break;
                case 'expired':
                  matchesState = isExpired;
                  break;
                default:
                  matchesState = false;
                  break;
              }
            }

            if (matchesState) {
              matchingTokens.push(key);
            }
          }
        } catch (keyError) {
          log.warn({
            error: keyError.message,
            key
          }, 'auth-server:redis-token-storage:getTokensByState - Failed to process key');
        }
      }

      log.info({
        state,
        count: matchingTokens.length
      }, 'auth-server:redis-token-storage:getTokensByState - Tokens retrieved by state');

      return {
        success: true,
        tokens: matchingTokens
      };
    } catch (error) {
      log.error({
        error: error.message,
        state
      }, 'auth-server:redis-token-storage:getTokensByState - Failed to get tokens by state');

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Health check for Redis token storage
   */
  public async healthCheck(): Promise<{
    success: boolean;
    healthy: boolean;
    details?: {
      redisConnected: boolean;
      encryptionWorking: boolean;
      storageWritable: boolean;
      lastError?: string;
    };
    error?: string;
  }> {
    try {
      log.debug({}, 'auth-server:redis-token-storage:healthCheck - Performing health check');

      const details = {
        redisConnected: false,
        encryptionWorking: false,
        storageWritable: false,
        lastError: undefined as string | undefined
      };

      // Test Redis connection
      try {
        await this.redis.ping();
        details.redisConnected = true;
      } catch (redisError) {
        details.lastError = `Redis connection failed: ${redisError.message}`;
        log.warn({
          error: redisError.message
        }, 'auth-server:redis-token-storage:healthCheck - Redis connection failed');
      }

      // Test encryption
      try {
        const testData = { test: 'data' };
        const encrypted = await this.encryptionUtils.encrypt(JSON.stringify(testData));
        const decrypted = JSON.parse(await this.encryptionUtils.decrypt(encrypted));
        
        if (decrypted.test === 'data') {
          details.encryptionWorking = true;
        }
      } catch (encryptionError) {
        details.lastError = `Encryption test failed: ${encryptionError.message}`;
        log.warn({
          error: encryptionError.message
        }, 'auth-server:redis-token-storage:healthCheck - Encryption test failed');
      }

      // Test storage write/read
      try {
        const testKey = `${this.keyPrefix}:health-check:${Date.now()}`;
        const testData = { healthCheck: true, timestamp: Date.now() };
        
        await this.redis.set(testKey, testData, { ex: 10 }); // 10 second TTL
        const retrieved = await this.redis.get(testKey);
        await this.redis.del(testKey);
        
        if (retrieved && (retrieved as any).healthCheck === true) {
          details.storageWritable = true;
        }
      } catch (storageError) {
        details.lastError = `Storage test failed: ${storageError.message}`;
        log.warn({
          error: storageError.message
        }, 'auth-server:redis-token-storage:healthCheck - Storage test failed');
      }

      const healthy = details.redisConnected && details.encryptionWorking && details.storageWritable;

      log.info({
        healthy,
        details
      }, 'auth-server:redis-token-storage:healthCheck - Health check completed');

      return {
        success: true,
        healthy,
        details
      };
    } catch (error) {
      log.error({
        error: error.message
      }, 'auth-server:redis-token-storage:healthCheck - Health check failed');

      return {
        success: false,
        healthy: false,
        error: error.message
      };
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a new Redis token storage instance
 */
export function createRedisTokenStorage(
  redis: Redis,
  encryptionUtils: EncryptionUtils
): RedisTokenStorage {
  return new RedisTokenStorage(redis, encryptionUtils);
}

export default RedisTokenStorage;
