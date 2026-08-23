/**
 * Generates Assessment Template.docx (and ASSESSMENT.docx for provisioning)
 * with docx-templates merge tags matching assessment.mapper fields.
 *
 * Reuses styles, theme, fonts, and header images from Scope of Work Template.docx.
 * Delimiters: << >> (cmdDelimiter: ['<<', '>>']).
 *
 * Run: node data/templates/_create-assessment-template.mjs
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../apps/api/package.json'),
);
const PizZip = require('pizzip');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sowPath = path.join(__dirname, 'Scope of Work Template.docx');
const outputNames = ['Assessment Template.docx', 'ASSESSMENT.docx'];

/** Anchored logo runs copied from Scope of Work page 1 (image1 + image2). */
function extractSowLogoRuns(sowDocumentXml) {
  const firstPageBreak = sowDocumentXml.indexOf('w:type="page"');
  const page1 = firstPageBreak === -1 ? sowDocumentXml : sowDocumentXml.slice(0, firstPageBreak);
  const runs = [...page1.matchAll(/<w:r>[\s\S]*?r:embed="rId\d+"[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
  const logoRuns = runs.filter((r) => r.includes('wp:anchor'));
  if (logoRuns.length < 2) {
    throw new Error('Expected two anchored logo runs in Scope of Work Template.docx page 1');
  }
  return logoRuns.slice(0, 2);
}

const FONT =
  'Roboto Condensed Medium';
const ACCENT = '000080'; // navy blue — matches Request for Quotation template headings
const LABEL_COLOR = '475569';
const BODY_SIZE = '20'; // 10pt
const TITLE_SIZE = '48'; // 24pt
const SECTION_SIZE = '28'; // 14pt

function esc(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function rPr({ bold = false, color = '000000', size = BODY_SIZE, underline = false } = {}) {
  return (
    '<w:rPr>' +
    `<w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/>` +
    (bold ? '<w:b/>' : '') +
    (underline ? '<w:u w:val="single"/>' : '') +
    `<w:color w:val="${color}"/>` +
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>` +
    '</w:rPr>'
  );
}

function run(text, opts) {
  const preserve = text.startsWith(' ') || text.endsWith(' ') ? ' xml:space="preserve"' : '';
  return `<w:r>${rPr(opts)}<w:t${preserve}>${esc(text)}</w:t></w:r>`;
}

function mergeTag(field) {
  return run(`<<${field}>>`);
}

function para(children, { spacingBefore = 0, spacingAfter = 120, pageBreakBefore = false } = {}) {
  const pPr =
    '<w:pPr>' +
    (pageBreakBefore ? '<w:pageBreakBefore/>' : '') +
    `<w:spacing w:before="${spacingBefore}" w:after="${spacingAfter}" w:line="276" w:lineRule="auto"/>` +
    '</w:pPr>';
  const inner = Array.isArray(children) ? children.join('') : children;
  return `<w:p>${pPr}${inner}</w:p>`;
}

function titlePara(text) {
  const pPr =
    '<w:pPr>' +
    '<w:jc w:val="center"/>' +
    '<w:spacing w:before="2200" w:after="200" w:line="276" w:lineRule="auto"/>' +
    '</w:pPr>';
  return `<w:p>${pPr}${run(text, { bold: true, color: ACCENT, size: TITLE_SIZE })}</w:p>`;
}

function sectionPara(text) {
  return para(run(text, { bold: true, color: ACCENT, size: SECTION_SIZE, underline: true }), {
    spacingBefore: 360,
    spacingAfter: 160,
  });
}

function fieldRow(label, field) {
  return para([run(`${label}: `, { bold: true, color: LABEL_COLOR }), mergeTag(field)], {
    spacingAfter: 80,
  });
}

function blankLine() {
  return para(run(' '), { spacingBefore: 0, spacingAfter: 0 });
}

/** Two-column style row using tab stop. */
function fieldRow2(col1Label, col1Field, col2Label, col2Field) {
  const tabs = '<w:tabs><w:tab w:val="left" w:pos="5200"/></w:tabs>';
  const pPr =
    '<w:pPr>' +
    tabs +
    '<w:spacing w:before="0" w:after="80" w:line="276" w:lineRule="auto"/>' +
    '</w:pPr>';
  const inner = [
    run(`${col1Label}: `, { bold: true, color: LABEL_COLOR }),
    mergeTag(col1Field),
    run('\t'),
    run(`${col2Label}: `, { bold: true, color: LABEL_COLOR }),
    mergeTag(col2Field),
  ].join('');
  return `<w:p>${pPr}${inner}</w:p>`;
}

function multilineField(label, field) {
  return [
    para(run(label, { bold: true, color: LABEL_COLOR }), { spacingAfter: 40 }),
    para(mergeTag(field), { spacingAfter: 120 }),
  ].join('');
}

const SECTIONS = [
  {
    title: 'Document Summary',
    rows: [
      ['Company', 'company_name', 'Assessment', 'assessment_name'],
      ['Status', 'status', 'Job', 'job_name'],
      ['Job reference', 'job_reference', 'Report date', 'report_date'],
      ['Created', 'created_at', null, null],
    ],
    multiline: [],
  },
  {
    title: '1. Attendance',
    rows: [
      ['Risk address attended', 'address_attended', 'Other address', 'other_address'],
      ['Site attendance date', 'date_booked', 'Persons attending', 'persons_attending'],
      ['Builder / estimator', 'builder_estimator_name', 'Builder phone', 'builder_estimator_phone'],
      ['Insurer assessor attended', 'iag_inspection_required', 'Assessor name', 'insurance_assessor_name'],
      ['Assessor phone', 'insurance_assessor_phone', 'Occupancy type', 'occupancy_type'],
    ],
    multiline: [],
  },
  {
    title: '2. Building',
    rows: [
      ['House m²', 'square_metres', 'Estimated build year', 'building_age'],
      ['Building type', 'building_type', 'Design type', 'design_type'],
      ['Construction', 'construction', 'Roof type', 'roof_type'],
      ['Main roof damage', 'main_roof_damage', 'Condition acceptable', 'overall_condition_acceptable'],
      ['Furniture removal / storage', 'furniture_removal_storage', 'Detached garage', 'detached_garage'],
      ['Sheds', 'sheds', 'Swimming pool', 'swimming_pool'],
      ['Granny flat', 'detached_granny_flat', null, null],
    ],
    multiline: [
      ['Additional structures', 'additional_structures'],
      ['Other structures', 'other_structures'],
    ],
  },
  {
    title: '3. Habitability',
    rows: [['Habitable', 'habitable', null, null]],
    multiline: [
      ['Uninhabitable reason', 'uninhabitable_reason'],
      ['Other uninhabitable reason', 'other_uninhabitable_reason'],
    ],
  },
  {
    title: '4. Hazards',
    rows: [
      ['Pool fencing hazard', 'hazard_pool_fencing', 'Electrical / gas hazard', 'hazard_electrical_gas'],
      ['Sewerage hazard', 'hazard_sewerage', 'Structural hazard', 'hazard_structural'],
      ['Mould on site', 'mould', 'Asbestos on site', 'asbestos_on_site'],
    ],
    multiline: [
      ['Pool fencing details', 'hazard_pool_fencing_comment'],
      ['Electrical / gas hazard', 'hazard_electrical_gas_comment'],
      ['Sewerage hazard', 'hazard_sewerage_comment'],
      ['Structural hazard', 'hazard_structural_comment'],
      ['Other hazards', 'hazard_other'],
      ['Safety hazards (summary)', 'safety_hazards'],
      ['Environmental hazards', 'environmental_hazards'],
    ],
  },
  {
    title: '5. Damage & Cause',
    rows: [
      ['Damage caused by listed event', 'damage_caused_by_listed_event', 'Pre-existing maintenance', 'pre_existing_maintenance_issues'],
    ],
    multiline: [
      ['Damage observed', 'resultant_damage'],
      ['Cause of damage', 'cause_of_damage'],
      ['Pre-existing related damage', 'pre_existing_relate_damage'],
      ['Maintenance defect issues', 'maintenance_related_issues'],
      ['Works required to address damage', 'works_required_to_address_damage'],
    ],
  },
  {
    title: '6. Make Safe',
    rows: [
      ['Make safe required', 'make_safe', 'Make safe type', 'make_safe_type'],
      ['Make-safe completion date', 'make_safe_completion_date', 'Main roof repaired', 'date_main_roof_repaired'],
    ],
    multiline: [],
  },
  {
    title: '7. Temporary Accommodation',
    rows: [
      ['TA / loss of rent required', 'temp_accom_required', 'Estimated amount', 'temp_accom_estimated_amount'],
      ['Estimated duration', 'temp_accom_estimated_duration', 'Required immediately', 'temp_accom_required_immediately'],
      ['Immediate estimate (days)', 'temp_accom_immediate_estimate_days', 'Required during repairs', 'temp_accom_required_during_repairs'],
      ['During-repairs estimate (days)', 'temp_accom_repairs_estimate_days', null, null],
    ],
    multiline: [
      ['Temporary repairs to make livable', 'temp_repairs_to_make_livable'],
      ['Work while in accommodation', 'work_while_in_accommodation'],
    ],
  },
  {
    title: '8. Specialists',
    rows: [
      ['Specialist required', 'specialist_required', 'Specialist type', 'specialist_type'],
    ],
    multiline: [],
  },
  {
    title: '9. Recommendation',
    rows: [
      ['Claim recommendation', 'claim_recommendation', 'Cost estimate for repairs', 'cost_estimate_for_repairs'],
      ['Estimated repair time', 'estimated_repair_time', 'Repair duration unit', 'estimated_repair_duration'],
      ['Insured advised', 'insured_advised', 'Client willing to proceed', 'client_willing_to_proceed'],
      ['Customer arranged repairs', 'customer_arranged_repairs', 'Builder licences', 'builder_licenses'],
    ],
    multiline: [
      ['Arranged repair comments', 'arranged_repair_comments'],
      ['Client discussions', 'client_discussion'],
      ['Special notes', 'comments'],
      ['Conclusion', 'variances_of_scope'],
    ],
  },
];

function headerBlock(logoRuns) {
  const logoPara =
    '<w:p>' +
    '<w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>' +
    logoRuns.join('') +
    '</w:p>';

  return (
    logoPara +
    titlePara('BUILDER ASSESSMENT') +
    para(
      [
        run('Prepared by: ', { bold: true, color: LABEL_COLOR }),
        mergeTag('company_name'),
        run('    |    '),
        run('Date: ', { bold: true, color: LABEL_COLOR }),
        mergeTag('report_date'),
      ].join(''),
      { spacingAfter: 200 },
    )
  );
}

function buildDocumentXml(logoRuns) {
  let body = headerBlock(logoRuns);

  for (const section of SECTIONS) {
    body += sectionPara(section.title);
    for (const row of section.rows) {
      const [l1, f1, l2, f2] = row;
      if (l2 && f2) {
        body += fieldRow2(l1, f1, l2, f2);
      } else if (l1 && f1) {
        body += fieldRow(l1, f1);
      }
    }
    for (const [label, field] of section.multiline) {
      body += multilineField(label, field);
    }
  }

  body += blankLine();
  body +=
    '<w:sectPr>' +
    '<w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/>' +
    '<w:cols w:space="708"/>' +
    '<w:docGrid w:linePitch="360"/>' +
    '</w:sectPr>';

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" ' +
    'xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" ' +
    'xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:v="urn:schemas-microsoft-com:vml" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" ' +
    'xmlns:w10="urn:schemas-microsoft-com:office:word" ' +
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" ' +
    'xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" ' +
    'xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" ' +
    'mc:Ignorable="w14 w15 wp14">' +
    `<w:body>${body}</w:body></w:document>`
  );
}

function patchRels(relsXml) {
  if (relsXml.includes('image1.png')) return relsXml;
  return relsXml;
}

if (!fs.existsSync(sowPath)) {
  throw new Error(`Source template not found: ${sowPath}`);
}

const sowZip = new PizZip(fs.readFileSync(sowPath));
const sowDocumentXml = sowZip.file('word/document.xml').asText();
const logoRuns = extractSowLogoRuns(sowDocumentXml);
const documentXml = buildDocumentXml(logoRuns);

for (const outputName of outputNames) {
  const zip = new PizZip(sowZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  zip.file('word/document.xml', documentXml);
  const relsPath = 'word/_rels/document.xml.rels';
  if (zip.file(relsPath)) {
    zip.file(relsPath, patchRels(zip.file(relsPath).asText()));
  }
  const corePath = 'docProps/core.xml';
  if (zip.file(corePath)) {
    let core = zip.file(corePath).asText();
    core = core.replace(/<dc:title>[^<]*<\/dc:title>/, '<dc:title>Builder Assessment</dc:title>');
    zip.file(corePath, core);
  }
  const outPath = path.join(__dirname, outputName);
  fs.writeFileSync(outPath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
  console.log('Created:', outPath);
}
