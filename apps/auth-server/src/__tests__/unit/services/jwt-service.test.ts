import { JwtService } from '../../../src/services/jwt-service';

describe('JwtService', () => {
  let jwtService: JwtService;

  beforeEach(() => {
    jwtService = new JwtService();
  });

  describe('generateApiToken', () => {
    it('should generate an API token with user data using JWKS', async () => {
      const user = {
        userId: '123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123'
      };
      const token = await jwtService.generateApiToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should generate an API token with additional user data using JWKS', async () => {
      const user = {
        userId: '123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123',
        compName: 'Test Company',
        compId: 'comp-123',
        isAdmin: true,
        roleInCompany: 'Manager',
        avatarURL: 'https://example.com/avatar.jpg',
        phone: '+1234567890'
      };
      const token = await jwtService.generateApiToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });

    it('should throw error for invalid user data', async () => {
      await expect(async () => {
        await jwtService.generateApiToken(null as any);
      }).rejects.toThrow();
    });
  });

  describe('verifyToken', () => {
    it('should throw error as verification is now done via JWKS', () => {
      expect(() => {
        jwtService.verifyToken('any-token');
      }).toThrow('Token verification should be done via JWKS endpoint');
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', async () => {
      const user = {
        userId: '123',
        email: 'test@example.com',
        name: 'Test User',
        organizationId: 'org-123'
      };
      const token = await jwtService.generateApiToken(user);
      const decoded = jwtService.decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded.sub).toBe('123');
      expect(decoded.email).toBe('test@example.com');
    });

    it('should throw error for invalid token format', () => {
      expect(() => {
        jwtService.decodeToken('invalid-token');
      }).toThrow();
    });
  });
});
