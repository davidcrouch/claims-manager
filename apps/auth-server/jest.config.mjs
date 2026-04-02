export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/__tests__/**/*.spec.ts',
    '<rootDir>/src/__tests__/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!src/__tests__/**/*.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^oidc-provider$': '<rootDir>/src/__tests__/__mocks__/oidc-provider.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@morezero|@upstash)/)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/dist/'
  ],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/test-setup.ts']
};
