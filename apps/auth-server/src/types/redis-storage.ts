/**
 * =============================================================================
 * REDIS STORAGE TYPES
 * =============================================================================
 * 
 * This module defines TypeScript interfaces and types for Redis storage operations
 * in the auth server token exchange system.
 * 
 * Key Features:
 * - Redis connection management
 * - Token storage operations
 * - Rate limiting storage
 * - Distributed locking
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

// =============================================================================
// REDIS CONNECTION TYPES
// =============================================================================

/**
 * Redis Configuration
 * 
 * This interface defines the configuration for Redis connections.
 */
export interface RedisConfig {
  /** Redis host */
  host: string;
  
  /** Redis port */
  port: number;
  
  /** Redis password */
  password?: string;
  
  /** Redis database number */
  db: number;
  
  /** Retry delay on failover in milliseconds */
  retryDelayOnFailover: number;
  
  /** Maximum retries per request */
  maxRetriesPerRequest: number;
  
  /** Whether to connect lazily */
  lazyConnect: boolean;
  
  /** Connection timeout in milliseconds */
  connectTimeout: number;
  
  /** Command timeout in milliseconds */
  commandTimeout: number;
  
  /** Whether to enable offline queue */
  enableOfflineQueue: boolean;
  
  /** Maximum offline queue size */
  maxOfflineQueueSize: number;
  
  /** Additional Redis options */
  options?: Record<string, any>;
}

/**
 * Redis Connection Status
 * 
 * This enum defines the possible states of a Redis connection.
 */
export enum RedisConnectionStatus {
  /** Connection is not established */
  DISCONNECTED = 'disconnected',
  
  /** Connection is being established */
  CONNECTING = 'connecting',
  
  /** Connection is established and ready */
  CONNECTED = 'connected',
  
  /** Connection is being closed */
  CLOSING = 'closing',
  
  /** Connection is closed */
  CLOSED = 'closed',
  
  /** Connection is in error state */
  ERROR = 'error'
}

/**
 * Redis Connection Health
 * 
 * This interface defines the health status of a Redis connection.
 */
export interface RedisConnectionHealth {
  /** Connection status */
  status: RedisConnectionStatus;
  
  /** Whether the connection is healthy */
  healthy: boolean;
  
  /** Last ping response time in milliseconds */
  ping_time_ms?: number;
  
  /** Last error message */
  last_error?: string;
  
  /** Connection uptime in milliseconds */
  uptime_ms: number;
  
  /** Number of reconnections */
  reconnection_count: number;
  
  /** Health check timestamp */
  timestamp: number;
}

// =============================================================================
// REDIS STORAGE OPERATIONS
// =============================================================================

/**
 * Redis Storage Operation
 * 
 * This enum defines the types of Redis storage operations.
 */
export enum RedisStorageOperation {
  /** Set a key-value pair */
  SET = 'set',
  
  /** Get a value by key */
  GET = 'get',
  
  /** Delete a key */
  DEL = 'del',
  
  /** Check if a key exists */
  EXISTS = 'exists',
  
  /** Set key expiration */
  EXPIRE = 'expire',
  
  /** Get key TTL */
  TTL = 'ttl',
  
  /** Increment a counter */
  INCR = 'incr',
  
  /** Decrement a counter */
  DECR = 'decr',
  
  /** Add to a set */
  SADD = 'sadd',
  
  /** Remove from a set */
  SREM = 'srem',
  
  /** Get set members */
  SMEMBERS = 'smembers',
  
  /** Set hash field */
  HSET = 'hset',
  
  /** Get hash field */
  HGET = 'hget',
  
  /** Get all hash fields */
  HGETALL = 'hgetall',
  
  /** Delete hash field */
  HDEL = 'hdel'
}

/**
 * Redis Storage Result
 * 
 * This interface defines the result of Redis storage operations.
 */
export interface RedisStorageResult<T = any> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Operation result data */
  data?: T;
  
  /** Error message */
  error?: string;
  
  /** Operation duration in milliseconds */
  duration_ms: number;
  
  /** Redis key used */
  key: string;
  
  /** Operation type */
  operation: RedisStorageOperation;
  
  /** Additional metadata */
  metadata?: {
    /** Redis server response time */
    redis_response_time_ms: number;
    /** Data size in bytes */
    data_size_bytes: number;
    /** Whether data was compressed */
    compressed: boolean;
    /** Whether data was encrypted */
    encrypted: boolean;
  };
}

// =============================================================================
// TOKEN STORAGE TYPES
// =============================================================================

/**
 * Token Storage Key
 * 
 * This interface defines the structure for Redis storage keys
 * used in token operations.
 */
export interface TokenStorageKey {
  /** Key prefix */
  prefix: 'backend_token' | 'token_exchange' | 'rate_limit' | 'lock' | 'cleanup';
  
  /** Organization ID */
  organization_id: string;
  
  /** Resource identifier */
  resource?: string;
  
  /** Additional key components */
  components?: string[];
  
  /** Key separator */
  separator?: string;
}

/**
 * Token Storage Options
 * 
 * This interface defines options for token storage operations.
 */
export interface TokenStorageOptions {
  /** Time to live in seconds */
  ttl?: number;
  
  /** Whether to encrypt the data */
  encrypt?: boolean;
  
  /** Whether to use atomic operations */
  atomic?: boolean;
  
  /** Whether to create if not exists */
  create_if_not_exists?: boolean;
  
  /** Whether to update if exists */
  update_if_exists?: boolean;
  
  /** Whether to compress the data */
  compress?: boolean;
  
  /** Compression level (1-9) */
  compression_level?: number;
  
  /** Additional storage options */
  [key: string]: any;
}

/**
 * Token Storage Metadata
 * 
 * This interface defines metadata for stored tokens.
 */
export interface TokenStorageMetadata {
  /** Storage timestamp */
  stored_at: number;
  
  /** Storage version */
  version: string;
  
  /** Data size in bytes */
  size_bytes: number;
  
  /** Whether data is encrypted */
  encrypted: boolean;
  
  /** Whether data is compressed */
  compressed: boolean;
  
  /** Encryption algorithm (if encrypted) */
  encryption_algorithm?: string;
  
  /** Compression algorithm (if compressed) */
  compression_algorithm?: string;
  
  /** TTL in seconds */
  ttl_seconds?: number;
  
  /** Access count */
  access_count: number;
  
  /** Last accessed timestamp */
  last_accessed_at: number;
}

// =============================================================================
// RATE LIMITING TYPES
// =============================================================================

/**
 * Rate Limit Configuration
 * 
 * This interface defines the configuration for rate limiting.
 */
export interface RateLimitConfig {
  /** Rate limit window in milliseconds */
  window_ms: number;
  
  /** Maximum requests per window */
  max_requests: number;
  
  /** Burst limit */
  burst_limit: number;
  
  /** Whether to skip successful requests */
  skip_successful_requests: boolean;
  
  /** Whether to skip failed requests */
  skip_failed_requests: boolean;
  
  /** Rate limit key generator function */
  key_generator?: (req: any) => string;
  
  /** Rate limit message */
  message?: string;
  
  /** Rate limit headers */
  headers?: boolean;
}

/**
 * Rate Limit Result
 * 
 * This interface defines the result of rate limit checks.
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  
  /** Current request count */
  current_count: number;
  
  /** Maximum allowed requests */
  max_requests: number;
  
  /** Time until reset in milliseconds */
  reset_time_ms: number;
  
  /** Rate limit headers */
  headers?: {
    /** X-RateLimit-Limit */
    'X-RateLimit-Limit': string;
    /** X-RateLimit-Remaining */
    'X-RateLimit-Remaining': string;
    /** X-RateLimit-Reset */
    'X-RateLimit-Reset': string;
  };
  
  /** Rate limit metadata */
  metadata?: {
    /** Rate limit key */
    key: string;
    /** Window start time */
    window_start: number;
    /** Window end time */
    window_end: number;
    /** Check duration in milliseconds */
    check_duration_ms: number;
  };
}

// =============================================================================
// DISTRIBUTED LOCKING TYPES
// =============================================================================

/**
 * Distributed Lock Configuration
 * 
 * This interface defines the configuration for distributed locks.
 */
export interface DistributedLockConfig {
  /** Lock timeout in milliseconds */
  timeout_ms: number;
  
  /** Lock retry interval in milliseconds */
  retry_interval_ms: number;
  
  /** Maximum retry attempts */
  max_retries: number;
  
  /** Lock key prefix */
  key_prefix: string;
  
  /** Whether to auto-extend the lock */
  auto_extend: boolean;
  
  /** Lock extension interval in milliseconds */
  extension_interval_ms: number;
  
  /** Maximum lock extension time in milliseconds */
  max_extension_ms: number;
}

/**
 * Distributed Lock
 * 
 * This interface defines a distributed lock instance.
 */
export interface DistributedLock {
  /** Lock key */
  key: string;
  
  /** Lock value */
  value: string;
  
  /** Lock timeout in milliseconds */
  timeout_ms: number;
  
  /** Lock creation timestamp */
  created_at: number;
  
  /** Lock expiration timestamp */
  expires_at: number;
  
  /** Whether the lock is active */
  active: boolean;
  
  /** Lock metadata */
  metadata?: {
    /** Lock owner */
    owner: string;
    /** Lock purpose */
    purpose: string;
    /** Lock priority */
    priority: number;
    /** Lock retry count */
    retry_count: number;
  };
}

/**
 * Distributed Lock Result
 * 
 * This interface defines the result of distributed lock operations.
 */
export interface DistributedLockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  
  /** Lock instance (if acquired) */
  lock?: DistributedLock;
  
  /** Error message */
  error?: string;
  
  /** Lock operation duration in milliseconds */
  duration_ms: number;
  
  /** Lock metadata */
  metadata?: {
    /** Lock key */
    key: string;
    /** Lock value */
    value: string;
    /** Lock timeout */
    timeout_ms: number;
    /** Retry attempts */
    retry_attempts: number;
  };
}

// =============================================================================
// REDIS CLUSTER TYPES
// =============================================================================

/**
 * Redis Cluster Configuration
 * 
 * This interface defines the configuration for Redis clusters.
 */
export interface RedisClusterConfig {
  /** Cluster nodes */
  nodes: Array<{
    host: string;
    port: number;
  }>;
  
  /** Cluster options */
  options: {
    /** Redis cluster options */
    redisOptions: RedisConfig;
    
    /** Cluster retry delay in milliseconds */
    retryDelayOnFailover: number;
    
    /** Maximum retries per request */
    maxRedirections: number;
    
    /** Cluster retry delay in milliseconds */
    retryDelayOnClusterDown: number;
    
    /** Whether to enable offline queue */
    enableOfflineQueue: boolean;
    
    /** Maximum offline queue size */
    maxOfflineQueueSize: number;
  };
}

/**
 * Redis Cluster Health
 * 
 * This interface defines the health status of a Redis cluster.
 */
export interface RedisClusterHealth {
  /** Overall cluster health */
  healthy: boolean;
  
  /** Cluster status */
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  /** Node health status */
  nodes: Array<{
    host: string;
    port: number;
    status: RedisConnectionStatus;
    healthy: boolean;
    ping_time_ms?: number;
  }>;
  
  /** Cluster metrics */
  metrics: {
    /** Total nodes */
    total_nodes: number;
    /** Healthy nodes */
    healthy_nodes: number;
    /** Unhealthy nodes */
    unhealthy_nodes: number;
    /** Average ping time */
    average_ping_time_ms: number;
  };
  
  /** Health check timestamp */
  timestamp: number;
}

// =============================================================================
// REDIS MONITORING TYPES
// =============================================================================

/**
 * Redis Metrics
 * 
 * This interface defines metrics for Redis operations.
 */
export interface RedisMetrics {
  /** Total operations performed */
  total_operations: number;
  
  /** Successful operations */
  successful_operations: number;
  
  /** Failed operations */
  failed_operations: number;
  
  /** Average operation time in milliseconds */
  average_operation_time_ms: number;
  
  /** Total data stored in bytes */
  total_data_stored_bytes: number;
  
  /** Total keys stored */
  total_keys_stored: number;
  
  /** Memory usage in bytes */
  memory_usage_bytes: number;
  
  /** Connection count */
  connection_count: number;
  
  /** Reconnection count */
  reconnection_count: number;
  
  /** Metrics timestamp */
  timestamp: number;
}

/**
 * Redis Health Check
 * 
 * This interface defines the result of Redis health checks.
 */
export interface RedisHealthCheck {
  /** Overall health status */
  healthy: boolean;
  
  /** Health check timestamp */
  timestamp: number;
  
  /** Connection health */
  connection: RedisConnectionHealth;
  
  /** Cluster health (if applicable) */
  cluster?: RedisClusterHealth;
  
  /** Health check errors */
  errors?: string[];
  
  /** Health check metadata */
  metadata?: {
    /** Check duration in milliseconds */
    duration_ms: number;
    /** Ping response time */
    ping_time_ms: number;
    /** Memory usage */
    memory_usage_bytes: number;
    /** Key count */
    key_count: number;
  };
}
