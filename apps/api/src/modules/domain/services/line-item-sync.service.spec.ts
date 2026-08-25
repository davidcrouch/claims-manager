import { Test } from '@nestjs/testing';
import { DRIZZLE } from '../../../database/drizzle.module';
import { workOrderCombos, workOrderGroups, workOrderItems } from '../../../database/schema';
import { LineItemSyncService } from './line-item-sync.service';
import { LookupResolutionService } from './lookup-resolution.service';

const UNKNOWN_CW_COMBO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const LOCAL_ASSEMBLY_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TENANT_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const WO_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function thenableReturning(rows: { id: string }[]) {
  return {
    returning: jest.fn().mockResolvedValue(rows),
    then(
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(rows).then(onFulfilled, onRejected);
    },
  };
}

function createTxMock(
  catalogRowsByQuery: Array<Array<{ id: string; externalReference: string | null }>>,
) {
  const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
  let catalogQuery = 0;

  const tx = {
    delete: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
    insert: jest.fn().mockImplementation((table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return thenableReturning([{ id: `created-${inserts.length}` }]);
      },
    })),
    select: jest.fn().mockImplementation(() => ({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockImplementation(async () => {
          const rows = catalogRowsByQuery[catalogQuery] ?? [];
          catalogQuery += 1;
          return rows;
        }),
      }),
    })),
  };

  return { tx, inserts };
}

const comboPayload = {
  groups: [
    {
      description: 'Kitchen',
      combos: [
        {
          name: 'Cabinet pack',
          catalogComboId: UNKNOWN_CW_COMBO_ID,
          items: [{ name: 'Hinge', catalogItemId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' }],
        },
      ],
    },
  ],
};

describe('LineItemSyncService', () => {
  let service: LineItemSyncService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LineItemSyncService,
        { provide: DRIZZLE, useValue: {} },
        {
          provide: LookupResolutionService,
          useValue: { resolve: jest.fn().mockResolvedValue(null) },
        },
      ],
    }).compile();

    service = module.get(LineItemSyncService);
  });

  it('omits unknown catalogComboId so work_order_combos FK is not violated', async () => {
    const { tx, inserts } = createTxMock([[], []]);

    const result = await service.syncWorkOrderItems({
      workOrderId: WO_ID,
      tenantId: TENANT_ID,
      payload: comboPayload,
      tx: tx as never,
    });

    const comboInsert = inserts.find((row) => row.table === workOrderCombos);
    expect(comboInsert?.values.catalogComboId).toBeUndefined();
    expect(comboInsert?.values.name).toBe('Cabinet pack');
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        { itemName: 'Cabinet pack', catalogItemId: UNKNOWN_CW_COMBO_ID },
      ]),
    );
  });

  it('maps catalogComboId via tenant external_reference to the local assembly id', async () => {
    const { tx, inserts } = createTxMock([
      [],
      [{ id: LOCAL_ASSEMBLY_ID, externalReference: UNKNOWN_CW_COMBO_ID }],
    ]);

    await service.syncWorkOrderItems({
      workOrderId: WO_ID,
      tenantId: TENANT_ID,
      payload: comboPayload,
      tx: tx as never,
    });

    const comboInsert = inserts.find((row) => row.table === workOrderCombos);
    expect(comboInsert?.values.catalogComboId).toBe(LOCAL_ASSEMBLY_ID);
  });

  it('stores CW percentage tax/markup as decimal rates and uses group.name', async () => {
    const { tx, inserts } = createTxMock([[], []]);

    await service.syncWorkOrderItems({
      workOrderId: WO_ID,
      tenantId: TENANT_ID,
      payload: {
        groups: [
          {
            name: 'Bathroom',
            description: null,
            items: [
              {
                name: 'Architrave - Installation',
                quantity: 1,
                unitCost: 345,
                tax: 10,
                markupType: 'Percentage',
                markupValue: 19,
              },
            ],
          },
        ],
      },
      tx: tx as never,
    });

    const groupInsert = inserts.find((row) => row.table === workOrderGroups);
    expect(groupInsert?.values.description).toBe('Bathroom');

    const itemInsert = inserts.find((row) => row.table === workOrderItems);
    expect(itemInsert?.values.unitCost).toBe('345');
    expect(itemInsert?.values.tax).toBe('0.1000');
    expect(itemInsert?.values.markupValue).toBe('0.1900');
  });
});
