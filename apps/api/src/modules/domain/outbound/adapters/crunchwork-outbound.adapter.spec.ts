import { CrunchworkOutboundAdapter } from './crunchwork-outbound.adapter';
import { OutboundPartialSuccessError } from '../outbound-adapter.interface';
import type { CrunchworkService } from '../../../../crunchwork/crunchwork.service';

const CW_QUOTE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CW_INVOICE_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const CW_PROGRESS_ID = 'cccccccc-3333-4333-8333-cccccccccccc';

describe('CrunchworkOutboundAdapter.push invoice publish', () => {
  let createInvoice: jest.Mock;
  let updateInvoice: jest.Mock;
  let getInvoice: jest.Mock;
  let createProgressInvoice: jest.Mock;
  let updateProgressInvoice: jest.Mock;
  let adapter: CrunchworkOutboundAdapter;

  beforeEach(() => {
    createInvoice = jest.fn();
    updateInvoice = jest.fn();
    getInvoice = jest.fn();
    createProgressInvoice = jest.fn();
    updateProgressInvoice = jest.fn();
    adapter = new CrunchworkOutboundAdapter({
      createInvoice,
      updateInvoice,
      getInvoice,
      createProgressInvoice,
      updateProgressInvoice,
    } as unknown as CrunchworkService);
  });

  it('creates a progress invoice for partial claims', async () => {
    createProgressInvoice.mockResolvedValue({
      id: CW_PROGRESS_ID,
      total: 165,
      totalTax: 15,
    });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-1',
      action: 'publish',
      payload: {
        cwInvoiceKind: 'progress',
        purchaseOrderId: 'po-cw',
        total: 165,
        totalTax: 15,
        vendorInvoiceNumber: 'INV-200009',
        issueDate: '2026-09-10T00:00:00.000Z',
        note: 'Progress 1',
      },
    });

    expect(createProgressInvoice).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      body: {
        purchaseOrderId: 'po-cw',
        total: 165,
        totalTax: 15,
        invoiceNumber: 'INV-200009',
        issueDate: '2026-09-10T00:00:00.000Z',
        comments: 'Progress 1',
      },
    });
    expect(createInvoice).not.toHaveBeenCalled();
    expect(updateInvoice).not.toHaveBeenCalled();
    expect(result.externalReference).toBe(CW_PROGRESS_ID);
  });

  it('updates an existing progress invoice on re-publish', async () => {
    updateProgressInvoice.mockResolvedValue({
      id: CW_PROGRESS_ID,
      total: 180,
    });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-1',
      action: 'publish',
      payload: {
        cwInvoiceKind: 'progress',
        reusedCwInvoiceId: CW_PROGRESS_ID,
        purchaseOrderId: 'po-cw',
        total: 180,
        totalTax: 16.36,
        vendorInvoiceNumber: 'INV-200009',
      },
    });

    expect(updateProgressInvoice).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      progressInvoiceId: CW_PROGRESS_ID,
      body: expect.objectContaining({
        purchaseOrderId: 'po-cw',
        total: 180,
        totalTax: 16.36,
        invoiceNumber: 'INV-200009',
      }),
    });
    expect(createProgressInvoice).not.toHaveBeenCalled();
    expect(result.externalReference).toBe(CW_PROGRESS_ID);
  });

  it('reclassifies a stale vendorTax outbox payload to progress-invoices when total < billable', async () => {
    createProgressInvoice.mockResolvedValue({
      id: CW_PROGRESS_ID,
      total: 165,
      totalTax: 15,
    });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-partial',
      action: 'publish',
      payload: {
        // Stale retries from before progress routing still say vendorTax
        cwInvoiceKind: 'vendorTax',
        purchaseOrderId: 'po-cw',
        vendorInvoiceNumber: 'INV-PARTIAL',
        total: 165,
        localGroups: [
          {
            items: [
              {
                id: 'i1',
                name: 'description',
                unitCost: 300,
                quantity: 1,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 0,
              },
            ],
          },
        ],
      },
    });

    expect(createProgressInvoice).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      body: expect.objectContaining({
        purchaseOrderId: 'po-cw',
        invoiceNumber: 'INV-PARTIAL',
      }),
    });
    expect(createInvoice).not.toHaveBeenCalled();
    expect(result.externalReference).toBe(CW_PROGRESS_ID);
  });

  it('keeps the vendor-tax create+update path for full invoices', async () => {
    createInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              name: 'description',
              unitCost: 300,
              quantity: 1,
              tax: 10,
              markupType: 'Percentage',
              markupValue: 0,
            },
          ],
        },
      ],
    });
    updateInvoice.mockResolvedValue({ id: CW_INVOICE_ID, total: 330 });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-full',
      action: 'publish',
      payload: {
        cwInvoiceKind: 'vendorTax',
        purchaseOrderId: 'po-cw',
        vendorInvoiceNumber: 'INV-FULL',
        issueDate: '2026-09-10T00:00:00.000Z',
        localGroups: [
          {
            items: [
              {
                name: 'description',
                unitCost: 300,
                quantity: 1,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 0,
              },
            ],
          },
        ],
      },
    });

    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(createProgressInvoice).not.toHaveBeenCalled();
    expect(updateInvoice).toHaveBeenCalledTimes(1);
    expect(result.externalReference).toBe(CW_INVOICE_ID);
  });
});

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
