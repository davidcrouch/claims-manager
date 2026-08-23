import { buildTemplateGroups, resolveGroupDisplayName, rollupDocumentTotals, templateGroupsFromPayload } from './line-items.helper';

describe('rollupDocumentTotals', () => {
  it('uses group totals when present', () => {
    expect(
      rollupDocumentTotals({
        groups: [{ totals: { subTotal: '100', totalTax: '10', total: '110' } }],
        combos: [{ totals: { subTotal: '50', totalTax: '5', total: '55' } }],
        items: [{ totals: { subTotal: '20', totalTax: '2', total: '22' } }],
      }),
    ).toEqual({ subtotal: 100, tax: 10, total: 110 });
  });

  it('falls back to combo totals when group totals are empty', () => {
    expect(
      rollupDocumentTotals({
        groups: [{ totals: {} }],
        combos: [{ totals: { subTotal: '50', totalTax: '5', total: '55' } }],
        items: [{ totals: { subTotal: '20', totalTax: '2', total: '22' } }],
      }),
    ).toEqual({ subtotal: 50, tax: 5, total: 55 });
  });

  it('falls back to leaf item totals when group and combo totals are empty', () => {
    expect(
      rollupDocumentTotals({
        groups: [{ totals: {} }, { totals: {} }],
        combos: [
          { totals: { subTotal: '0.0000', totalTax: '0.0000', total: '0.0000' } },
          { totals: { subTotal: '0.0000', totalTax: '0.0000', total: '0.0000' } },
        ],
        items: [
          { totals: { subTotal: '234.0000', totalTax: '23.4000', total: '257.4000' } },
          { totals: { subTotal: '45.0000', totalTax: '4.5000', total: '49.5000' } },
        ],
      }),
    ).toEqual({ subtotal: 279, tax: 27.9, total: 306.9 });
  });
});

describe('buildTemplateGroups', () => {
  it('uses group label name and dimensions for template groups', () => {
    const groupLabelNames = new Map([['label-1', 'Kitchen']]);
    const groups = buildTemplateGroups({
      groups: [
        {
          id: 'g1',
          description: 'Optional room note',
          groupLabelLookupId: 'label-1',
          dimensions: { length: 4.5, width: 3.2, height: 2.7, perimeter: 15.4 },
          totals: { subTotal: '0' },
        },
      ],
      combos: [],
      items: [],
      groupLabelNames,
    });

    expect(groups).toEqual([
      expect.objectContaining({
        group_name: 'Kitchen',
        group_length: '4.5',
        group_width: '3.2',
        group_height: '2.7',
        group_perimeter: '15.4',
      }),
    ]);
  });
});

describe('resolveGroupDisplayName', () => {
  it('prefers lookup label over description', () => {
    expect(
      resolveGroupDisplayName(
        {
          id: 'g1',
          description: 'Room note',
          groupLabelLookupId: 'label-1',
        },
        new Map([['label-1', 'Bedroom']]),
      ),
    ).toBe('Bedroom');
  });
});

describe('templateGroupsFromPayload', () => {
  it('maps API-shaped invoice payload groups', () => {
    const groups = templateGroupsFromPayload({
      groups: [
        {
          groupLabel: { name: 'Kitchen' },
          note: 'Wet area',
          subTotal: 100,
          length: 4,
          items: [
            {
              name: 'Tile',
              description: 'Supply and lay tiles',
              quantity: 10,
              unitCost: 25,
              total: 250,
            },
          ],
          scopes: [
            {
              name: 'Waterproofing',
              description: 'Membrane to wet areas',
              items: [{ name: 'Membrane', description: 'Apply membrane', quantity: 1, unitCost: 80, total: 80 }],
            },
          ],
        },
      ],
    });

    expect(groups).toEqual([
      expect.objectContaining({
        group_name: 'Kitchen',
        group_note: 'Wet area',
        group_length: '4',
        items: [
          expect.objectContaining({
            item_name: 'Tile',
            item_description: 'Supply and lay tiles',
            item_quantity: '10',
          }),
        ],
        scopes: [
          expect.objectContaining({
            scope_name: 'Waterproofing',
            scope_description: 'Membrane to wet areas',
          }),
        ],
      }),
    ]);
  });

  it('wraps flat lineItems into a single group', () => {
    const groups = templateGroupsFromPayload({
      lineItems: [{ name: 'Call out', description: 'After hours', quantity: 1, unitCost: 150, total: 150 }],
    });
    expect(groups).toHaveLength(1);
    expect(groups?.[0].items).toEqual([
      expect.objectContaining({ item_name: 'Call out', item_description: 'After hours' }),
    ]);
  });

  it('returns null when payload has no line items', () => {
    expect(templateGroupsFromPayload({})).toBeNull();
    expect(templateGroupsFromPayload(null)).toBeNull();
  });
});
