import request from 'supertest';
import { createServer } from '../../../src/server.js';

describe('OAuth Flow Integration Tests', () => {
  let app: any;
  let server: any;

  beforeAll(async () => {
    const serverInstance = await createServer();
    app = serverInstance.app;
    server = serverInstance.server;
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('OAuth Discovery', () => {
    it('should return OAuth discovery document', async () => {
      const response = await request(app)
        .get('/.well-known/oauth-authorization-server')
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('registration_endpoint');
    });

    it('should return OIDC discovery document', async () => {
      const response = await request(app)
        .get('/.well-known/openid_configuration')
        .expect(200);

      expect(response.body).toHaveProperty('issuer');
      expect(response.body).toHaveProperty('authorization_endpoint');
      expect(response.body).toHaveProperty('token_endpoint');
      expect(response.body).toHaveProperty('userinfo_endpoint');
    });
  });

  describe('Client Registration', () => {
    it('should register a new client with IAT', async () => {
      // First, get an IAT token (this would normally require a valid user token)
      const iatResponse = await request(app)
        .post('/oauth/initial-access-token')
        .send({ userToken: 'mock-user-token' })
        .expect(200);

      const iatToken = iatResponse.body.initial_access_token;

      // Register a new client
      const clientData = {
        client_name: 'Test MCP Client',
        grant_types: ['client_credentials'],
        scope: 'mcp:read mcp:write mcp:invoke',
        token_endpoint_auth_method: 'client_secret_basic'
      };

      const response = await request(app)
        .post('/reg')
        .set('Authorization', `Bearer ${iatToken}`)
        .send(clientData)
        .expect(201);

      expect(response.body).toHaveProperty('client_id');
      expect(response.body).toHaveProperty('client_secret');
      expect(response.body).toHaveProperty('client_name', 'Test MCP Client');
      expect(response.body).toHaveProperty('grant_types');
      expect(response.body).toHaveProperty('scope');
    });

    it('should reject client registration without IAT', async () => {
      const clientData = {
        client_name: 'Test MCP Client',
        grant_types: ['client_credentials'],
        scope: 'mcp:read mcp:write mcp:invoke'
      };

      const response = await request(app)
        .post('/reg')
        .send(clientData)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Token Exchange', () => {
    it('should exchange client credentials for access token', async () => {
      // First register a client
      const iatResponse = await request(app)
        .post('/oauth/initial-access-token')
        .send({ userToken: 'mock-user-token' })
        .expect(200);

      const iatToken = iatResponse.body.initial_access_token;

      const clientResponse = await request(app)
        .post('/reg')
        .set('Authorization', `Bearer ${iatToken}`)
        .send({
          client_name: 'Test MCP Client',
          grant_types: ['client_credentials'],
          scope: 'mcp:read mcp:write mcp:invoke',
          token_endpoint_auth_method: 'client_secret_basic'
        })
        .expect(201);

      const { client_id, client_secret } = clientResponse.body;

      // Exchange credentials for token
      const tokenResponse = await request(app)
        .post('/token')
        .set('Authorization', `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`)
        .send({
          grant_type: 'client_credentials',
          scope: 'mcp:read mcp:write mcp:invoke'
        })
        .expect(200);

      expect(tokenResponse.body).toHaveProperty('access_token');
      expect(tokenResponse.body).toHaveProperty('token_type', 'Bearer');
      expect(tokenResponse.body).toHaveProperty('expires_in');
      expect(tokenResponse.body).toHaveProperty('scope');
    });

    it('should reject invalid client credentials', async () => {
      const response = await request(app)
        .post('/token')
        .set('Authorization', 'Basic invalid-credentials')
        .send({
          grant_type: 'client_credentials',
          scope: 'mcp:read'
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});
