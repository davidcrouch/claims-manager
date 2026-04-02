/**
 * =============================================================================
 * TOKEN EXCHANGE TYPE DEFINITIONS
 * =============================================================================
 * 
 * This module defines TypeScript interfaces and types for OAuth 2.0 Token Exchange
 * (RFC 8693) implementation in the auth server.
 * 
 * Key Features:
 * - RFC 8693 compliant type definitions
 * - Backend token management types
 * - Request/response validation types
 * - Error handling types
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

// =============================================================================
// RFC 8693 TOKEN EXCHANGE TYPES
// =============================================================================

/**
 * OAuth 2.0 Token Exchange Request (RFC 8693)
 * 
 * This interface defines the structure for token exchange requests
 * following the RFC 8693 specification.
 */
export interface TokenExchangeRequest {
  /** Grant type for token exchange - must be the RFC 8693 grant type */
  grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange';
  
  /** The token to be exchanged */
  subject_token: string;
  
  /** Type of the subject token */
  subject_token_type: 'urn:ietf:params:oauth:token-type:access_token' | 'urn:ietf:params:oauth:token-type:refresh_token';
  
  /** Resource identifier for the token exchange */
  resource?: string;
  
  /** Type of token requested */
  requested_token_type?: 'urn:ietf:params:oauth:token-type:access_token' | 'urn:example:token-type:backend';
  
  /** Audience for the requested token */
  audience?: string;
  
  /** Scope for the requested token */
  scope?: string;
  
  /** Additional parameters */
  [key: string]: any;
}

/**
 * OAuth 2.0 Token Exchange Response (RFC 8693)
 * 
 * This interface defines the structure for successful token exchange responses
 * following the RFC 8693 specification.
 */
export interface TokenExchangeResponse {
  /** The issued access token */
  access_token: string;
  
  /** Type of the issued token */
  issued_token_type: 'urn:ietf:params:oauth:token-type:access_token' | 'urn:example:token-type:backend';
  
  /** Token type (always Bearer for OAuth 2.0) */
  token_type: 'Bearer';
  
  /** Token expiration time in seconds */
  expires_in: number;
  
  /** Scope of the issued token */
  scope?: string;
  
  /** Additional response parameters */
  [key: string]: any;
}

/**
 * Token Exchange Error Response
 * 
 * This interface defines the structure for token exchange error responses
 * following OAuth 2.0 error response format.
 */
export interface TokenExchangeErrorResponse {
  /** Error code */
  error: string;
  
  /** Human-readable error description */
  error_description?: string;
  
  /** URI identifying the error */
  error_uri?: string;
  
  /** Additional error parameters */
  [key: string]: any;
}

// =============================================================================
// BACKEND TOKEN MANAGEMENT TYPES
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
  metadata?: {
    /** Client ID that requested the token */
    client_id?: string;
    /** Scope of the token */
    scope?: string;
    /** Token version for key rotation */
    version?: string;
  };
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
// CLIENT AUTHORIZATION TYPES
// =============================================================================

/**
 * Client Authorization Context
 * 
 * This interface defines the context for client authorization
 * in token exchange operations.
 */
export interface ClientAuthorizationContext {
  /** Client ID */
  client_id: string;
  
  /** Client secret (if applicable) */
  client_secret?: string;
  
  /** Client metadata */
  metadata: {
    /** Allowed resources for token exchange */
    allowed_resources?: string[];
    /** Allowed token types */
    allowed_token_types?: string[];
    /** Rate limiting configuration */
    rate_limit?: {
      requests_per_minute: number;
      burst_limit: number;
    };
    /** Client permissions */
    permissions?: string[];
  };
}

/**
 * Authorization Result
 * 
 * This interface defines the result of client authorization checks.
 */
export interface AuthorizationResult {
  /** Whether the client is authorized */
  authorized: boolean;
  
  /** Reason for authorization failure */
  reason?: string;
  
  /** Allowed resources */
  allowed_resources?: string[];
  
  /** Allowed token types */
  allowed_token_types?: string[];
}

// =============================================================================
// VALIDATION TYPES
// =============================================================================

/**
 * Token Exchange Validation Result
 * 
 * This interface defines the result of token exchange request validation.
 */
export interface TokenExchangeValidationResult {
  /** Whether the request is valid */
  valid: boolean;
  
  /** Validation errors */
  errors: string[];
  
  /** Validated request data */
  validated_request?: Partial<TokenExchangeRequest>;
}

/**
 * Subject Token Validation Result
 * 
 * This interface defines the result of subject token validation.
 */
export interface SubjectTokenValidationResult {
  /** Whether the subject token is valid */
  valid: boolean;

  /** User ID (sub claim) from the subject token */
  user_id?: string;
  
  /** Organization ID from the subject token */
  organization_id?: string;
  
  /** Client ID from the subject token */
  client_id?: string;
  
  /** Token scope */
  scope?: string;
  
  /** Token expiration */
  expires_at?: number;
  
  /** Validation errors */
  errors?: string[];
}

// =============================================================================
// REDIS STORAGE TYPES
// =============================================================================

/**
 * Redis Token Storage Key
 * 
 * This interface defines the structure for Redis storage keys
 * used in token exchange operations.
 */
export interface RedisTokenStorageKey {
  /** Key prefix */
  prefix: 'backend_token' | 'token_exchange' | 'rate_limit' | 'lock';
  
  /** Organization ID */
  organization_id: string;
  
  /** Resource identifier */
  resource?: string;
  
  /** Additional key components */
  components?: string[];
}

/**
 * Redis Storage Options
 * 
 * This interface defines options for Redis storage operations.
 */
export interface RedisStorageOptions {
  /** Time to live in seconds */
  ttl?: number;
  
  /** Whether to encrypt the data */
  encrypt?: boolean;
  
  /** Whether to use atomic operations */
  atomic?: boolean;
  
  /** Additional storage options */
  [key: string]: any;
}

// =============================================================================
// AUDIT LOGGING TYPES
// =============================================================================

/**
 * Token Exchange Audit Event
 * 
 * This interface defines the structure for audit logging
 * of token exchange operations.
 */
export interface TokenExchangeAuditEvent {
  /** Event timestamp */
  timestamp: string;
  
  /** Event type */
  event_type: 'token_exchange_request' | 'token_exchange_success' | 'token_exchange_failure' | 'token_refresh' | 'token_cleanup';
  
  /** Client ID */
  client_id: string;
  
  /** Organization ID */
  organization_id?: string;
  
  /** Resource identifier */
  resource?: string;
  
  /** Requested token type */
  requested_token_type?: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message (if applicable) */
  error_message?: string;
  
  /** Additional event data */
  metadata?: {
    /** Request IP address */
    ip_address?: string;
    /** User agent */
    user_agent?: string;
    /** Request ID for tracing */
    request_id?: string;
    /** Processing time in milliseconds */
    processing_time?: number;
  };
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Token Exchange Configuration
 * 
 * This interface defines the configuration for token exchange operations.
 */
export interface TokenExchangeConfig {
  /** Default token type for requests */
  default_requested_token_type: string;
  
  /** Supported token types */
  supported_token_types: string[];
  
  /** Default token TTL in seconds */
  default_token_ttl: number;
  
  /** Maximum token TTL in seconds */
  max_token_ttl: number;
  
  /** Rate limiting configuration */
  rate_limiting: {
    /** Requests per minute per client */
    requests_per_minute: number;
    /** Burst limit */
    burst_limit: number;
    /** Rate limit window in milliseconds */
    window_ms: number;
  };
  
  /** Encryption configuration */
  encryption: {
    /** Encryption algorithm */
    algorithm: string;
    /** Key length */
    key_length: number;
    /** IV length */
    iv_length: number;
  };
  
  /** Backend API configuration */
  backend_api: {
    /** Base URL */
    base_url: string;
    /** Timeout in milliseconds */
    timeout: number;
    /** Retry configuration */
    retry: {
      /** Maximum retry attempts */
      max_attempts: number;
      /** Retry delay in milliseconds */
      delay_ms: number;
      /** Exponential backoff */
      exponential_backoff: boolean;
    };
  };
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Token Exchange Operation Result
 * 
 * This interface defines the result of token exchange operations.
 */
export interface TokenExchangeOperationResult<T = any> {
  /** Whether the operation was successful */
  success: boolean;
  
  /** Result data */
  data?: T;
  
  /** Error message */
  error?: string;
  
  /** Error code */
  error_code?: string;
  
  /** Additional metadata */
  metadata?: {
    /** Processing time in milliseconds */
    processing_time?: number;
    /** Request ID */
    request_id?: string;
    /** Client ID */
    client_id?: string;
  };
}

/**
 * Token Exchange Service Interface
 * 
 * This interface defines the contract for token exchange services.
 */
export interface TokenExchangeServiceInterface {
  /** Exchange a token */
  exchangeToken(request: TokenExchangeRequest): Promise<TokenExchangeOperationResult<TokenExchangeResponse>>;
  
  /** Validate a subject token */
  validateSubjectToken(token: string, tokenType: string): Promise<TokenExchangeOperationResult<SubjectTokenValidationResult>>;
  
  /** Get backend token for account and resource */
  getBackendToken(organizationId: string, resource: string): Promise<TokenExchangeOperationResult<BackendTokenRecord>>;
  
  /** Refresh backend token */
  refreshBackendToken(organizationId: string, resource: string): Promise<TokenExchangeOperationResult<BackendTokenRecord>>;
  
  /** Clean up expired tokens */
  cleanupExpiredTokens(): Promise<TokenExchangeOperationResult<number>>;
}
