import {
  applyInvoicedAmountOverridesToGroups,
  applyLocalPricingToCrunchworkInvoiceGroups,
  buildCrunchworkProgressInvoiceBody,
  buildCrunchworkVendorTaxInvoiceCreateBody,
  computeProgressInvoiceMoney,
  crunchworkInvoiceGroupsFromPayload,
  itemInclusiveLineTotal,
  mergeInvoicedAmountMaps,
  pickCrunchworkInvoiceIdForPurchaseOrder,
  preferExistingAmount,
  shouldUseCrunchworkProgressInvoice,
  sumLocalGroupsInclusiveTotal,
  toInvoiceUpdateGroups,
} from './invoice-publish.utils';

describe('preferExistingAmount', () => {
  it('keeps a local total when the provider returns 0', () => {
    expect(preferExistingAmount(0, '1526.29')).toBe('1526.29');
    expect(preferExistingAmount('0.00', '100')).toBe('100');
  });

  it('uses the provider total when it is non-zero', () => {
    expect(preferExistingAmount(88.5, '100')).toBe('88.5');
  });

  it('falls back to existing when the provider omits the field', () => {
    expect(preferExistingAmount(undefined, '42')).toBe('42');
    expect(preferExistingAmount(null, null)).toBeUndefined();
  });
});

describe('buildCrunchworkVendorTaxInvoiceCreateBody', () => {
  it('sends only CreateVendorTaxInvoiceInput fields', () => {
    expect(buildCrunchworkVendorTaxInvoiceCreateBody({ purchaseOrderId: 'po-1' })).toEqual({
      purchaseOrderId: 'po-1',
      invoiceType: { externalReference: 'Invoice' },
    });
  });
});

describe('buildCrunchworkProgressInvoiceBody', () => {
  it('builds CreateTradeInvoiceInput header fields', () => {
    expect(
      buildCrunchworkProgressInvoiceBody({
        purchaseOrderId: 'po-cw',
        invoiceNumber: 'INV-200009',
        issueDate: '2026-09-10T00:00:00.000Z',
        comments: 'Progress claim 1',
        total: 165,
        totalTax: 15,
      }),
    ).toEqual({
      purchaseOrderId: 'po-cw',
      invoiceNumber: 'INV-200009',
      issueDate: '2026-09-10T00:00:00.000Z',
      comments: 'Progress claim 1',
      total: 165,
      totalTax: 15,
    });
  });
});

describe('mergeInvoicedAmountMaps', () => {
  it('sums matching keys across sibling maps', () => {
    expect(
      mergeInvoicedAmountMaps([
        { 'id:i1': 109.99 },
        { 'id:i1': 129.99, 'id:i2': 10 },
      ]),
    ).toEqual({ 'id:i1': 239.98, 'id:i2': 10 });
  });
});

describe('shouldUseCrunchworkProgressInvoice', () => {
  it('uses progress when a sibling was already published', () => {
    expect(
      shouldUseCrunchworkProgressInvoice({
        invoiceTotal: 330,
        billableTotal: 330,
        hasPriorPublishedSibling: true,
      }),
    ).toBe(true);
  });

  it('uses progress when the invoice is short of the billable total', () => {
    expect(
      shouldUseCrunchworkProgressInvoice({
        invoiceTotal: 165,
        billableTotal: 330,
        hasPriorPublishedSibling: false,
      }),
    ).toBe(true);
  });

  it('uses vendor-tax for a full first claim', () => {
    expect(
      shouldUseCrunchworkProgressInvoice({
        invoiceTotal: 330,
        billableTotal: 330,
        hasPriorPublishedSibling: false,
      }),
    ).toBe(false);
  });
});

describe('computeProgressInvoiceMoney', () => {
  it('splits GST from inclusive allocated amounts', () => {
    expect(
      computeProgressInvoiceMoney({
        groups: [
          {
            items: [
              {
                id: 'i1',
                name: 'description',
                index: 0,
                unitCost: 300,
                quantity: 1,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 0,
              },
            ],
          },
        ],
        invoicedAmounts: { 'name:description:0': 165 },
        headerTotal: 165,
      }),
    ).toEqual({ total: 165, totalTax: 15, subTotal: 150 });
  });

  it('falls back to header total when no allocations are present', () => {
    expect(
      computeProgressInvoiceMoney({
        groups: [
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
        headerTotal: 165,
      }),
    ).toEqual({ total: 165, totalTax: 15, subTotal: 150 });
  });
});

describe('sumLocalGroupsInclusiveTotal', () => {
  it('sums GST-inclusive line totals', () => {
    expect(
      sumLocalGroupsInclusiveTotal([
        {
          items: [
            {
              unitCost: 300,
              quantity: 1,
              tax: 10,
              markupType: 'Percentage',
              markupValue: 0,
            },
          ],
        },
      ]),
    ).toBe(330);
    expect(
      itemInclusiveLineTotal({
        unitCost: 100,
        quantity: 2,
        tax: 10,
        markupType: 'Percentage',
        markupValue: 10,
      }),
    ).toBe(242);
  });
});

describe('applyLocalPricingToCrunchworkInvoiceGroups', () => {
  it('overlays unit cost/tax and marks items completed (keeps CW quantity)', () => {
    const overlaid = applyLocalPricingToCrunchworkInvoiceGroups({
      cwGroups: [
        {
          id: 'g1',
          name: 'Kitchen',
          index: 0,
          total: 0,
          items: [
            {
              id: 'i1',
              name: 'Plasterboard',
              catalogItemId: 'cat-1',
              unitCost: 0,
              quantity: 1,
              tax: 0,
            },
          ],
        },
      ],
      localGroups: [
        {
          name: 'Kitchen',
          index: 0,
          items: [
            {
              name: 'Plasterboard',
              catalogItemId: 'cat-1',
              unitCost: 45.5,
              quantity: 12,
              tax: 10,
              markupType: 'Percentage',
              markupValue: 19,
              unitType: { name: 'm2', externalReference: 'M2' },
            },
          ],
        },
      ],
    });

    const item = (overlaid[0].items as Record<string, unknown>[])[0];
    expect(item).toMatchObject({
      id: 'i1',
      completed: true,
      unitCost: 45.5,
      buyCost: 45.5,
      quantity: 1,
      tax: 10,
      markupType: 'Percentage',
      markupValue: 19,
    });
  });

  it('copies unitCost onto buyCost even when local buyCost differs', () => {
    const overlaid = applyLocalPricingToCrunchworkInvoiceGroups({
      cwGroups: [
        {
          id: 'g1',
          items: [{ id: 'i1', name: 'Plasterboard', unitCost: 0, buyCost: 10 }],
        },
      ],
      localGroups: [
        {
          items: [{ name: 'Plasterboard', unitCost: 45.5, buyCost: 20 }],
        },
      ],
    });
    const item = (overlaid[0].items as Record<string, unknown>[])[0];
    expect(item.unitCost).toBe(45.5);
    expect(item.buyCost).toBe(45.5);
  });

  it('matches combo items by catalog id when names differ', () => {
    const overlaid = applyLocalPricingToCrunchworkInvoiceGroups({
      cwGroups: [
        {
          id: 'g1',
          combos: [
            {
              id: 'c1',
              catalogComboId: 'combo-cw',
              items: [
                { id: 'i1', catalogItemId: 'cat-9', name: 'CW name', unitCost: 0 },
              ],
            },
          ],
        },
      ],
      localGroups: [
        {
          combos: [
            {
              catalogComboId: 'combo-cw',
              items: [
                { catalogItemId: 'cat-9', name: 'Local name', unitCost: 80, quantity: 2 },
              ],
            },
          ],
        },
      ],
    });

    const item = (
      (overlaid[0].combos as Record<string, unknown>[])[0].items as Record<string, unknown>[]
    )[0];
    expect(item.completed).toBe(true);
    expect(item.unitCost).toBe(80);
    expect(item.buyCost).toBe(80);
  });

  it('still marks unmatched CW items completed', () => {
    const overlaid = applyLocalPricingToCrunchworkInvoiceGroups({
      cwGroups: [
        { id: 'g1', items: [{ id: 'i1', name: 'Unknown', unitCost: 0 }] },
      ],
      localGroups: [],
    });
    expect((overlaid[0].items as Record<string, unknown>[])[0].completed).toBe(true);
    expect((overlaid[0].items as Record<string, unknown>[])[0].unitCost).toBe(0);
    expect((overlaid[0].items as Record<string, unknown>[])[0].buyCost).toBe(0);
  });
});

describe('toInvoiceUpdateGroups', () => {
  it('emits UpdateInvoiceInput groups with ids and completed pricing', () => {
    const groups = toInvoiceUpdateGroups([
      {
        id: 'g1',
        name: 'Kitchen',
        subTotal: 0,
        total: 0,
        items: [
          {
            id: 'i1',
            completed: true,
            unitCost: 45.5,
            quantity: 12,
            tax: 10,
            unitType: { id: 'u1', name: 'm2', externalReference: 'M2' },
          },
        ],
      },
    ]);

    expect(groups).toEqual([
      {
        id: 'g1',
        items: [
          {
            id: 'i1',
            completed: true,
            unitCost: 45.5,
            buyCost: 45.5,
            tax: 10,
            unitType: { externalReference: 'M2' },
          },
        ],
      },
    ]);
  });

    it('copies unitCost onto buyCost even when the source item has a different buyCost', () => {
      const groups = toInvoiceUpdateGroups([
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              completed: true,
              unitCost: 45.5,
              buyCost: 12,
            },
          ],
        },
      ]);
      expect((groups[0].items as Record<string, unknown>[])[0]).toMatchObject({
        unitCost: 45.5,
        buyCost: 45.5,
      });
    });

    it('drops groups and items that have no Crunchwork id', () => {
      expect(
        toInvoiceUpdateGroups([
          { name: 'No id', items: [{ name: 'line', unitCost: 10 }] },
        ]),
      ).toEqual([]);
    });
  });

describe('crunchworkInvoiceGroupsFromPayload', () => {
  it('returns groups from a create/get response', () => {
    expect(
      crunchworkInvoiceGroupsFromPayload({ groups: [{ id: 'g1' }] }),
    ).toEqual([{ id: 'g1' }]);
    expect(crunchworkInvoiceGroupsFromPayload({})).toEqual([]);
  });
});

describe('pickCrunchworkInvoiceIdForPurchaseOrder', () => {
  it('matches nested purchaseOrder.id', () => {
    expect(
      pickCrunchworkInvoiceIdForPurchaseOrder({
        purchaseOrderId: 'po-cw',
        invoices: [
          { id: 'inv-1', purchaseOrder: { id: 'other' } },
          { id: 'inv-2', purchaseOrder: { id: 'po-cw' } },
        ],
      }),
    ).toBe('inv-2');
  });

  it('falls back to the only invoice on the job', () => {
    expect(
      pickCrunchworkInvoiceIdForPurchaseOrder({
        purchaseOrderId: 'po-cw',
        invoices: [{ id: 'inv-only', total: 0 }],
      }),
    ).toBe('inv-only');
  });
});

describe('applyInvoicedAmountOverridesToGroups', () => {
  it('leaves groups unchanged when no map is provided', () => {
    const groups = [
      {
        id: 'g1',
        items: [{ id: 'i1', unitCost: 10, quantity: 2, completed: true }],
      },
    ];
    expect(
      applyInvoicedAmountOverridesToGroups({
        groups,
        invoicedAmounts: undefined,
      }),
    ).toEqual(groups);
  });

  it('marks unmatched or zero amounts incomplete and scales unitCost for allocated lines', () => {
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              catalogItemId: 'cat-1',
              name: 'Plasterboard',
              unitCost: 50,
              quantity: 10,
              completed: true,
            },
            {
              id: 'i2',
              name: 'Skip me',
              unitCost: 20,
              quantity: 1,
              completed: true,
            },
          ],
        },
      ],
      invoicedAmounts: {
        'catalog:cat-1': 100,
      },
    });

    const items = result[0].items as Record<string, unknown>[];
    expect(items[0]).toMatchObject({
      id: 'i1',
      completed: true,
      unitCost: 10,
      quantity: 10,
    });
    expect(items[1]).toMatchObject({
      id: 'i2',
      completed: false,
    });
  });

  it('strips GST from inclusive allocated amounts before deriving quantity (CW percentage tax)', () => {
    // Staging bug: $300 + 10% GST = $330 inclusive → qty must stay 1, not 1.1
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'f14d55f5-d310-403c-b66b-d9214a08fa03',
              name: 'description',
              tax: 10,
              buyCost: 300,
              quantity: 1,
              unitCost: 300,
              markupType: 'Percentage',
              markupValue: 0,
            },
          ],
        },
      ],
      invoicedAmounts: {
        'name:description:0': 330,
      },
    });

    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item).toMatchObject({
      completed: true,
      unitCost: 300,
      quantity: 1,
      tax: 10,
    });
  });

  it('strips GST when tax is stored as a decimal rate', () => {
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              unitCost: 300,
              quantity: 1,
              tax: 0.1,
              markupType: 'Percentage',
              markupValue: 0,
            },
          ],
        },
      ],
      invoicedAmounts: { 'id:i1': 330 },
    });
    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item.quantity).toBe(1);
    expect(item.unitCost).toBe(300);
  });

  it('keeps locked quantity and scales unitCost for partial allocation', () => {
    const result = applyInvoicedAmountOverridesToGroups({
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
      // Half of $330 GST-inclusive
      invoicedAmounts: { 'id:i1': 165 },
    });
    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item.quantity).toBe(1);
    expect(item.unitCost).toBe(150);
    expect(item.buyCost).toBe(150);
  });

  it('scales unitCost across quantity without changing locked qty', () => {
    // Full line: qty 2 × unitCost 100 × 1.1 markup × 1.1 tax = 242 inclusive
    // Allocate half (121) → keep qty 2, unitCost becomes 50
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [
            {
              id: 'i1',
              unitCost: 100,
              quantity: 2,
              tax: 10,
              markupType: 'Percentage',
              markupValue: 0.1,
            },
          ],
        },
      ],
      invoicedAmounts: { 'id:i1': 121 },
    });
    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item.quantity).toBe(2);
    expect(item.unitCost).toBe(50);
  });

  it('sets ex-GST unitCost when allocated without a usable unit cost', () => {
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [{ id: 'i1', name: 'Labour', unitCost: 0, quantity: 1, tax: 10 }],
        },
      ],
      invoicedAmounts: { 'id:i1': 330 },
    });
    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item).toMatchObject({
      completed: true,
      quantity: 1,
      unitCost: 300,
      buyCost: 300,
    });
  });

  it('sets unitCost when allocated without a usable unit cost and no tax', () => {
    const result = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [{ id: 'i1', name: 'Labour', unitCost: 0, quantity: 1 }],
        },
      ],
      invoicedAmounts: { 'id:i1': 250 },
    });
    const item = (result[0].items as Record<string, unknown>[])[0];
    expect(item).toMatchObject({
      completed: true,
      quantity: 1,
      unitCost: 250,
      buyCost: 250,
    });
  });

  it('emits completed false in toInvoiceUpdateGroups for skipped lines', () => {
    const groups = applyInvoicedAmountOverridesToGroups({
      groups: [
        {
          id: 'g1',
          items: [
            { id: 'i1', unitCost: 10, quantity: 1, completed: true },
            { id: 'i2', unitCost: 10, quantity: 1, completed: true },
          ],
        },
      ],
      invoicedAmounts: { 'id:i1': 10 },
    });
    const update = toInvoiceUpdateGroups(groups);
    expect(update[0].items).toEqual([
      expect.objectContaining({ id: 'i1', completed: true, unitCost: 10 }),
      { id: 'i2', completed: false },
    ]);
    expect((update[0].items as Record<string, unknown>[])[0].quantity).toBeUndefined();
  });
});
