import { CrunchworkOutboundAdapter } from './crunchwork-outbound.adapter';
import { OutboundPartialSuccessError } from '../outbound-adapter.interface';
import type { CrunchworkService } from '../../../../crunchwork/crunchwork.service';

const CW_QUOTE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';

describe('CrunchworkOutboundAdapter.push quote publish', () => {
  let createQuote: jest.Mock;
  let updateQuote: jest.Mock;
  let adapter: CrunchworkOutboundAdapter;

  beforeEach(() => {
    createQuote = jest.fn();
    updateQuote = jest.fn();
    adapter = new CrunchworkOutboundAdapter({
      createQuote,
      updateQuote,
    } as unknown as CrunchworkService);
  });

  it('creates the quote then updates status to Published', async () => {
    createQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Draft', externalReference: 'Draft' },
    });
    updateQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Published', externalReference: 'Published' },
    });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'quote',
      entityId: 'quote-1',
      action: 'publish',
      payload: {
        createBody: { name: 'Estimate 1' },
        publishBody: { status: { name: 'Published', externalReference: 'Published' } },
      },
    });

    expect(createQuote).toHaveBeenCalledTimes(1);
    expect(updateQuote).toHaveBeenCalledTimes(1);
    expect(updateQuote).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      quoteId: CW_QUOTE_ID,
      body: { status: { name: 'Published', externalReference: 'Published' } },
    });
    expect(result.externalReference).toBe(CW_QUOTE_ID);
  });

  it('copies fromCompanyRegistrationNumber from create onto the publish update', async () => {
    createQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Draft', externalReference: 'Draft' },
    });
    updateQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Published', externalReference: 'Published' },
    });

    await adapter.push({
      connectionId: 'conn-1',
      entityType: 'quote',
      entityId: 'quote-1',
      action: 'publish',
      payload: {
        createBody: {
          name: 'Estimate 1',
          fromCompanyRegistrationNumber: '51824753556',
          fromName: 'Ensure Construction',
        },
        publishBody: { status: { name: 'Published', externalReference: 'Published' } },
      },
    });

    expect(updateQuote).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      quoteId: CW_QUOTE_ID,
      body: {
        status: { name: 'Published', externalReference: 'Published' },
        fromCompanyRegistrationNumber: '51824753556',
        fromName: 'Ensure Construction',
      },
    });
  });

  it('skips create when cwQuoteId is already on the payload', async () => {
    updateQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Published', externalReference: 'Published' },
    });

    await adapter.push({
      connectionId: 'conn-1',
      entityType: 'quote',
      entityId: 'quote-1',
      action: 'publish',
      payload: {
        cwQuoteId: CW_QUOTE_ID,
        createBody: { name: 'Estimate 1' },
        publishBody: { status: { name: 'Published', externalReference: 'Published' } },
      },
    });

    expect(createQuote).not.toHaveBeenCalled();
    expect(updateQuote).toHaveBeenCalledTimes(1);
    expect(updateQuote).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      quoteId: CW_QUOTE_ID,
      body: { status: { name: 'Published', externalReference: 'Published' } },
    });
  });

  it('persists the created quote id so a later retry does not create again', async () => {
    createQuote.mockResolvedValue({
      id: CW_QUOTE_ID,
      status: { name: 'Draft', externalReference: 'Draft' },
    });
    updateQuote
      .mockRejectedValueOnce(new Error('status update failed'))
      .mockResolvedValueOnce({
        id: CW_QUOTE_ID,
        status: { name: 'Published', externalReference: 'Published' },
      });

    const persistProgress = jest.fn().mockResolvedValue(undefined);

    await expect(
      adapter.push({
        connectionId: 'conn-1',
        entityType: 'quote',
        entityId: 'quote-1',
        action: 'publish',
        payload: {
          createBody: { name: 'Estimate 1' },
          publishBody: { status: 'Published' },
        },
        persistProgress,
      }),
    ).rejects.toBeInstanceOf(OutboundPartialSuccessError);

    expect(createQuote).toHaveBeenCalledTimes(1);
    expect(persistProgress).toHaveBeenCalledTimes(1);
    const progress = persistProgress.mock.calls[0][0] as {
      nextPayload: Record<string, unknown>;
      result: { externalReference?: string };
    };
    expect(progress.result.externalReference).toBe(CW_QUOTE_ID);
    expect(progress.nextPayload.cwQuoteId).toBe(CW_QUOTE_ID);

    await adapter.push({
      connectionId: 'conn-1',
      entityType: 'quote',
      entityId: 'quote-1',
      action: 'publish',
      payload: progress.nextPayload,
    });

    expect(createQuote).toHaveBeenCalledTimes(1);
    expect(updateQuote).toHaveBeenCalledTimes(2);
  });
});
