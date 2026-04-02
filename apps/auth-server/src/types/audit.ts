/**
 * =============================================================================
 * AUDIT LOGGING TYPES
 * =============================================================================
 * 
 * This module defines TypeScript interfaces and types for audit logging
 * in the auth server token exchange system.
 * 
 * Key Features:
 * - Comprehensive audit logging
 * - Security event tracking
 * - Performance monitoring
 * - Compliance reporting
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

// =============================================================================
// AUDIT EVENT TYPES
// =============================================================================

/**
 * Audit Event Type
 * 
 * This enum defines the types of audit events that can be logged.
 */
export enum AuditEventType {
  /** Token exchange request */
  TOKEN_EXCHANGE_REQUEST = 'token_exchange_request',
  
  /** Token exchange success */
  TOKEN_EXCHANGE_SUCCESS = 'token_exchange_success',
  
  /** Token exchange failure */
  TOKEN_EXCHANGE_FAILURE = 'token_exchange_failure',
  
  /** Token refresh request */
  TOKEN_REFRESH_REQUEST = 'token_refresh_request',
  
  /** Token refresh success */
  TOKEN_REFRESH_SUCCESS = 'token_refresh_success',
  
  /** Token refresh failure */
  TOKEN_REFRESH_FAILURE = 'token_refresh_failure',
  
  /** Token cleanup */
  TOKEN_CLEANUP = 'token_cleanup',
  
  /** Client authorization request */
  CLIENT_AUTHORIZATION_REQUEST = 'client_authorization_request',
  
  /** Client authorization success */
  CLIENT_AUTHORIZATION_SUCCESS = 'client_authorization_success',
  
  /** Client authorization failure */
  CLIENT_AUTHORIZATION_FAILURE = 'client_authorization_failure',
  
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  
  /** Security violation */
  SECURITY_VIOLATION = 'security_violation',
  
  /** System error */
  SYSTEM_ERROR = 'system_error',
  
  /** Configuration change */
  CONFIGURATION_CHANGE = 'configuration_change',
  
  /** Health check */
  HEALTH_CHECK = 'health_check'
}

/**
 * Audit Event Severity
 * 
 * This enum defines the severity levels for audit events.
 */
export enum AuditEventSeverity {
  /** Low severity - informational */
  LOW = 'low',
  
  /** Medium severity - warning */
  MEDIUM = 'medium',
  
  /** High severity - error */
  HIGH = 'high',
  
  /** Critical severity - security issue */
  CRITICAL = 'critical'
}

/**
 * Audit Event Status
 * 
 * This enum defines the status of audit events.
 */
export enum AuditEventStatus {
  /** Event is pending */
  PENDING = 'pending',
  
  /** Event is processing */
  PROCESSING = 'processing',
  
  /** Event is completed */
  COMPLETED = 'completed',
  
  /** Event failed */
  FAILED = 'failed',
  
  /** Event is ignored */
  IGNORED = 'ignored'
}

// =============================================================================
// CORE AUDIT TYPES
// =============================================================================

/**
 * Base Audit Event
 * 
 * This interface defines the base structure for all audit events.
 */
export interface BaseAuditEvent {
  /** Event ID */
  event_id: string;
  
  /** Event type */
  event_type: AuditEventType;
  
  /** Event severity */
  severity: AuditEventSeverity;
  
  /** Event status */
  status: AuditEventStatus;
  
  /** Event timestamp */
  timestamp: string;
  
  /** Event source */
  source: string;
  
  /** Event message */
  message: string;
  
  /** Event description */
  description?: string;
  
  /** Event tags */
  tags?: string[];
  
  /** Event metadata */
  metadata?: Record<string, any>;
}

/**
 * Token Exchange Audit Event
 * 
 * This interface defines the structure for token exchange audit events.
 */
export interface TokenExchangeAuditEvent extends BaseAuditEvent {
  /** Event type */
  event_type: AuditEventType.TOKEN_EXCHANGE_REQUEST | AuditEventType.TOKEN_EXCHANGE_SUCCESS | AuditEventType.TOKEN_EXCHANGE_FAILURE;
  
  /** Client ID */
  client_id: string;
  
  /** Organization ID */
  organization_id?: string;
  
  /** Resource identifier */
  resource?: string;
  
  /** Requested token type */
  requested_token_type?: string;
  
  /** Subject token type */
  subject_token_type?: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message (if applicable) */
  error_message?: string;
  
  /** Error code (if applicable) */
  error_code?: string;
  
  /** Request metadata */
  request_metadata?: {
    /** Request IP address */
    ip_address?: string;
    /** User agent */
    user_agent?: string;
    /** Request ID for tracing */
    request_id?: string;
    /** Processing time in milliseconds */
    processing_time?: number;
    /** Request size in bytes */
    request_size_bytes?: number;
    /** Response size in bytes */
    response_size_bytes?: number;
  };
  
  /** Token metadata */
  token_metadata?: {
    /** Issued token type */
    issued_token_type?: string;
    /** Token expiration time */
    expires_in?: number;
    /** Token scope */
    scope?: string;
    /** Token audience */
    audience?: string;
  };
}

/**
 * Token Refresh Audit Event
 * 
 * This interface defines the structure for token refresh audit events.
 */
export interface TokenRefreshAuditEvent extends BaseAuditEvent {
  /** Event type */
  event_type: AuditEventType.TOKEN_REFRESH_REQUEST | AuditEventType.TOKEN_REFRESH_SUCCESS | AuditEventType.TOKEN_REFRESH_FAILURE;
  
  /** Organization ID */
  organization_id: string;
  
  /** Resource identifier */
  resource: string;
  
  /** Client ID */
  client_id?: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message (if applicable) */
  error_message?: string;
  
  /** Error code (if applicable) */
  error_code?: string;
  
  /** Refresh metadata */
  refresh_metadata?: {
    /** Refresh attempt number */
    attempt: number;
    /** Total refresh attempts */
    total_attempts: number;
    /** Refresh duration in milliseconds */
    duration_ms: number;
    /** Backend API response time */
    backend_response_time_ms?: number;
    /** Whether fallback to login was required */
    fallback_to_login?: boolean;
  };
}

/**
 * Client Authorization Audit Event
 * 
 * This interface defines the structure for client authorization audit events.
 */
export interface ClientAuthorizationAuditEvent extends BaseAuditEvent {
  /** Event type */
  event_type: AuditEventType.CLIENT_AUTHORIZATION_REQUEST | AuditEventType.CLIENT_AUTHORIZATION_SUCCESS | AuditEventType.CLIENT_AUTHORIZATION_FAILURE;
  
  /** Client ID */
  client_id: string;
  
  /** Organization ID */
  organization_id?: string;
  
  /** Resource identifier */
  resource?: string;
  
  /** Success status */
  success: boolean;
  
  /** Error message (if applicable) */
  error_message?: string;
  
  /** Error code (if applicable) */
  error_code?: string;
  
  /** Authorization metadata */
  authorization_metadata?: {
    /** Requested permissions */
    requested_permissions?: string[];
    /** Granted permissions */
    granted_permissions?: string[];
    /** Denied permissions */
    denied_permissions?: string[];
    /** Authorization method */
    authorization_method?: string;
    /** Authorization duration in milliseconds */
    duration_ms: number;
  };
}

/**
 * Security Violation Audit Event
 * 
 * This interface defines the structure for security violation audit events.
 */
export interface SecurityViolationAuditEvent extends BaseAuditEvent {
  /** Event type */
  event_type: AuditEventType.SECURITY_VIOLATION;
  
  /** Violation type */
  violation_type: string;
  
  /** Client ID */
  client_id?: string;
  
  /** Organization ID */
  organization_id?: string;
  
  /** IP address */
  ip_address?: string;
  
  /** User agent */
  user_agent?: string;
  
  /** Violation details */
  violation_details: {
    /** Violation description */
    description: string;
    /** Violation severity */
    severity: AuditEventSeverity;
    /** Affected resources */
    affected_resources?: string[];
    /** Potential impact */
    potential_impact?: string;
    /** Recommended actions */
    recommended_actions?: string[];
  };
  
  /** Security metadata */
  security_metadata?: {
    /** Request ID */
    request_id?: string;
    /** Session ID */
    session_id?: string;
    /** Authentication method */
    authentication_method?: string;
    /** Authorization level */
    authorization_level?: string;
  };
}

/**
 * Rate Limit Audit Event
 * 
 * This interface defines the structure for rate limit audit events.
 */
export interface RateLimitAuditEvent extends BaseAuditEvent {
  /** Event type */
  event_type: AuditEventType.RATE_LIMIT_EXCEEDED;
  
  /** Client ID */
  client_id: string;
  
  /** IP address */
  ip_address?: string;
  
  /** Rate limit details */
  rate_limit_details: {
    /** Current request count */
    current_count: number;
    /** Maximum allowed requests */
    max_requests: number;
    /** Rate limit window in milliseconds */
    window_ms: number;
    /** Time until reset in milliseconds */
    reset_time_ms: number;
    /** Rate limit key */
    rate_limit_key: string;
  };
  
  /** Request metadata */
  request_metadata?: {
    /** Request ID */
    request_id?: string;
    /** User agent */
    user_agent?: string;
    /** Request path */
    request_path?: string;
    /** Request method */
    request_method?: string;
  };
}

// =============================================================================
// AUDIT LOGGING CONFIGURATION
// =============================================================================

/**
 * Audit Logging Configuration
 * 
 * This interface defines the configuration for audit logging.
 */
export interface AuditLoggingConfig {
  /** Whether audit logging is enabled */
  enabled: boolean;
  
  /** Log level */
  log_level: 'debug' | 'info' | 'warn' | 'error';
  
  /** Log format */
  log_format: 'json' | 'text' | 'structured';
  
  /** Log destination */
  destination: 'console' | 'file' | 'database' | 'syslog' | 'elasticsearch';
  
  /** Log file configuration */
  file_config?: {
    /** Log file path */
    file_path: string;
    /** Maximum file size in bytes */
    max_file_size: number;
    /** Maximum number of files */
    max_files: number;
    /** Whether to compress old files */
    compress: boolean;
  };
  
  /** Database configuration */
  database_config?: {
    /** Database connection string */
    connection_string: string;
    /** Table name */
    table_name: string;
    /** Batch size for inserts */
    batch_size: number;
    /** Flush interval in milliseconds */
    flush_interval_ms: number;
  };
  
  /** Elasticsearch configuration */
  elasticsearch_config?: {
    /** Elasticsearch URL */
    url: string;
    /** Index name */
    index_name: string;
    /** Username */
    username?: string;
    /** Password */
    password?: string;
  };
  
  /** Event filtering */
  event_filtering?: {
    /** Events to include */
    include_events?: AuditEventType[];
    /** Events to exclude */
    exclude_events?: AuditEventType[];
    /** Minimum severity level */
    min_severity?: AuditEventSeverity;
    /** Client ID filter */
    client_id_filter?: string[];
  };
  
  /** Data retention */
  data_retention?: {
    /** Retention period in days */
    retention_days: number;
    /** Whether to archive old data */
    archive: boolean;
    /** Archive destination */
    archive_destination?: string;
  };
  
  /** Performance settings */
  performance?: {
    /** Asynchronous logging */
    async: boolean;
    /** Batch size for processing */
    batch_size: number;
    /** Flush interval in milliseconds */
    flush_interval_ms: number;
    /** Buffer size */
    buffer_size: number;
  };
}

// =============================================================================
// AUDIT LOGGING METRICS
// =============================================================================

/**
 * Audit Logging Metrics
 * 
 * This interface defines metrics for audit logging operations.
 */
export interface AuditLoggingMetrics {
  /** Total events logged */
  total_events_logged: number;
  
  /** Events by type */
  events_by_type: Record<AuditEventType, number>;
  
  /** Events by severity */
  events_by_severity: Record<AuditEventSeverity, number>;
  
  /** Events by status */
  events_by_status: Record<AuditEventStatus, number>;
  
  /** Failed log operations */
  failed_log_operations: number;
  
  /** Average processing time in milliseconds */
  average_processing_time_ms: number;
  
  /** Total data logged in bytes */
  total_data_logged_bytes: number;
  
  /** Log file size in bytes */
  log_file_size_bytes: number;
  
  /** Metrics timestamp */
  timestamp: number;
}

/**
 * Audit Logging Health Check
 * 
 * This interface defines the result of audit logging health checks.
 */
export interface AuditLoggingHealthCheck {
  /** Overall health status */
  healthy: boolean;
  
  /** Health check timestamp */
  timestamp: number;
  
  /** Component health */
  components: {
    /** Logging system health */
    logging_system: boolean;
    /** File system health */
    file_system: boolean;
    /** Database health (if applicable) */
    database?: boolean;
    /** Elasticsearch health (if applicable) */
    elasticsearch?: boolean;
  };
  
  /** Health check errors */
  errors?: string[];
  
  /** Health check metadata */
  metadata?: {
    /** Check duration in milliseconds */
    duration_ms: number;
    /** Events processed */
    events_processed: number;
    /** Log file count */
    log_file_count: number;
    /** Available disk space in bytes */
    available_disk_space_bytes: number;
  };
}

// =============================================================================
// AUDIT LOGGING UTILITIES
// =============================================================================

/**
 * Audit Event Filter
 * 
 * This interface defines a filter for audit events.
 */
export interface AuditEventFilter {
  /** Event types to include */
  event_types?: AuditEventType[];
  
  /** Event types to exclude */
  exclude_event_types?: AuditEventType[];
  
  /** Severity levels to include */
  severity_levels?: AuditEventSeverity[];
  
  /** Client IDs to include */
  client_ids?: string[];
  
  /** Organization IDs to include */
  organization_ids?: string[];
  
  /** Date range */
  date_range?: {
    start_date: string;
    end_date: string;
  };
  
  /** Additional filters */
  custom_filters?: Record<string, any>;
}

/**
 * Audit Event Query
 * 
 * This interface defines a query for retrieving audit events.
 */
export interface AuditEventQuery {
  /** Event filter */
  filter: AuditEventFilter;
  
  /** Sorting options */
  sorting?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  
  /** Pagination options */
  pagination?: {
    page: number;
    page_size: number;
  };
  
  /** Fields to include */
  fields?: string[];
  
  /** Fields to exclude */
  exclude_fields?: string[];
}

/**
 * Audit Event Query Result
 * 
 * This interface defines the result of an audit event query.
 */
export interface AuditEventQueryResult {
  /** Query results */
  events: BaseAuditEvent[];
  
  /** Total count */
  total_count: number;
  
  /** Page information */
  page_info: {
    page: number;
    page_size: number;
    total_pages: number;
    has_next_page: boolean;
    has_previous_page: boolean;
  };
  
  /** Query metadata */
  metadata?: {
    /** Query duration in milliseconds */
    duration_ms: number;
    /** Query execution time */
    execution_time_ms: number;
    /** Results count */
    results_count: number;
  };
}
