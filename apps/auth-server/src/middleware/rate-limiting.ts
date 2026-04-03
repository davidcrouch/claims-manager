import rateLimit from 'express-rate-limit';
import { createLogger, LoggerType } from '../lib/logger.js';
import { createTelemetryLogger } from '@morezero/telemetry';
import { getRateLimitConfig } from '../config/env-validation.js';

const baseLogger = createLogger('auth-server:rate-limiting', LoggerType.NODEJS);
const log = createTelemetryLogger(baseLogger, 'rate-limiting', 'RateLimiting', 'auth-server');

// Get rate limit configuration from environment validation
const rateLimitConfig = getRateLimitConfig();

// Log the rate limit configuration
log.info({
   windowMs: rateLimitConfig.windowMs,
   generalMax: rateLimitConfig.maxRequests,
   authMax: rateLimitConfig.authMaxRequests,
   oauthMax: rateLimitConfig.oauthMaxRequests,
   tokenMax: rateLimitConfig.tokenMaxRequests
}, 'Rate limit configuration loaded');

// General rate limiting
export const generalRateLimit = rateLimit({
   windowMs: rateLimitConfig.windowMs,
   max: rateLimitConfig.maxRequests,
   message: {
      error: 'rate_limit_exceeded',
      error_description: 'Too many requests from this IP, please try again later.'
   },
   standardHeaders: true,
   legacyHeaders: false,
   handler: (req, res) => {
      log.warn({
         ip: req.ip,
         path: req.path,
         userAgent: req.get('User-Agent')
      }, 'Rate limit exceeded');
      
      res.status(429).json({
         error: 'rate_limit_exceeded',
         error_description: 'Too many requests from this IP, please try again later.'
      });
   }
});

// Strict rate limiting for authentication endpoints
export const authRateLimit = rateLimit({
   windowMs: rateLimitConfig.windowMs,
   max: rateLimitConfig.authMaxRequests,
   message: {
      error: 'rate_limit_exceeded',
      error_description: 'Too many authentication attempts from this IP, please try again later.'
   },
   standardHeaders: true,
   legacyHeaders: false,
   handler: (req, res) => {
      log.warn({
         ip: req.ip,
         path: req.path,
         userAgent: req.get('User-Agent')
      }, 'Authentication rate limit exceeded');
      
      res.status(429).json({
         error: 'rate_limit_exceeded',
         error_description: 'Too many authentication attempts from this IP, please try again later.'
      });
   }
});

// OAuth rate limiting (more lenient for OAuth flows)
export const oauthRateLimit = rateLimit({
   windowMs: rateLimitConfig.windowMs,
   max: rateLimitConfig.oauthMaxRequests,
   message: {
      error: 'rate_limit_exceeded',
      error_description: 'Too many OAuth requests from this IP, please try again later.'
   },
   standardHeaders: true,
   legacyHeaders: false,
   handler: (req, res) => {
      log.warn({
         ip: req.ip,
         path: req.path,
         userAgent: req.get('User-Agent')
      }, 'OAuth rate limit exceeded');
      
      res.status(429).json({
         error: 'rate_limit_exceeded',
         error_description: 'Too many OAuth requests from this IP, please try again later.'
      });
   }
});

// Token endpoint rate limiting
export const tokenRateLimit = rateLimit({
   windowMs: rateLimitConfig.windowMs,
   max: rateLimitConfig.tokenMaxRequests,
   message: {
      error: 'rate_limit_exceeded',
      error_description: 'Too many token requests from this IP, please try again later.'
   },
   standardHeaders: true,
   legacyHeaders: false,
   handler: (req, res) => {
      log.warn({
         ip: req.ip,
         path: req.path,
         userAgent: req.get('User-Agent')
      }, 'Token rate limit exceeded');
      
      res.status(429).json({
         error: 'rate_limit_exceeded',
         error_description: 'Too many token requests from this IP, please try again later.'
      });
   }
});
