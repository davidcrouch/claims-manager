/**
 * =============================================================================
 * AUTH SERVER UTILITIES
 * =============================================================================
 * 
 * This module provides utility functions for the auth-server.
 * 
 * NOTE: Organization resolution is handled in organization-resolution-service.ts
 * with direct database access. This file contains only helper utilities.
 */

import { createLogger, LoggerType } from '../lib/logger.js';

const log = createLogger('auth-server:utils', LoggerType.NODEJS);

// Re-export types from organization-resolution-service for backwards compatibility
export type { OrganizationResolutionResult } from '../services/organization-resolution-service.js';
