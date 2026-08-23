import { TransformService } from './transform.service';
import { TRANSFORM_DEFAULTS } from '../schemas/target/defaults';

describe('TransformService party contacts', () => {
  const service = new TransformService(
    {} as never,
    {} as never,
    {} as never,
  );

  const baseJob = {
    name: 'Works job',
    externalReference: 'JOB-001',
    statusName: 'Open',
    jobTypeName: 'Builder - Scope of Works',
    requestDate: '2026-01-01',
    excess: '500',
    makeSafeRequired: false,
    jobInstructions: 'Repair roof',
    address: { streetNumber: '42', streetName: 'Main St' },
    addressSuburb: 'Springfield',
    addressState: 'QLD',
    addressPostcode: '4000',
  };

  const baseQuote = {
    name: 'Initial',
    reference: null,
    internalNumber: 'EST-200065',
    quoteNumber: null,
  };

  it('maps insured contact from job contacts for scope_of_work', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.scope_of_work.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          quote: baseQuote,
          job: baseJob,
          claim: {
            claimNumber: 'CLM-99',
            externalReference: 'REF-99',
            dateOfLoss: '2025-12-01',
            incidentDescription: 'Storm',
          },
          contacts: [
            {
              firstName: 'Jane',
              lastName: 'Insured',
              email: 'jane@example.com',
              mobilePhone: '0411 111 111',
              homePhone: '07 2222 2222',
              isInsured: true,
            },
          ],
          claim_contacts: [],
          groups: [],
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      name: 'Initial',
      reference: 'EST-200065',
      address: '42 Main St',
      insured: {
        name: 'Jane Insured',
        phone: '07 2222 2222',
        mobile: '0411 111 111',
        email: 'jane@example.com',
      },
      suburb: 'Springfield',
      claim: { number: 'CLM-99' },
      groups: [],
    });
  });

  it('maps quote line-item groups for scope_of_work without requiring pricing fields', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.scope_of_work.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          quote: baseQuote,
          job: baseJob,
          claim: { claimNumber: 'CLM-99' },
          contacts: [],
          claim_contacts: [],
          groups: [
            {
              group_name: 'Upstairs office',
              group_note: '',
              group_subtotal: '$0.00',
              group_length: '4',
              group_width: '3',
              group_height: '2.5',
              group_perimeter: '14',
              items: [],
              combos: [],
              scopes: [
                {
                  scope_name: 'Plaster repairs',
                  scope_description: 'Cut out and patch wall plaster',
                  scope_quantity: '1',
                  scope_subtotal: '$0.00',
                  scope_note: '',
                  items: [
                    {
                      item_name: 'Patch wall',
                      item_description: 'Cut out and patch approx 1m2',
                      item_category: 'ea',
                      item_quantity: '1',
                      item_unit_cost: '$10.00',
                      item_tax: '$0.00',
                      item_total: '$10.00',
                      item_note: '',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      groups: [
        {
          name: 'Upstairs office',
          dimensions: { length: '4', width: '3', height: '2.5', perimeter: '14' },
          scopes: [
            {
              name: 'Plaster repairs',
              description: 'Cut out and patch wall plaster',
              items: [{ name: 'Patch wall', description: 'Cut out and patch approx 1m2' }],
            },
          ],
        },
      ],
    });
  });

  it('falls back to claim contacts when job has no insured', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.scope_of_work.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          quote: { name: 'Initial', internalNumber: 'EST-200065' },
          job: baseJob,
          claim: {
            claimNumber: 'CLM-99',
            externalReference: 'REF-99',
            dateOfLoss: '2025-12-01',
            incidentDescription: 'Storm',
          },
          contacts: [],
          claim_contacts: [
            {
              firstName: 'John',
              lastName: 'Policyholder',
              email: 'john@example.com',
              workPhone: '07 3333 3333',
              isInsured: true,
            },
          ],
          groups: [],
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      insured: {
        name: 'John Policyholder',
        phone: '07 3333 3333',
        email: 'john@example.com',
      },
    });
  });

  it('maps client and tenant for rfq documents', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.rfq.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          rfq: {
            rfqNumber: 'RFQ-100',
            name: 'Roof RFQ',
            note: '',
            sentDate: '2026-01-10',
            dueDate: '2026-01-20',
            receivedDate: null,
            includePricing: true,
            includeQuantities: true,
            rfqToName: 'Supplier Co',
            rfqToEmail: 'supplier@example.com',
            rfqTo: { name: 'Supplier Co', email: 'supplier@example.com', address: '1 Vendor Rd' },
            rfqFrom: { name: 'Acme Co' },
          },
          job: baseJob,
          contacts: [
            {
              firstName: 'Jane',
              lastName: 'Insured',
              email: 'jane@example.com',
              homePhone: '07 2222 2222',
              mobilePhone: '0411 111 111',
              isInsured: true,
            },
            {
              firstName: 'Alex',
              lastName: 'Renter',
              homePhone: '07 4444 4444',
              isTenant: true,
            },
          ],
          claim_contacts: [],
          groups: [],
          _totals: { subtotal: 1000, tax: 100, total: 1100 },
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      rfq_number: 'RFQ-100',
      subtotal: '$1,000.00',
      tax: '$100.00',
      total: '$1,100.00',
      client: {
        name: 'Jane Insured',
        address_line1: '42 Main St',
        address_line2: 'Springfield, QLD, 4000',
        home_phone: '07 2222 2222',
        mobile_phone: '0411 111 111',
        email: 'jane@example.com',
      },
      tenant: {
        name: 'Alex Renter',
        home_phone: '07 4444 4444',
      },
    });
  });

  it('outputs empty arrays for missing group scopes', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.rfq.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          rfq: {
            rfqNumber: 'RFQ-100',
            name: 'Roof RFQ',
            note: '',
            sentDate: '2026-01-10',
            dueDate: '2026-01-20',
            receivedDate: null,
            includePricing: true,
            includeQuantities: true,
            rfqToName: 'Supplier Co',
            rfqToEmail: 'supplier@example.com',
            rfqTo: { name: 'Supplier Co', email: 'supplier@example.com', address: '1 Vendor Rd' },
            rfqFrom: { name: 'Acme Co' },
          },
          job: baseJob,
          contacts: [],
          claim_contacts: [],
          _totals: { subtotal: 100, tax: 10, total: 110 },
          groups: [
            {
              group_name: 'Labour',
              group_note: '',
              group_subtotal: '$100.00',
              group_length: '',
              group_width: '',
              group_height: '',
              group_perimeter: '',
              items: [
                {
                  item_name: 'Line 1',
                  item_description: 'Direct item',
                  item_category: 'ea',
                  item_quantity: '1',
                  item_unit_cost: '$100.00',
                  item_tax: '$0.00',
                  item_total: '$100.00',
                  item_note: '',
                },
              ],
            },
          ],
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      subtotal: '$100.00',
      tax: '$10.00',
      total: '$110.00',
      groups: [
        {
          name: 'Labour',
          scopes: [],
          combos: [],
          items: [{ description: 'Direct item' }],
        },
      ],
    });
  });

  it('maps invoice groups, parties, and totals', async () => {
    const { result, error } = await service.evaluateJsonata({
      jsonataRules: TRANSFORM_DEFAULTS.invoice.jsonataRules,
      sourceData: {
        _context: {
          organization: { name: 'Acme Co' },
          invoice: {
            invoiceNumber: 'INV-100',
            internalNumber: 'INV-200010',
            issueDate: '2026-08-01',
            receivedDate: null,
            comments: 'Progress claim 1',
            subTotal: '1000',
            totalTax: '100',
            totalAmount: '1100',
            excessAmount: '0',
          },
          purchase_order: {
            purchaseOrderNumber: 'PO-50',
            internalNumber: 'PO-200050',
            name: 'Roof works',
            poFrom: { name: 'Insurer Ltd', address: '1 Insurer St' },
            poToEmail: 'ap@insurer.example',
            poForName: 'Jane Insured',
          },
          work_order: {},
          job: baseJob,
          contacts: [
            {
              firstName: 'Jane',
              lastName: 'Insured',
              email: 'jane@example.com',
              homePhone: '07 2222 2222',
              mobilePhone: '0411 111 111',
              isInsured: true,
            },
          ],
          claim_contacts: [],
          groups: [
            {
              group_name: 'Kitchen',
              group_note: '',
              group_subtotal: '$250.00',
              group_length: '',
              group_width: '',
              group_height: '',
              group_perimeter: '',
              items: [],
              combos: [],
              scopes: [
                {
                  scope_name: 'Tiling',
                  scope_description: 'Supply and lay',
                  scope_quantity: '1',
                  scope_subtotal: '$250.00',
                  scope_note: '',
                  items: [
                    {
                      item_name: 'Wall tiles',
                      item_description: 'Supply and lay wall tiles',
                      item_category: 'm2',
                      item_quantity: '10',
                      item_unit_cost: '$25.00',
                      item_tax: '$0.00',
                      item_total: '$250.00',
                      item_note: '',
                    },
                  ],
                  combos: [],
                },
              ],
            },
          ],
        },
      },
    });

    expect(error).toBeUndefined();
    expect(result).toMatchObject({
      invoice_number: 'INV-200010',
      number: 'INV-200010',
      date: expect.any(String),
      subtotal: '$1,000.00',
      tax: '$100.00',
      total: '$1,100.00',
      to: { name: 'Insurer Ltd', address: '1 Insurer St' },
      from: { name: 'Acme Co' },
      client: { name: 'Jane Insured', email: 'jane@example.com' },
      po: { number: 'PO-200050', name: 'Roof works' },
      groups: [
        {
          name: 'Kitchen',
          scopes: [
            {
              name: 'Tiling',
              description: 'Supply and lay',
              items: [{ name: 'Wall tiles', description: 'Supply and lay wall tiles' }],
            },
          ],
        },
      ],
    });
  });
});
