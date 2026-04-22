import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { More0Service } from './more0.service';

describe('More0Service.invokeViaGateway', () => {
  let service: More0Service;

  function buildService(overrides: Partial<Record<string, unknown>> = {}) {
    const values: Record<string, unknown> = {
      'more0.registryUrl': 'http://localhost:3201',
      'more0.gatewayUrl': 'http://gateway.local:3205',
      'more0.appKey': 'claims-manager-webhook',
      'more0.organizationId': 'claims-manager-webhook',
      'more0.apiKey': 'test-api-key',
      'more0.enabled': true,
      ...overrides,
    };
    const configService = {
      get: jest.fn((key: string, fallback?: unknown) =>
        values[key] ?? fallback,
      ),
    } as unknown as ConfigService;
    return new More0Service(configService);
  }

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('POSTs to ${gatewayUrl}/api/v1/invoke with cap/method/params and x-organization-id', async () => {
    service = buildService();
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue({
        ok: true,
        headers: new Headers(),
        json: async () => ({ runId: 'run-123', status: 'running' }),
        text: async () => '',
      } as unknown as Response);

    const result = await service.invokeViaGateway({
      cap: 'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event',
      method: 'execute',
      params: { eventId: 'evt-1' },
    });

    expect(result).toEqual({ runId: 'run-123', status: 'running' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://gateway.local:3205/api/v1/invoke');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['x-organization-id']).toBe('claims-manager-webhook');
    expect(headers.Authorization).toBe('Bearer test-api-key');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      cap: 'claims-manager-webhook/workflow.claims-manager-webhook.process-inbound-event',
      method: 'execute',
      params: { eventId: 'evt-1' },
    });
  });

  it('uses mock mode when disabled — returns synthetic runId without calling fetch', async () => {
    service = buildService({ 'more0.enabled': false });
    const fetchMock = jest.spyOn(globalThis, 'fetch');

    const result = await service.invokeViaGateway({
      cap: 'claims-manager-webhook/workflow.x',
      method: 'execute',
      params: { eventId: 'evt-1' },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.status).toBe('mocked');
    expect(result.runId).toMatch(/^mock-/);
  });

  it('surfaces HTTP error bodies', async () => {
    service = buildService();
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'gateway unavailable',
      json: async () => ({}),
      headers: new Headers(),
    } as unknown as Response);

    await expect(
      service.invokeViaGateway({
        cap: 'claims-manager-webhook/workflow.x',
        method: 'execute',
        params: { eventId: 'evt-1' },
      }),
    ).rejects.toThrow(/HTTP 503.*gateway unavailable/);
  });
});
