export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.spec.ts',
    '<rootDir>/tests/**/*.test.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
    '!tests/**/*.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^oidc-provider$': '<rootDir>/tests/__mocks__/oidc-provider.ts'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@morezero|@upstash)/)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/dist/',
    '<rootDir>/test/' // Ignore the old integration test directory
  ],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  setupFilesAfterEnv: ['<rootDir>/tests/test-setup.ts']
};
