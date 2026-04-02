import request from 'supertest';
import express from 'express';
import { securityHeaders } from '../../../src/middleware/security';

const app = express();
app.use(securityHeaders);
app.get('/test', (req, res) => res.json({ message: 'test' }));

describe('Security Middleware', () => {
  it('should set security headers', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
    expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
    expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    expect(response.headers).toHaveProperty('referrer-policy', 'strict-origin-when-cross-origin');
  });

  it('should set CSP header', async () => {
    const response = await request(app)
      .get('/test')
      .expect(200);

    expect(response.headers).toHaveProperty('content-security-policy');
    expect(response.headers['content-security-policy']).toContain("default-src 'self'");
  });

  it('should set HSTS header for HTTPS', async () => {
    // Mock HTTPS request
    const response = await request(app)
      .get('/test')
      .set('x-forwarded-proto', 'https')
      .expect(200);

    expect(response.headers).toHaveProperty('strict-transport-security');
  });
});
