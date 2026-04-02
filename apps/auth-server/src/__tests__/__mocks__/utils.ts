export const EnvValidator = jest.fn().mockImplementation(() => ({
  validateService: jest.fn(() => true)
}));

export const EnvVarConfig = {};

export const validators = {
  isUrl: jest.fn((value: string) => value.startsWith('http')),
  isJwtSecret: jest.fn((value: string) => value.length >= 32),
  isNotEmpty: jest.fn((value: string) => value.length > 0),
  isPort: jest.fn((value: string) => {
    const port = parseInt(value, 10);
    return port >= 1 && port <= 65535;
  })
};
