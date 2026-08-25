import {
  PurchaseOrderTransformer,
  mapPoStatusToWorkOrderStatus,
} from './purchase-order.transformer';
import { LOOKUP_DOMAINS } from '../constants/lookup-domains';

describe('mapPoStatusToWorkOrderStatus', () => {
  it('maps Issued to Open', () => {
    expect(mapPoStatusToWorkOrderStatus('Issued')).toEqual({
      name: 'Open',
      externalReference: 'Open',
    });
  });

  it('maps cancelled and closed to Archived', () => {
    expect(mapPoStatusToWorkOrderStatus('Cancelled')).toEqual({
      name: 'Archived',
      externalReference: 'Archived',
    });
    expect(mapPoStatusToWorkOrderStatus('closed')).toEqual({
      name: 'Archived',
      externalReference: 'Archived',
    });
  });

  it('defaults blank status to Open', () => {
    expect(mapPoStatusToWorkOrderStatus(undefined)).toEqual({
      name: 'Open',
      externalReference: 'Open',
    });
  });
});

describe('PurchaseOrderTransformer', () => {
  let transformer: PurchaseOrderTransformer;

  beforeAll(() => {
    transformer = new PurchaseOrderTransformer();
  });

  it('resolves status onto work_order_status so Active/Archived list tabs can match', () => {
    const result = transformer.transform({
      payload: {
        id: 'po-1',
        status: { name: 'Open', externalReference: 'Open' },
        purchaseOrderType: { name: 'Vendor Purchase Order' },
      },
      tenantId: 'test-tenant',
    });

    expect(result.lookups).toContainEqual(
      expect.objectContaining({
        field: 'statusLookupId',
        domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS,
        externalReference: 'Open',
        name: 'Open',
      }),
    );
    expect(result.lookups).toContainEqual(
      expect.objectContaining({
        field: 'workOrderTypeLookupId',
        domain: LOOKUP_DOMAINS.WORK_ORDER_TYPE,
        name: 'Vendor Purchase Order',
      }),
    );
    expect(result.lookups.some((l) => l.domain === LOOKUP_DOMAINS.PURCHASE_ORDER_STATUS)).toBe(
      false,
    );
  });

  it('maps Issued PO status to work_order_status Open', () => {
    const result = transformer.transform({
      payload: { id: 'po-2', status: { name: 'Issued' } },
      tenantId: 'test-tenant',
    });

    expect(result.lookups).toContainEqual(
      expect.objectContaining({
        field: 'statusLookupId',
        domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS,
        name: 'Open',
        externalReference: 'Open',
      }),
    );
  });

  it('always requests a work_order_status lookup when CW omits status', () => {
    const result = transformer.transform({
      payload: { id: 'po-3' },
      tenantId: 'test-tenant',
    });

    expect(result.lookups).toContainEqual(
      expect.objectContaining({
        field: 'statusLookupId',
        domain: LOOKUP_DOMAINS.WORK_ORDER_STATUS,
        name: 'Open',
      }),
    );
  });
});
