export const createLogger = jest.fn(() => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

export const LOGGER_FACTORY = 'LOGGER_FACTORY';
