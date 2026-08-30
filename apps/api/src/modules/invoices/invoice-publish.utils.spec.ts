import {
  applyLocalPricingToCrunchworkInvoiceGroups,
  buildCrunchworkVendorTaxInvoiceCreateBody,
  crunchworkInvoiceGroupsFromPayload,
  pickCrunchworkInvoiceIdForPurchaseOrder,
  preferExistingAmount,
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

describe('applyLocalPricingToCrunchworkInvoiceGroups', () => {
  it('overlays unit cost/quantity/tax and marks items completed', () => {
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
      quantity: 12,
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
    expect(item.quantity).toBe(2);
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
            quantity: 12,
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
