import { CrunchworkOutboundAdapter } from './crunchwork-outbound.adapter';
import { OutboundPartialSuccessError } from '../outbound-adapter.interface';
import type { CrunchworkService } from '../../../../crunchwork/crunchwork.service';

const CW_QUOTE_ID = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const CW_INVOICE_ID = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';

describe('CrunchworkOutboundAdapter.push invoice publish', () => {
  let createInvoice: jest.Mock;
  let updateInvoice: jest.Mock;
  let getInvoice: jest.Mock;
  let getPurchaseOrder: jest.Mock;
  let getJobInvoices: jest.Mock;
  let adapter: CrunchworkOutboundAdapter;

  beforeEach(() => {
    createInvoice = jest.fn();
    updateInvoice = jest.fn();
    getInvoice = jest.fn();
    getPurchaseOrder = jest.fn();
    getJobInvoices = jest.fn();
    adapter = new CrunchworkOutboundAdapter({
      createInvoice,
      updateInvoice,
      getInvoice,
      getPurchaseOrder,
      getJobInvoices,
    } as unknown as CrunchworkService);
  });

  it('updates the linked CW invoice when sibling id is on the payload (2nd claim)', async () => {
    getInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
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
    updateInvoice.mockResolvedValue({ id: CW_INVOICE_ID, total: 240 });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-2',
      action: 'publish',
      payload: {
        reusedCwInvoiceId: CW_INVOICE_ID,
        purchaseOrderId: 'po-cw',
        vendorInvoiceNumber: 'INV-200016',
        localGroups: [
          {
            items: [
              {
                id: 'i1',
                unitCost: 300,
                quantity: 1,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 0,
              },
            ],
          },
        ],
        invoicedAmounts: { 'id:i1': 239.98 },
      },
    });

    expect(createInvoice).not.toHaveBeenCalled();
    expect(updateInvoice).toHaveBeenCalledTimes(1);
    expect(updateInvoice.mock.calls[0][0].body.status).toEqual({
      externalReference: 'Submitted',
    });
    expect(result.externalReference).toBe(CW_INVOICE_ID);
  });

  it('discovers linked invoice via job invoices when create is blocked', async () => {
    createInvoice.mockRejectedValue(
      new Error(
        'Unable to create a new vendor tax invoice, as Partial Invoicing is not enabled and there is already a linked invoice that is not cancelled.',
      ),
    );
    getPurchaseOrder.mockResolvedValue({
      id: 'po-cw',
      jobId: 'job-cw',
      invoices: [],
    });
    getJobInvoices.mockResolvedValue([
      { id: CW_INVOICE_ID, purchaseOrderId: 'po-cw', total: 110 },
    ]);
    getInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              unitCost: 100,
              quantity: 1,
              tax: 10,
              markupType: 'Percentage',
              markupValue: 0,
            },
          ],
        },
      ],
    });
    updateInvoice.mockResolvedValue({ id: CW_INVOICE_ID, total: 240 });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-2',
      action: 'publish',
      payload: {
        purchaseOrderId: 'po-cw',
        localGroups: [
          {
            items: [
              {
                id: 'i1',
                unitCost: 300,
                quantity: 1,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 0,
              },
            ],
          },
        ],
        invoicedAmounts: { 'id:i1': 239.98 },
      },
    });

    expect(getJobInvoices).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      jobId: 'job-cw',
    });
    expect(updateInvoice).toHaveBeenCalledTimes(1);
    expect(result.externalReference).toBe(CW_INVOICE_ID);
  });

  it('throws a clear error when discovery fails with auth (Vendor connection)', async () => {
    createInvoice.mockRejectedValue(
      new Error(
        'Unable to create a new vendor tax invoice, as Partial Invoicing is not enabled and there is already a linked invoice that is not cancelled.',
      ),
    );
    getPurchaseOrder.mockResolvedValue({
      id: 'po-cw',
      jobId: 'job-cw',
      invoices: [],
    });
    getJobInvoices.mockRejectedValue(
      new Error('HTTP 500: {"errors":[{"message":"Not Authorised!"}]}'),
    );

    await expect(
      adapter.push({
        connectionId: 'conn-1',
        entityType: 'invoice',
        entityId: 'inv-3',
        action: 'publish',
        payload: {
          purchaseOrderId: 'po-cw',
          localGroups: [],
        },
      }),
    ).rejects.toThrow(/cannot discover existing cw vendor-tax invoice/i);

    expect(getJobInvoices).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      jobId: 'job-cw',
    });
  });

  it('discovers vendor-tax invoice from PO vendorTaxInvoices field', async () => {
    createInvoice.mockRejectedValue(
      new Error(
        'Unable to create a new vendor tax invoice, as Partial Invoicing is not enabled and there is already a linked invoice that is not cancelled.',
      ),
    );
    getPurchaseOrder.mockResolvedValue({
      id: 'po-cw',
      jobId: 'job-cw',
      invoices: [],
      vendorTaxInvoices: [{ id: CW_INVOICE_ID, purchaseOrderId: 'po-cw' }],
    });
    getInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      groups: [
        {
          id: 'g1',
          items: [
            { id: 'i1', unitCost: 100, quantity: 1, tax: 10, markupType: 'Percentage', markupValue: 0 },
          ],
        },
      ],
    });
    updateInvoice.mockResolvedValue({ id: CW_INVOICE_ID, total: 110 });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-4',
      action: 'publish',
      payload: {
        purchaseOrderId: 'po-cw',
        localGroups: [
          { items: [{ id: 'i1', unitCost: 100, quantity: 1, tax: 10, markupType: 'Percentage', markupValue: 0 }] },
        ],
      },
    });

    expect(getJobInvoices).not.toHaveBeenCalled();
    expect(result.externalReference).toBe(CW_INVOICE_ID);
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
    expect(updateInvoice).toHaveBeenCalledTimes(1);
    expect(updateInvoice.mock.calls[0][0].body).toEqual(
      expect.objectContaining({
        status: { externalReference: 'Submitted' },
        vendorInvoiceNumber: 'INV-FULL',
        issueDate: '2026-09-10T00:00:00.000Z',
      }),
    );
    expect(result.externalReference).toBe(CW_INVOICE_ID);
  });

  it('sets CW invoice status to Submitted even when there are no local groups', async () => {
    createInvoice.mockResolvedValue({ id: CW_INVOICE_ID, groups: [] });
    updateInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      status: { name: 'Submitted', externalReference: 'Submitted' },
    });

    const result = await adapter.push({
      connectionId: 'conn-1',
      entityType: 'invoice',
      entityId: 'inv-status-only',
      action: 'publish',
      payload: {
        purchaseOrderId: 'po-cw',
        vendorInvoiceNumber: 'INV-STATUS',
      },
    });

    expect(createInvoice).toHaveBeenCalledTimes(1);
    expect(updateInvoice).toHaveBeenCalledWith({
      connectionId: 'conn-1',
      invoiceId: CW_INVOICE_ID,
      body: {
        status: { externalReference: 'Submitted' },
        vendorInvoiceNumber: 'INV-STATUS',
      },
    });
    expect(result.externalReference).toBe(CW_INVOICE_ID);
  });

  it('persists CW id when group update fails after create', async () => {
    createInvoice.mockResolvedValue({
      id: CW_INVOICE_ID,
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
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
    updateInvoice.mockRejectedValue(new Error('update failed'));
    const persistProgress = jest.fn().mockResolvedValue(undefined);

    await expect(
      adapter.push({
        connectionId: 'conn-1',
        entityType: 'invoice',
        entityId: 'inv-1',
        action: 'publish',
        payload: {
          purchaseOrderId: 'po-cw',
          localGroups: [
            {
              items: [
                {
                  id: 'i1',
                  unitCost: 300,
                  quantity: 1,
                  tax: 10,
                  markupType: 'Percentage',
                  markupValue: 0,
                },
              ],
            },
          ],
          invoicedAmounts: { 'id:i1': 99.99 },
        },
        persistProgress,
      }),
    ).rejects.toBeInstanceOf(OutboundPartialSuccessError);

    expect(persistProgress).toHaveBeenCalled();
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
    expect(result.externalReference).toBe(CW_QUOTE_ID);
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

    expect(persistProgress).toHaveBeenCalledTimes(1);
    const progress = persistProgress.mock.calls[0][0] as {
      nextPayload: Record<string, unknown>;
    };

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
