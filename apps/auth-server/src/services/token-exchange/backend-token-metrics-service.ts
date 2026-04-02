/**
 * =============================================================================
 * BACKEND TOKEN METRICS SERVICE
 * =============================================================================
 * 
 * This module provides comprehensive monitoring and metrics for backend token
 * usage in the auth server. It tracks token exchange operations, performance
 * metrics, and usage patterns.
 * 
 * Key Features:
 * - Real-time metrics collection
 * - Performance monitoring
 * - Usage analytics
 * - Error tracking
 * - Token lifecycle metrics
 * 
 * @author AI Assistant
 * @version 1.0.0
 * @since 2025-01-30
 */

import { createLogger, LoggerType } from '../../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';

const baseLogger = createLogger('auth-server:backend-token-metrics-service', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'backend-token-metrics-service', 'BackendTokenMetricsService', 'auth-server');

// =============================================================================
// BACKEND TOKEN METRICS SERVICE CLASS
// =============================================================================

/**
 * Service for monitoring and collecting backend token metrics
 */
export class BackendTokenMetricsService {
  private metrics: BackendTokenMetrics;
  private isEnabled: boolean;

  constructor(config: BackendTokenMetricsConfig = {}) {
    this.isEnabled = config.enabled !== false; // Default to enabled
    this.metrics = {
      totalExchanges: 0,
      successfulExchanges: 0,
      failedExchanges: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastExchange: 0,
      exchangesByTokenType: {},
      exchangesByResource: {},
      exchangesByAccount: {},
      errorCounts: {},
      performanceHistory: [],
      lastReset: Date.now()
    };

    log.info({
      enabled: this.isEnabled,
      config
    }, 'auth-server:backend-token-metrics-service - BackendTokenMetricsService initialized');
  }

  /**
   * Record a token exchange operation
   */
  public recordExchange(
    success: boolean,
    responseTime: number,
    tokenType: string,
    resource?: string,
    accountId?: string,
    error?: string
  ): void {
    if (!this.isEnabled) return;

    try {
      const now = Date.now();
      
      // Update basic metrics
      this.metrics.totalExchanges++;
      this.metrics.totalResponseTime += responseTime;
      this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.totalExchanges;
      this.metrics.lastExchange = now;

      if (success) {
        this.metrics.successfulExchanges++;
      } else {
        this.metrics.failedExchanges++;
      }

      // Update token type metrics
      if (!this.metrics.exchangesByTokenType[tokenType]) {
        this.metrics.exchangesByTokenType[tokenType] = 0;
      }
      this.metrics.exchangesByTokenType[tokenType]++;

      // Update resource metrics
      if (resource) {
        if (!this.metrics.exchangesByResource[resource]) {
          this.metrics.exchangesByResource[resource] = 0;
        }
        this.metrics.exchangesByResource[resource]++;
      }

      // Update account metrics
      if (accountId) {
        if (!this.metrics.exchangesByAccount[accountId]) {
          this.metrics.exchangesByAccount[accountId] = 0;
        }
        this.metrics.exchangesByAccount[accountId]++;
      }

      // Update error metrics
      if (error) {
        if (!this.metrics.errorCounts[error]) {
          this.metrics.errorCounts[error] = 0;
        }
        this.metrics.errorCounts[error]++;
      }

      // Add to performance history
      this.metrics.performanceHistory.push({
        timestamp: now,
        responseTime,
        success,
        tokenType,
        resource,
        accountId,
        error
      });

      // Keep only recent history (last 1000 entries)
      if (this.metrics.performanceHistory.length > 1000) {
        this.metrics.performanceHistory = this.metrics.performanceHistory.slice(-1000);
      }

      log.debug({
        success,
        responseTime,
        tokenType,
        resource,
        accountId,
        totalExchanges: this.metrics.totalExchanges
      }, 'auth-server:backend-token-metrics-service:recordExchange - Exchange recorded');
    } catch (error) {
      log.error({
        error: error.message
      }, 'auth-server:backend-token-metrics-service:recordExchange - Failed to record exchange');
    }
  }

  /**
   * Get current metrics
   */
  public getMetrics(): BackendTokenMetrics {
    return { ...this.metrics };
  }

  /**
   * Get success rate
   */
  public getSuccessRate(): number {
    if (this.metrics.totalExchanges === 0) return 0;
    return this.metrics.successfulExchanges / this.metrics.totalExchanges;
  }

  /**
   * Get error rate
   */
  public getErrorRate(): number {
    if (this.metrics.totalExchanges === 0) return 0;
    return this.metrics.failedExchanges / this.metrics.totalExchanges;
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    totalExchanges: number;
    successRate: number;
    errorRate: number;
    averageResponseTime: number;
    lastExchange: number;
    topTokenTypes: Array<{ type: string; count: number }>;
    topResources: Array<{ resource: string; count: number }>;
    topErrors: Array<{ error: string; count: number }>;
  } {
    const topTokenTypes = Object.entries(this.metrics.exchangesByTokenType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topResources = Object.entries(this.metrics.exchangesByResource)
      .map(([resource, count]) => ({ resource, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topErrors = Object.entries(this.metrics.errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalExchanges: this.metrics.totalExchanges,
      successRate: this.getSuccessRate(),
      errorRate: this.getErrorRate(),
      averageResponseTime: this.metrics.averageResponseTime,
      lastExchange: this.metrics.lastExchange,
      topTokenTypes,
      topResources,
      topErrors
    };
  }

  /**
   * Get performance history
   */
  public getPerformanceHistory(limit?: number): PerformanceMetric[] {
    const history = this.metrics.performanceHistory;
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Get metrics for a specific time range
   */
  public getMetricsForTimeRange(startTime: number, endTime: number): {
    exchanges: number;
    successfulExchanges: number;
    failedExchanges: number;
    averageResponseTime: number;
    errors: Array<{ error: string; count: number }>;
  } {
    const filteredHistory = this.metrics.performanceHistory.filter(
      entry => entry.timestamp >= startTime && entry.timestamp <= endTime
    );

    const exchanges = filteredHistory.length;
    const successfulExchanges = filteredHistory.filter(entry => entry.success).length;
    const failedExchanges = filteredHistory.filter(entry => !entry.success).length;
    const totalResponseTime = filteredHistory.reduce((sum, entry) => sum + entry.responseTime, 0);
    const averageResponseTime = exchanges > 0 ? totalResponseTime / exchanges : 0;

    // Count errors
    const errorCounts: { [error: string]: number } = {};
    filteredHistory.forEach(entry => {
      if (entry.error) {
        errorCounts[entry.error] = (errorCounts[entry.error] || 0) + 1;
      }
    });

    const errors = Object.entries(errorCounts)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);

    return {
      exchanges,
      successfulExchanges,
      failedExchanges,
      averageResponseTime,
      errors
    };
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.metrics = {
      totalExchanges: 0,
      successfulExchanges: 0,
      failedExchanges: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      lastExchange: 0,
      exchangesByTokenType: {},
      exchangesByResource: {},
      exchangesByAccount: {},
      errorCounts: {},
      performanceHistory: [],
      lastReset: Date.now()
    };

    log.info({}, 'auth-server:backend-token-metrics-service:resetMetrics - Metrics reset');
  }

  /**
   * Enable metrics collection
   */
  public enable(): void {
    this.isEnabled = true;
    log.info({}, 'auth-server:backend-token-metrics-service:enable - Metrics collection enabled');
  }

  /**
   * Disable metrics collection
   */
  public disable(): void {
    this.isEnabled = false;
    log.info({}, 'auth-server:backend-token-metrics-service:disable - Metrics collection disabled');
  }

  /**
   * Check if metrics collection is enabled
   */
  public isMetricsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Get health status
   */
  public getHealthStatus(): {
    healthy: boolean;
    metrics: {
      totalExchanges: number;
      successRate: number;
      errorRate: number;
      averageResponseTime: number;
      lastExchange: number;
    };
    issues: string[];
  } {
    const issues: string[] = [];
    const successRate = this.getSuccessRate();
    const errorRate = this.getErrorRate();

    // Check for high error rate
    if (errorRate > 0.1) { // 10%
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
    }

    // Check for high response time
    if (this.metrics.averageResponseTime > 5000) { // 5 seconds
      issues.push(`High average response time: ${this.metrics.averageResponseTime.toFixed(0)}ms`);
    }

    // Check for no recent activity
    const now = Date.now();
    const timeSinceLastExchange = now - this.metrics.lastExchange;
    if (timeSinceLastExchange > 300000) { // 5 minutes
      issues.push(`No recent activity: ${Math.floor(timeSinceLastExchange / 60000)} minutes ago`);
    }

    const healthy = issues.length === 0;

    return {
      healthy,
      metrics: {
        totalExchanges: this.metrics.totalExchanges,
        successRate,
        errorRate,
        averageResponseTime: this.metrics.averageResponseTime,
        lastExchange: this.metrics.lastExchange
      },
      issues
    };
  }
}

// =============================================================================
// TYPES AND INTERFACES
// =============================================================================

export interface BackendTokenMetricsConfig {
  enabled?: boolean;
}

export interface BackendTokenMetrics {
  totalExchanges: number;
  successfulExchanges: number;
  failedExchanges: number;
  averageResponseTime: number;
  totalResponseTime: number;
  lastExchange: number;
  exchangesByTokenType: { [tokenType: string]: number };
  exchangesByResource: { [resource: string]: number };
  exchangesByAccount: { [accountId: string]: number };
  errorCounts: { [error: string]: number };
  performanceHistory: PerformanceMetric[];
  lastReset: number;
}

export interface PerformanceMetric {
  timestamp: number;
  responseTime: number;
  success: boolean;
  tokenType: string;
  resource?: string;
  accountId?: string;
  error?: string;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a new backend token metrics service instance
 */
export function createBackendTokenMetricsService(
  config?: BackendTokenMetricsConfig
): BackendTokenMetricsService {
  return new BackendTokenMetricsService(config);
}

export default BackendTokenMetricsService;
