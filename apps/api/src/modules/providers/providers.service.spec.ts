import { NotFoundException } from '@nestjs/common';
import { ProvidersService } from './providers.service';

describe('ProvidersService', () => {
  const tenantId = '00000000-0000-0000-0000-00000000aaaa';

  function makeService(overrides: {
    connections?: Partial<{
      findByTenantAndProviderCode: jest.Mock;
      findByProviderCode: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    }>;
    events?: Partial<{
      countByProviderCode: jest.Mock;
      countErrorsByProviderCode: jest.Mock;
      lastEventAtByProviderCode: jest.Mock;
      findByProviderCode: jest.Mock;
    }>;
  } = {}) {
    const connectionsRepo = {
      findByTenantAndProviderCode: jest.fn().mockResolvedValue([]),
      findByProviderCode: jest.fn().mockResolvedValue([]),
      findById: jest.fn().mockResolvedValue(null),
      findAll: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
      ...overrides.connections,
    };
    const webhookEventsRepo = {
      countByProviderCode: jest.fn().mockResolvedValue(0),
      countErrorsByProviderCode: jest.fn().mockResolvedValue(0),
      lastEventAtByProviderCode: jest.fn().mockResolvedValue(null),
      findByProviderCode: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      countByConnectionId: jest.fn().mockResolvedValue(0),
      countErrorsByConnectionId: jest.fn().mockResolvedValue(0),
      lastEventAtByConnectionId: jest.fn().mockResolvedValue(null),
      findByConnectionId: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      ...overrides.events,
    };
    const cipher = {
      encryptJson: jest.fn().mockReturnValue('enc:json'),
      encrypt: jest.fn().mockReturnValue('enc:secret'),
      decrypt: jest.fn().mockReturnValue('plain'),
    };

    return {
      service: new ProvidersService(
        connectionsRepo as never,
        webhookEventsRepo as never,
        cipher as never,
      ),
      connectionsRepo,
      webhookEventsRepo,
    };
  }

  describe('findAll', () => {
    it('returns one summary per registry entry keyed by providerCode', async () => {
      const { service, webhookEventsRepo, connectionsRepo } = makeService({
        events: {
          countByProviderCode: jest.fn().mockResolvedValue(7),
          countErrorsByProviderCode: jest.fn().mockResolvedValue(2),
          lastEventAtByProviderCode: jest
            .fn()
            .mockResolvedValue(new Date('2026-01-02T03:04:05Z')),
        },
        connections: {
          findByTenantAndProviderCode: jest.fn().mockResolvedValue([{ id: 'c1' }]),
        },
      });

      const result = await service.findAll(tenantId);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'crunchwork',
        code: 'crunchwork',
        name: 'Crunchwork',
        connectionCount: 1,
        totalWebhookEvents: 7,
        recentErrorCount: 2,
        lastEventAt: '2026-01-02T03:04:05.000Z',
      });
      expect(connectionsRepo.findByTenantAndProviderCode).toHaveBeenCalledWith({
        tenantId,
        providerCode: 'crunchwork',
      });
      expect(webhookEventsRepo.countByProviderCode).toHaveBeenCalledWith({
        tenantId,
        providerCode: 'crunchwork',
      });
    });
  });

  describe('findOne', () => {
    it('returns the registry entry merged with connections', async () => {
      const { service } = makeService({
        connections: {
          findByTenantAndProviderCode: jest.fn().mockResolvedValue([
            { id: 'conn-1', providerCode: 'crunchwork' },
          ]),
        },
      });

      const result = await service.findOne({
        code: 'crunchwork',
        tenantId,
      });

      expect(result.code).toBe('crunchwork');
      expect(result.connections).toHaveLength(1);
    });

    it('throws NotFoundException for unknown providers', async () => {
      const { service } = makeService();
      await expect(
        service.findOne({ code: 'unknown', tenantId }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('createConnection', () => {
    it('rejects unknown provider codes', async () => {
      const { service } = makeService();
      await expect(
        service.createConnection({
          providerCode: 'nope',
          tenantId,
          dto: { name: 'x', environment: 'staging', baseUrl: 'https://x' },
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
