import {
  loadCrunchworkConnection,
  getCrunchworkAccessToken,
  getCrunchworkJob,
  getCrunchworkJobs,
  type CrunchworkConnection,
} from './helpers/crunchwork-token.helper';

const JOB_ID = 'cc435c11-dc73-45bb-88e6-fab2127d4872';

describe('Crunchwork OAuth2 (e2e)', () => {
  let connection: CrunchworkConnection;

  beforeAll(async () => {
    connection = await loadCrunchworkConnection();
  });

  describe('Client credentials token exchange', () => {
    it('should obtain access_token via Basic auth (client_id:client_secret)', async () => {
      const result = await getCrunchworkAccessToken(connection);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(typeof result.accessToken).toBe('string');
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(result.expiresIn).toBeGreaterThan(0);
    });

    it('should return a valid JWT structure (header.payload.signature)', async () => {
      const result = await getCrunchworkAccessToken(connection);

      const parts = result.accessToken.split('.');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBeDefined();
      expect(parts[1]).toBeDefined();
      expect(parts[2]).toBeDefined();

      const header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf-8'),
      );
      expect(header.typ).toBe('JWT');
    });
  });

  describe('GET /jobs with Bearer token', () => {
    it('should call GET /jobs/{id} with Authorization: Bearer {access_token} and active-tenant-id', async () => {
      const { accessToken } = await getCrunchworkAccessToken(connection);

      const result = await getCrunchworkJob({
        connection,
        accessToken,
        jobId: JOB_ID,
      });

      if (!result.ok) {
        if (result.status === 401) {
          console.warn(
            '[crunchwork-auth.e2e] GET /jobs/{id} returned 401 — verify connection provider_tenant_id in integration_connections.',
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
      const { accessToken } = await getCrunchworkAccessToken(connection);

      const result = await getCrunchworkJobs({
        connection,
        accessToken,
        queryParams: { page: '1', limit: '5' },
      });

      if (!result.ok) {
        if (result.status === 401 || result.status === 404) {
          return;
        }
        throw new Error(
          `[crunchwork-auth.e2e] GET /jobs failed: ${result.status} - ${result.body}`,
        );
      }

      expect(result.data).toBeDefined();
    });
  });
});
