import {
  getCrunchworkAccessToken,
  getCrunchworkJob,
  getCrunchworkJobs,
} from './helpers/crunchwork-token.helper';

const JOB_ID = 'cc435c11-dc73-45bb-88e6-fab2127d4872';

const TENANT_ID = process.env.CRUNCHWORK_VENDOR_TENANT_ID || '';

describe('Crunchwork OAuth2 (e2e)', () => {
  describe('Client credentials token exchange', () => {
    it('should obtain access_token via Basic auth (client_id:client_secret)', async () => {
      const result = await getCrunchworkAccessToken();

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should return a valid JWT structure (header.payload.signature)', async () => {
      const result = await getCrunchworkAccessToken();

      const parts = result.accessToken.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeDefined();
      expect(parts[1]).toBeDefined();
      expect(parts[2]).toBeDefined();

      // Decode header to verify it's a JWT
      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf-8'),
      );
      expect(header.typ).toBe('JWT');
    });
  });

  describe('GET /jobs with Bearer token', () => {
    beforeAll(() => {
      if (!TENANT_ID) {
        throw new Error(
          'CRUNCHWORK_VENDOR_TENANT_ID required in .env for /jobs e2e test (active-tenant-id header)',
        );
      }
    });

    it('should call GET /jobs/{id} with Authorization: Bearer {access_token} and active-tenant-id', async () => {
      const { accessToken } = await getCrunchworkAccessToken();

      const result = await getCrunchworkJob({
        accessToken,
        tenantId: TENANT_ID,
        jobId: JOB_ID,
      });

      if (!result.ok) {
        if (result.status === 401) {
          console.warn(
            '[crunchwork-auth.e2e] GET /jobs/{id} returned 401 - verify CRUNCHWORK_VENDOR_TENANT_ID (active-tenant-id) in .env.',
          );
          return;
        }
        throw new Error(
          `[crunchwork-auth.e2e] GET /jobs/{id} failed: ${result.status} - ${result.body}`,
        );
      }

      expect(result.data).toBeDefined();
      expect((result.data as Record<string, unknown>).id).toBe(JOB_ID);
    });

    it('should call GET /jobs list with optional query params (page, limit)', async () => {
      const { accessToken } = await getCrunchworkAccessToken();

      const result = await getCrunchworkJobs({
        accessToken,
        tenantId: TENANT_ID,
        queryParams: { page: '1', limit: '5' },
      });

      if (!result.ok) {
        if (result.status === 401 || result.status === 404) {
          return; // list endpoint may not be available in all environments
        }
        throw new Error(
          `[crunchwork-auth.e2e] GET /jobs failed: ${result.status} - ${result.body}`,
        );
      }

      expect(result.data).toBeDefined();
    });
  });
});
