/**
 * =============================================================================
 * BACKEND TOKEN TYPES
 * =============================================================================
 * 
 * This module defines TypeScript interfaces and types for backend token management
 * in the auth server token exchange system.
 * 
 * Key Features:
 * - Backend token lifecycle management
 * - Token encryption and storage
 * - Token refresh and fallback logic
 * - Error handling and recovery
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

// =============================================================================
// BACKEND TOKEN CORE TYPES
// =============================================================================

/**
 * Backend Token Record
 * 
 * This interface defines the structure for storing backend tokens in Redis
 * with encryption and metadata.
 */
export interface BackendTokenRecord {
  /** Backend access token */
  access_token: string;
  
  /** Backend refresh token (never exposed to clients) */
  refresh_token: string;
  
  /** Token expiration timestamp (Unix timestamp in milliseconds) */
  expires_at: number;
  
  /** Token creation timestamp (Unix timestamp in milliseconds) */
  created_at: number;
  
  /** Organization ID associated with the token */
  organization_id: string;
  
  /** Resource identifier for the token */
  resource: string;
  
  /** Token metadata */
  metadata?: BackendTokenMetadata;
}

/**
 * Backend Token Metadata
 * 
 * This interface defines metadata associated with backend tokens.
 */
export interface BackendTokenMetadata {
  /** Client ID that requested the token */
  client_id?: string;
  
  /** Scope of the token */
  scope?: string;
  
  /** Token version for key rotation */
  version?: string;
  
  /** Token source (login, refresh, exchange) */
  source?: 'login' | 'refresh' | 'exchange';
  
  /** Last refresh timestamp */
  last_refresh?: number;
  
  /** Refresh attempt count */
  refresh_count?: number;
  
  /** Maximum refresh attempts */
  max_refresh_attempts?: number;
  
  /** Token status */
  status?: 'active' | 'expired' | 'revoked' | 'refreshing';
  
  /** Additional custom metadata */
  custom?: Record<string, any>;
}

/**
 * Backend Token Response
 * 
 * This interface defines the structure for backend API token responses
 * when refreshing or obtaining new tokens.
 */
export interface BackendTokenResponse {
  /** Backend access token */
  access_token: string;
  
  /** Backend refresh token (optional, only for new tokens) */
  refresh_token?: string;
  
  /** Token expiration time in seconds */
  expires_in: number;
  
  /** Token type (always Bearer) */
  token_type: 'Bearer';
  
  /** Additional response data */
  [key: string]: any;
}

// =============================================================================
// TOKEN LIFECYCLE TYPES
// =============================================================================

/**
 * Token Lifecycle State
 * 
 * This enum defines the possible states of a backend token.
 */
export enum TokenLifecycleState {
  /** Token is active and valid */
  ACTIVE = 'active',
  
  /** Token is expired but refreshable */
  EXPIRED = 'expired',
  
  /** Token is being refreshed */
  REFRESHING = 'refreshing',
  
  /** Token is revoked and cannot be used */
  REVOKED = 'revoked',
  
  /** Token is in error state */
  ERROR = 'error'
}

/**
 * Token Refresh Strategy
 * 
 * This enum defines the strategy for token refresh operations.
 */
export enum TokenRefreshStrategy {
  /** Refresh token when it's close to expiration */
  PROACTIVE = 'proactive',
  
  /** Refresh token only when it's expired */
  REACTIVE = 'reactive',
  
  /** Refresh token on demand */
  ON_DEMAND = 'on_demand'
}

/**
 * Token Refresh Result
 * 
 * This interface defines the result of token refresh operations.
 */
export interface TokenRefreshResult {
  /** Whether the refresh was successful */
  success: boolean;
  
  /** New token record (if successful) */
  token_record?: BackendTokenRecord;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Error code */
  error_code?: string;
  
  /** Whether fallback to login is required */
  requires_login?: boolean;
  
  /** Refresh metadata */
  metadata?: {
    /** Refresh attempt number */
    attempt: number;
    /** Total refresh attempts */
    total_attempts: number;
    /** Refresh duration in milliseconds */
    duration_ms: number;
    /** Backend API response time */
    backend_response_time_ms?: number;
  };
}

// =============================================================================
// TOKEN STORAGE TYPES
// =============================================================================

/**
 * Token Storage Key
 * 
 * This interface defines the structure for Redis storage keys
 * used in backend token operations.
 */
export interface TokenStorageKey {
  /** Key prefix */
  prefix: 'backend_token' | 'token_lock' | 'token_refresh' | 'token_cleanup';
  
  /** Organization ID */
  organization_id: string;
  
  /** Resource identifier */
  resource: string;
  
  /** Additional key components */
  components?: string[];
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
  
  /** Additional storage options */
  [key: string]: any;
}

/**
 * Token Storage Result
 * 
 * This interface defines the result of token storage operations.
 */
export interface TokenStorageResult {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Stored token record */
  token_record?: BackendTokenRecord;
  
  /** Error message */
  error?: string;
  
  /** Storage metadata */
  metadata?: {
    /** Storage duration in milliseconds */
    duration_ms: number;
    /** Key used for storage */
    storage_key: string;
    /** Whether data was encrypted */
    encrypted: boolean;
  };
}

// =============================================================================
// TOKEN ENCRYPTION TYPES
// =============================================================================

/**
 * Token Encryption Configuration
 * 
 * This interface defines the configuration for token encryption.
 */
export interface TokenEncryptionConfig {
  /** Encryption algorithm */
  algorithm: string;
  
  /** Key length in bits */
  key_length: number;
  
  /** IV length in bytes */
  iv_length: number;
  
  /** Secret key for encryption */
  secret_key: string;
  
  /** Whether to use authenticated encryption */
  authenticated: boolean;
  
  /** Additional encryption options */
  options?: Record<string, any>;
}

/**
 * Encrypted Token Data
 * 
 * This interface defines the structure for encrypted token data.
 */
export interface EncryptedTokenData {
  /** Encrypted data */
  encrypted_data: string;
  
  /** Initialization vector */
  iv: string;
  
  /** Authentication tag (for authenticated encryption) */
  auth_tag?: string;
  
  /** Encryption algorithm used */
  algorithm: string;
  
  /** Key version */
  key_version: string;
  
  /** Timestamp of encryption */
  encrypted_at: number;
}

// =============================================================================
// TOKEN VALIDATION TYPES
// =============================================================================

/**
 * Token Validation Result
 * 
 * This interface defines the result of token validation operations.
 */
export interface TokenValidationResult {
  /** Whether the token is valid */
  valid: boolean;
  
  /** Token record (if valid) */
  token_record?: BackendTokenRecord;
  
  /** Validation errors */
  errors?: string[];
  
  /** Token status */
  status?: TokenLifecycleState;
  
  /** Time until expiration (in seconds) */
  expires_in?: number;
  
  /** Whether token needs refresh */
  needs_refresh?: boolean;
  
  /** Validation metadata */
  metadata?: {
    /** Validation duration in milliseconds */
    duration_ms: number;
    /** Validation method used */
    method: string;
    /** Token age in milliseconds */
    token_age_ms: number;
  };
}

/**
 * Token Validation Options
 * 
 * This interface defines options for token validation.
 */
export interface TokenValidationOptions {
  /** Whether to check expiration */
  check_expiration?: boolean;
  
  /** Whether to check revocation */
  check_revocation?: boolean;
  
  /** Whether to validate signature */
  validate_signature?: boolean;
  
  /** Whether to check token status */
  check_status?: boolean;
  
  /** Refresh threshold in seconds */
  refresh_threshold?: number;
  
  /** Additional validation options */
  [key: string]: any;
}

// =============================================================================
// TOKEN CLEANUP TYPES
// =============================================================================

/**
 * Token Cleanup Configuration
 * 
 * This interface defines the configuration for token cleanup operations.
 */
export interface TokenCleanupConfig {
  /** Cleanup interval in milliseconds */
  interval_ms: number;
  
  /** Maximum age for tokens to keep (in milliseconds) */
  max_token_age_ms: number;
  
  /** Maximum number of tokens per account */
  max_tokens_per_account: number;
  
  /** Whether to clean up expired tokens */
  cleanup_expired: boolean;
  
  /** Whether to clean up revoked tokens */
  cleanup_revoked: boolean;
  
  /** Whether to clean up old tokens */
  cleanup_old: boolean;
  
  /** Batch size for cleanup operations */
  batch_size: number;
}

/**
 * Token Cleanup Result
 * 
 * This interface defines the result of token cleanup operations.
 */
export interface TokenCleanupResult {
  /** Whether the cleanup was successful */
  success: boolean;
  
  /** Number of tokens cleaned up */
  tokens_cleaned: number;
  
  /** Number of accounts processed */
  accounts_processed: number;
  
  /** Cleanup duration in milliseconds */
  duration_ms: number;
  
  /** Error message (if any) */
  error?: string;
  
  /** Cleanup metadata */
  metadata?: {
    /** Cleanup method used */
    method: string;
    /** Memory freed in bytes */
    memory_freed_bytes?: number;
    /** Redis keys deleted */
    redis_keys_deleted: number;
  };
}

// =============================================================================
// TOKEN MONITORING TYPES
// =============================================================================

/**
 * Token Metrics
 * 
 * This interface defines metrics for token operations.
 */
export interface TokenMetrics {
  /** Total tokens created */
  tokens_created: number;
  
  /** Total tokens refreshed */
  tokens_refreshed: number;
  
  /** Total tokens expired */
  tokens_expired: number;
  
  /** Total tokens revoked */
  tokens_revoked: number;
  
  /** Total refresh failures */
  refresh_failures: number;
  
  /** Average token lifetime in milliseconds */
  average_token_lifetime_ms: number;
  
  /** Average refresh time in milliseconds */
  average_refresh_time_ms: number;
  
  /** Token distribution by status */
  status_distribution: Record<TokenLifecycleState, number>;
  
  /** Metrics timestamp */
  timestamp: number;
}

/**
 * Token Health Check
 * 
 * This interface defines the result of token system health checks.
 */
export interface TokenHealthCheck {
  /** Overall health status */
  healthy: boolean;
  
  /** Health check timestamp */
  timestamp: number;
  
  /** Individual component health */
  components: {
    /** Redis connection health */
    redis: boolean;
    /** Backend API health */
    backend_api: boolean;
    /** Encryption system health */
    encryption: boolean;
    /** Token storage health */
    storage: boolean;
  };
  
  /** Health check errors */
  errors?: string[];
  
  /** Health check metadata */
  metadata?: {
    /** Check duration in milliseconds */
    duration_ms: number;
    /** Number of tokens checked */
    tokens_checked: number;
    /** Redis response time */
    redis_response_time_ms: number;
    /** Backend API response time */
    backend_response_time_ms: number;
  };
}
