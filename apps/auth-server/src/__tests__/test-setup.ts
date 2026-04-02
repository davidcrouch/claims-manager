// Test setup file for auth-server
import dotenv from 'dotenv';

// Load test environment variables (fallback to .env if .env.test doesn't exist)
try {
  dotenv.config({ path: '.env.test' });
} catch (error) {
  // Fallback to .env file
  dotenv.config();
}

// Mock console methods to reduce noise during tests
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock the local logger to prevent actual logging during tests
jest.mock('../lib/logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  LoggerType: { NODEJS: 'nodejs', BROWSER: 'browser', EDGE: 'edge' },
}));

// Mock external services
jest.mock('@upstash/redis', () => ({
  Redis: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
  })),
}));

// Mock OIDC Provider
jest.mock('oidc-provider', () => {
  return {
    Provider: jest.fn().mockImplementation(() => ({
      callback: jest.fn(),
      interactionDetails: jest.fn(),
      interactionFinished: jest.fn(),
      on: jest.fn(),
      adapter: jest.fn(() => ({
        upsert: jest.fn(),
        find: jest.fn(),
        destroy: jest.fn(),
        revokeByGrantId: jest.fn(),
        consume: jest.fn(),
      })),
    })),
  };
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.DCR_IAT_SIGNING_KEY = 'test-iat-signing-key-for-testing-only';
process.env.OIDC_ISSUER = 'http://localhost:3280';
process.env.UPSTASH_REDIS_REST_URL = 'redis://localhost:6379';
process.env.MOREZERO_NODEJS_API_URL = 'http://localhost:3001';

// Global test timeout
jest.setTimeout(10000);