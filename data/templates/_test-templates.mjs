/**
 * Smoke-test docx-templates merge on patched templates.
 * Run: node data/templates/_test-templates.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../apps/api/package.json'),
);
const createReport = require('docx-templates').default;
const { listCommands } = require('docx-templates');
const PizZip = require('pizzip');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CMD_DELIMITER = ['<<', '>>'];

async function testTemplate(name, data, assertions) {
  const templatePath = path.join(__dirname, name);
  const templateBuffer = fs.readFileSync(templatePath);
  const commands = await listCommands(templateBuffer.buffer.slice(
    templateBuffer.byteOffset,
    templateBuffer.byteOffset + templateBuffer.byteLength,
  ), CMD_DELIMITER);
  console.log(`\n=== ${name} — ${commands.length} commands ===`);

  const output = await createReport({
    template: templateBuffer,
    data,
    cmdDelimiter: CMD_DELIMITER,
    failFast: true,
    processLineBreaks: true,
  });

  const zip = new PizZip(output);
  const documentXml = zip.file('word/document.xml')?.asText() ?? '';
  for (const text of assertions) {
    if (!documentXml.includes(text)) {
      throw new Error(`${name}: expected merged output to contain "${text}"`);
    }
  }
  console.log(`OK — merged values found: ${assertions.join(', ')}`);
}

const sampleGroups = [
  {
    name: 'Group 1',
    note: '',
    subtotal: '$100.00',
    items: [],
    combos: [],
    scopes: [
      {
        name: 'Scope A',
        description: '',
        quantity: '1',
        subtotal: '$50.00',
        note: '',
        items: [
          {
            name: 'Item 1',
            description: 'PO line item',
            category: 'Item',
            quantity: '2',
            unit_cost: '$25.00',
            tax: '',
            total: '$50.00',
            note: '',
          },
        ],
        combos: [],
      },
    ],
  },
];

await testTemplate('Purchase Order Template.docx', {
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
  groups: sampleGroups,
}, ['PO-TEST-99', 'Vendor Co', 'PO line item', '$1,234.56']);

await testTemplate('Request for Quotation Template.docx', {
  rfq_number: 'RFQ-TEST-99',
  sent_date: '22-Aug-26',
  subtotal: '$1,000.00',
  tax: '$100.00',
  total: '$1,100.00',
  to: {
    name: 'Supplier Co',
    company: 'Supplier Co',
    address_line1: '10 Vendor St',
    address_line2: '',
  },
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
  groups: sampleGroups,
}, ['RFQ-TEST-99', 'Supplier Co', '$1,000.00', '$100.00', '$1,100.00']);

await testTemplate('Scope of Work Template.docx', {
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
}, ['JOB-REF-001', 'CLM-12345', 'Jane Insured', 'Springfield', '$500.00', 'Scope A', 'PO line item']);

await testTemplate('Assessment Template.docx', {
  company_name: 'Ensure Constructions',
  assessment_name: 'Site Assessment – 42 Main St',
  status: 'Draft',
  job_name: 'Storm damage – Springfield',
  job_reference: 'JOB-REF-001',
  address_attended: 'Yes',
  other_address: '',
  date_booked: '15 August 2026',
  persons_attending: 'Builder, Insured',
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
  additional_structures: 'Detached Garage, Sheds',
  other_structures: '',
  squares: '',
  main_roof_damage: 'Yes',
  overall_condition_acceptable: 'No',
  furniture_removal_storage: 'No',
  detached_garage: 'Yes',
  sheds: 'Yes',
  swimming_pool: 'No',
  detached_granny_flat: 'No',
  habitable: 'No',
  uninhabitable_reason: 'Roof damage and water ingress',
  other_uninhabitable_reason: '',
  hazard_pool_fencing: 'No',
  hazard_pool_fencing_comment: '',
  hazard_electrical_gas: 'Yes',
  hazard_electrical_gas_comment: 'Exposed wiring in ceiling',
  hazard_sewerage: 'No',
  hazard_sewerage_comment: '',
  hazard_structural: 'Yes',
  hazard_structural_comment: 'Ceiling sag noted',
  hazard_other: '',
  safety_hazards: 'Electrical, Structural',
  environmental_hazards: 'Mould in bedroom',
  mould: 'Yes',
  asbestos_on_site: 'No',
  resultant_damage: 'Water staining to ceilings and walls',
  cause_of_damage: 'Storm event',
  damage_caused_by_listed_event: 'Yes',
  pre_existing_maintenance_issues: 'No',
  pre_existing_relate_damage: '',
  maintenance_related_issues: '',
  works_required_to_address_damage: 'Strip out wet plasterboard',
  make_safe: 'Yes',
  make_safe_type: 'Tarp',
  make_safe_completion_date: '16 August 2026',
  date_main_roof_repaired: '',
  temp_accom_required: 'Yes, Temporary Accommodation',
  temp_accom_estimated_amount: '3500',
  temp_accom_estimated_duration: '14 Days',
  temp_accom_required_immediately: 'Yes',
  temp_accom_immediate_estimate_days: '14',
  temp_accom_required_during_repairs: 'Yes',
  temp_accom_repairs_estimate_days: '60',
  temp_repairs_to_make_livable: 'Emergency tarp and make-safe',
  work_while_in_accommodation: 'Full strip-out and reinstatement',
  specialist_required: 'Yes',
  specialist_type: 'Engineer',
  claim_recommendation: 'Approve',
  cost_estimate_for_repairs: '45000',
  estimated_repair_time: '8',
  estimated_repair_duration: 'Weeks',
  insured_advised: 'Yes',
  client_willing_to_proceed: 'Yes',
  customer_arranged_repairs: 'No',
  arranged_repair_comments: '',
  client_discussion: 'Discussed scope and timeline with insured',
  comments: 'Urgent make-safe completed',
  variances_of_scope: 'None noted',
  builder_licenses: '138899C',
  created_at: '10 August 2026',
  report_date: '23 August 2026',
}, [
  'Site Assessment',
  'Ensure Constructions',
  'Storm damage',
  'Exposed wiring in ceiling',
  'Approve',
  'Engineer',
]);

console.log('\nAll template smoke tests passed.');
