import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookSweepService } from './webhook-sweep.service';
import { ConnectionResolverService } from '../external/connection-resolver.service';
import { WebhooksService } from './webhooks.service';
import type { DrizzleDB } from '../../database/drizzle.module';

describe('WebhookSweepService', () => {
  const emptyQuery = () => {
    const q: Record<string, jest.Mock> = {};
    q.from = jest.fn(() => q);
    q.where = jest.fn(() => q);
    q.limit = jest.fn(() => q);
    q.orderBy = jest.fn(() => q);
    q.for = jest.fn().mockResolvedValue([]);
    return q;
  };

  const buildService = (params: { db: DrizzleDB }) => {
    const config = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    } as unknown as ConfigService;
    const connectionResolver = {} as ConnectionResolverService;
    const webhooksService = {
      processEventAsync: jest.fn(),
    } as unknown as WebhooksService;
    return new WebhookSweepService(
      config,
      connectionResolver,
      webhooksService,
      params.db,
    );
  };

  it('WebhookSweepService.sweep — missing table does not reject and the next tick can run', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const select = jest
      .fn()
      .mockImplementationOnce(() => {
        throw Object.assign(new Error('relation "inbound_webhook_events" does not exist'), {
          code: '42P01',
        });
      })
      .mockImplementation(() => emptyQuery());
    const service = buildService({ db: { select } as unknown as DrizzleDB });

    await expect(service.sweep()).resolves.toEqual({
      resolved: 0,
      reprocessed: 0,
      redriven: 0,
      failed: 0,
    });
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('WebhookSweepService.sweep — unexpected error:'),
    );

    await expect(service.sweep()).resolves.toEqual({
      resolved: 0,
      reprocessed: 0,
      redriven: 0,
      failed: 0,
    });
    expect(select).toHaveBeenCalledTimes(4);

    logSpy.mockRestore();
  });
});
