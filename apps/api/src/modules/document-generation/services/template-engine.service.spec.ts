import * as fs from 'fs';
import * as path from 'path';
import PizZip from 'pizzip';
import { TemplateEngineService } from './template-engine.service';

describe('TemplateEngineService', () => {
  const service = new TemplateEngineService();
  const templatesDir = path.join(process.cwd(), '../../data/templates/seed');
  const rfqTemplatePath = path.join(templatesDir, 'Request for Quotation Template.docx');
  const poTemplatePath = path.join(templatesDir, 'Purchase Order Template.docx');
  const invoiceTemplatePath = path.join(templatesDir, 'Invoice Template.docx');
  const sowTemplatePath = path.join(templatesDir, 'Scope of Work Template.docx');
  const assessmentTemplatePath = path.join(templatesDir, 'Assessment Template.docx');

  const sampleGroups = [
    {
      name: 'Group 1',
      note: '',
      subtotal: '$0.00',
      items: [],
      combos: [],
      scopes: [
        {
          name: 'Scope A',
          description: '',
          quantity: '1',
          subtotal: '$0.00',
          note: '',
          items: [
            {
              name: 'Item 1',
              description: 'Test line item',
              category: 'Item',
              quantity: '1',
              unit_cost: '',
              tax: '',
              total: '',
              note: '',
            },
          ],
          combos: [],
        },
      ],
    },
  ];

  it('extracts docx-templates merge tags from the RFQ template', async () => {
    const templateBuffer = fs.readFileSync(rfqTemplatePath);
    const tags = await service.getTemplateTags({ templateBuffer });

    expect(tags).toEqual(expect.arrayContaining(['rfq_number', 'to.name', 'client.name']));
    expect(tags.some((tag) => tag.startsWith('FOR '))).toBe(true);
  });

  it('merges sample RFQ data into the template', async () => {
    const templateBuffer = fs.readFileSync(rfqTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        rfq_number: 'RFQ-TEST-01',
        sent_date: '01-Jan-26',
        to: {
          name: 'Supplier Contact',
          company: 'Supplier Co',
          address_line1: '1 Main St',
          address_line2: 'Sydney NSW',
        },
        client: {
          name: 'Client Name',
          address_line1: '2 Client St',
          address_line2: 'Melbourne VIC',
          home_phone: '111',
          mobile_phone: '222',
          other_phone: '',
          email: 'client@example.com',
        },
        tenant: {
          name: '',
          home_phone: '',
          mobile_phone: '',
          other_phone: '',
        },
        groups: sampleGroups,
        subtotal: '$0.00',
        tax: '$0.00',
        total: '$0.00',
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('RFQ-TEST-01');
    expect(documentXml).toContain('Supplier Contact');
    expect(documentXml).toContain('Test line item');
  });

  it('merges RFQ data when a group has no scopes', async () => {
    const templateBuffer = fs.readFileSync(rfqTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        rfq_number: 'RFQ-TEST-02',
        sent_date: '01-Jan-26',
        to: {
          name: 'Supplier Contact',
          company: 'Supplier Co',
          address_line1: '1 Main St',
          address_line2: 'Sydney NSW',
        },
        client: {
          name: 'Client Name',
          address_line1: '2 Client St',
          address_line2: 'Melbourne VIC',
          home_phone: '111',
          mobile_phone: '222',
          other_phone: '',
          email: 'client@example.com',
        },
        tenant: {
          name: '',
          home_phone: '',
          mobile_phone: '',
          other_phone: '',
        },
        groups: [
          {
            name: 'Labour',
            note: '',
            subtotal: '$100.00',
            scopes: [],
            combos: [],
            items: [
              {
                name: 'Line 1',
                description: 'Direct group item',
                category: 'ea',
                quantity: '1',
                unit_cost: '$100.00',
                tax: '$0.00',
                total: '$100.00',
                note: '',
              },
            ],
          },
        ],
        subtotal: '$100.00',
        tax: '$0.00',
        total: '$100.00',
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('RFQ-TEST-02');
    expect(documentXml).toContain('Direct group item');
  });

  it('extracts docx-templates merge tags from the purchase order template', async () => {
    const templateBuffer = fs.readFileSync(poTemplatePath);
    const tags = await service.getTemplateTags({ templateBuffer });

    expect(tags).toEqual(expect.arrayContaining(['po_number', 'to.name', 'total']));
    expect(tags.some((tag) => tag.startsWith('FOR '))).toBe(true);
  });

  it('merges sample purchase order data into the template', async () => {
    const templateBuffer = fs.readFileSync(poTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        po_number: 'PO-TEST-99',
        date: '22-Aug-26',
        total: '$1,234.56',
        to: { name: 'Vendor Co', email: 'v@example.com', address: '10 Vendor St' },
        client: {
          name: 'Client Name',
          address_line1: '1 Client Rd',
          address_line2: 'Brisbane QLD',
          home_phone: '07 1111 1111',
          mobile_phone: '0400 000 000',
          other_phone: '',
          email: 'client@example.com',
        },
        tenant: { name: '', home_phone: '', mobile_phone: '', other_phone: '' },
        groups: [
          {
            ...sampleGroups[0],
            scopes: [
              {
                ...sampleGroups[0].scopes[0],
                items: [
                  {
                    ...sampleGroups[0].scopes[0].items[0],
                    description: 'PO line item',
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('PO-TEST-99');
    expect(documentXml).toContain('Vendor Co');
    expect(documentXml).toContain('PO line item');
  });

  it('extracts docx-templates merge tags from the invoice template', async () => {
    const templateBuffer = fs.readFileSync(invoiceTemplatePath);
    const tags = await service.getTemplateTags({ templateBuffer });

    expect(tags).toEqual(expect.arrayContaining(['invoice_number', 'to.name', 'client.name', 'total']));
    expect(tags.some((tag) => tag.startsWith('FOR '))).toBe(true);
    expect(tags).toEqual(expect.arrayContaining(['$item.name', '$item.description']));
  });

  it('merges sample invoice data into the template', async () => {
    const templateBuffer = fs.readFileSync(invoiceTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        invoice_number: 'INV-TEST-01',
        date: '22-Aug-26',
        subtotal: '$1,000.00',
        tax: '$100.00',
        total: '$1,100.00',
        to: { name: 'Insurer Ltd', email: 'ap@example.com', address: '1 Insurer St' },
        client: {
          name: 'Client Name',
          address_line1: '1 Client Rd',
          address_line2: 'Brisbane QLD',
          home_phone: '07 1111 1111',
          mobile_phone: '0400 000 000',
          other_phone: '',
          email: 'client@example.com',
        },
        tenant: { name: '', home_phone: '', mobile_phone: '', other_phone: '' },
        groups: [
          {
            ...sampleGroups[0],
            name: 'Kitchen',
            scopes: [
              {
                ...sampleGroups[0].scopes[0],
                name: 'Tiling',
                description: 'Supply and lay',
                items: [
                  {
                    ...sampleGroups[0].scopes[0].items[0],
                    name: 'Wall tiles',
                    description: 'Invoice line item',
                  },
                ],
              },
            ],
          },
        ],
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('INV-TEST-01');
    expect(documentXml).toContain('Insurer Ltd');
    expect(documentXml).toContain('Kitchen');
    expect(documentXml).toContain('Wall tiles');
    expect(documentXml).toContain('Invoice line item');
    expect(documentXml).toContain('$1,100.00');
  });

  it('extracts docx-templates merge tags from the scope of works template', async () => {
    const templateBuffer = fs.readFileSync(sowTemplatePath);
    const tags = await service.getTemplateTags({ templateBuffer });

    expect(tags).toEqual(
      expect.arrayContaining(['claim.number', 'suburb', 'address', 'excess', 'insured.name']),
    );
    expect(tags.some((tag) => tag.startsWith('FOR '))).toBe(true);
  });

  it('merges sample scope of works data into the template', async () => {
    const templateBuffer = fs.readFileSync(sowTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        reference: 'JOB-REF-001',
        claim: { number: 'CLM-12345' },
        insured: {
          name: 'Jane Insured',
          phone: '07 2222 2222',
          mobile: '0411 111 111',
          email: 'jane@example.com',
        },
        suburb: 'Springfield',
        address: '42 Main Street',
        postcode: '4000',
        excess: '$500.00',
        groups: sampleGroups,
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('JOB-REF-001');
    expect(documentXml).toContain('CLM-12345');
    expect(documentXml).toContain('Jane Insured');
    expect(documentXml).toContain('Springfield');
    expect(documentXml).toContain('$500.00');
    expect(documentXml).toContain('Scope A');
    expect(documentXml).toContain('Test line item');
    expect(documentXml).not.toContain('$item.quantity');
    expect(documentXml).not.toContain('$item.unit_cost');
  });

  it('extracts docx-templates merge tags from the assessment template', async () => {
    const templateBuffer = fs.readFileSync(assessmentTemplatePath);
    const tags = await service.getTemplateTags({ templateBuffer });

    expect(tags).toEqual(
      expect.arrayContaining([
        'assessment_name',
        'builder_estimator_name',
        'claim_recommendation',
        'specialist_type',
      ]),
    );
  });

  it('merges sample assessment data into the template', async () => {
    const templateBuffer = fs.readFileSync(assessmentTemplatePath);
    const output = await service.populate({
      templateBuffer,
      data: {
        company_name: 'Ensure Constructions',
        assessment_name: 'Site Assessment – Test',
        status: 'Draft',
        job_name: 'Test Job',
        job_reference: 'JOB-001',
        address_attended: 'Yes',
        other_address: '',
        date_booked: '15 August 2026',
        persons_attending: 'Builder',
        builder_estimator_name: 'John Smith',
        builder_estimator_phone: '02 8824 2500',
        iag_inspection_required: 'No',
        insurance_assessor_name: '',
        insurance_assessor_phone: '',
        occupancy_type: 'Occupied',
        square_metres: '180',
        building_age: '1995',
        building_type: 'House',
        design_type: 'Standard',
        construction: 'Brick Veneer',
        roof_type: 'Tile',
        additional_structures: 'Garage',
        other_structures: '',
        squares: '',
        main_roof_damage: 'Yes',
        overall_condition_acceptable: 'No',
        furniture_removal_storage: 'No',
        detached_garage: 'Yes',
        sheds: 'No',
        swimming_pool: 'No',
        detached_granny_flat: 'No',
        habitable: 'No',
        uninhabitable_reason: 'Water ingress',
        other_uninhabitable_reason: '',
        hazard_pool_fencing: 'No',
        hazard_pool_fencing_comment: '',
        hazard_electrical_gas: 'Yes',
        hazard_electrical_gas_comment: 'Exposed wiring',
        hazard_sewerage: 'No',
        hazard_sewerage_comment: '',
        hazard_structural: 'No',
        hazard_structural_comment: '',
        hazard_other: '',
        safety_hazards: 'Electrical',
        environmental_hazards: '',
        mould: 'No',
        asbestos_on_site: 'No',
        resultant_damage: 'Ceiling damage',
        cause_of_damage: 'Storm',
        damage_caused_by_listed_event: 'Yes',
        pre_existing_maintenance_issues: 'No',
        pre_existing_relate_damage: '',
        maintenance_related_issues: '',
        works_required_to_address_damage: 'Strip out',
        make_safe: 'Yes',
        make_safe_type: 'Tarp',
        make_safe_completion_date: '16 August 2026',
        date_main_roof_repaired: '',
        temp_accom_required: 'No',
        temp_accom_estimated_amount: '',
        temp_accom_estimated_duration: '',
        temp_accom_required_immediately: 'No',
        temp_accom_immediate_estimate_days: '',
        temp_accom_required_during_repairs: 'No',
        temp_accom_repairs_estimate_days: '',
        temp_repairs_to_make_livable: '',
        work_while_in_accommodation: '',
        specialist_required: 'Yes',
        specialist_type: 'Engineer',
        claim_recommendation: 'Approve',
        cost_estimate_for_repairs: '10000',
        estimated_repair_time: '4',
        estimated_repair_duration: 'Weeks',
        insured_advised: 'Yes',
        client_willing_to_proceed: 'Yes',
        customer_arranged_repairs: 'No',
        arranged_repair_comments: '',
        client_discussion: 'Scope discussed',
        comments: 'Notes',
        variances_of_scope: 'None',
        builder_licenses: '138899C',
        created_at: '10 August 2026',
        report_date: '23 August 2026',
      },
    });

    const zip = new PizZip(output);
    const documentXml = zip.file('word/document.xml')?.asText() ?? '';
    expect(documentXml).toContain('Site Assessment');
    expect(documentXml).toContain('John Smith');
    expect(documentXml).toContain('Exposed wiring');
    expect(documentXml).toContain('Engineer');
    expect(documentXml).toContain('Approve');
  });
});
