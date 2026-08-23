/**
 * Patches Request for Quotation Template.docx with docx-templates merge tags.
 * Delimiters: << >> (pass cmdDelimiter: ['<<', '>>'] to createReport).
 * Restores from "Request for Quotation Template - Copy.docx" so the script is idempotent.
 * Line items live in one page-anchored frame below the Description header so they
 * stay in the table body instead of flowing to the top of the page.
 * Run: node data/templates/_patch-rfq-template.mjs
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
const templatePath = path.join(__dirname, 'Request for Quotation Template.docx');
const sourcePath = path.join(__dirname, 'Request for Quotation Template - Copy.docx');

/** Same framePr on adjacent paragraphs → Word treats them as one growing frame. */
const ITEM_FRAME_PR =
  '<w:framePr w:w="9977" w:wrap="none" w:vAnchor="page" w:hAnchor="page" w:x="1496" w:y="7700"/>';

/** Tab stops relative to the item frame, aligned with Quantity / Rate / Amount headers. */
const ITEM_TABS =
  '<w:tabs>' +
  '<w:tab w:val="center" w:pos="6321"/>' +
  '<w:tab w:val="center" w:pos="7264"/>' +
  '<w:tab w:val="right" w:pos="8458"/>' +
  '<w:tab w:val="right" w:pos="9977"/>' +
  '</w:tabs>';

const RUN_PR =
  '<w:rPr><w:rFonts w:eastAsia="Franklin Gothic Medium Cond" w:cs="Franklin Gothic Medium Cond"/><w:sz w:val="16"/></w:rPr>';
const RUN_PR_BOLD =
  '<w:rPr><w:rFonts w:eastAsia="Franklin Gothic Medium Cond" w:cs="Franklin Gothic Medium Cond"/><w:b/><w:sz w:val="16"/></w:rPr>';

function escapeMerge(text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceSdtText(xml, tag, newText) {
  const re = new RegExp(`(w:tag w:val="${tag}"[\\s\\S]*?<w:t[^>]*>)([^<]*)(</w:t>)`);
  if (!re.test(xml)) throw new Error(`SDT tag not found: ${tag}`);
  return xml.replace(re, `$1${escapeMerge(newText)}$3`);
}

function removeParagraphWithTag(xml, tag) {
  const tagIdx = xml.indexOf(`w:tag w:val="${tag}"`);
  if (tagIdx === -1) throw new Error(`Tag not found for removal: ${tag}`);
  const paraStart = xml.lastIndexOf('<w:p ', tagIdx);
  const paraEnd = xml.indexOf('</w:p>', tagIdx);
  if (paraStart === -1 || paraEnd === -1) throw new Error(`Paragraph bounds not found: ${tag}`);
  return xml.slice(0, paraStart) + xml.slice(paraEnd + '</w:p>'.length);
}

function removeParagraphWithFrameY(xml, y) {
  const marker = `w:y="${y}"`;
  const idx = xml.indexOf(marker);
  if (idx === -1) return xml;
  const paraStart = xml.lastIndexOf('<w:p ', idx);
  const paraEnd = xml.indexOf('</w:p>', idx);
  if (paraStart === -1 || paraEnd === -1) return xml;
  return xml.slice(0, paraStart) + xml.slice(paraEnd + '</w:p>'.length);
}

function insertAfterFrameY(xml, y, text) {
  const marker = `w:y="${y}"`;
  const idx = xml.indexOf(marker);
  if (idx === -1) throw new Error(`frame y=${y} not found`);
  const paraEnd = xml.indexOf('</w:p>', idx) + '</w:p>'.length;
  return xml.slice(0, paraEnd) + text + xml.slice(paraEnd);
}

function framedPara(innerXml, { tabs = false } = {}) {
  const pPr =
    `<w:pPr>${ITEM_FRAME_PR}${tabs ? ITEM_TABS : ''}` +
    `<w:spacing w:before="40" w:after="40" w:line="240" w:lineRule="auto"/></w:pPr>`;
  return `<w:p>${pPr}${innerXml}</w:p>`;
}

function textRun(text, { bold = false } = {}) {
  return `<w:r>${bold ? RUN_PR_BOLD : RUN_PR}<w:t xml:space="preserve">${escapeMerge(text)}</w:t></w:r>`;
}

function tabRun() {
  return `<w:r>${RUN_PR}<w:tab/></w:r>`;
}

function cmdPara(cmd) {
  return framedPara(textRun(cmd));
}

function itemRow(itemVar) {
  return framedPara(
    [
      textRun(`<<${itemVar}.description>>`),
      tabRun(),
      textRun(`<<${itemVar}.quantity>>`),
      tabRun(),
      textRun(`<<${itemVar}.category>>`),
      tabRun(),
      textRun(`<<${itemVar}.unit_cost>>`),
      tabRun(),
      textRun(`<<${itemVar}.total>>`),
    ].join(''),
    { tabs: true },
  );
}

function lineItemBlock() {
  return [
    cmdPara('<<FOR group IN groups>>'),
    cmdPara('<<FOR scope IN $group.scopes>>'),
    framedPara(textRun('<<$scope.name>>', { bold: true })),
    cmdPara('<<FOR item IN $scope.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $scope.combos>>'),
    framedPara(textRun('<<$combo.name>>', { bold: true })),
    cmdPara('<<FOR item IN $combo.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR scope>>'),
    cmdPara('<<FOR item IN $group.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $group.combos>>'),
    framedPara(textRun('<<$combo.name>>', { bold: true })),
    cmdPara('<<FOR item IN $combo.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR group>>'),
  ].join('');
}

function patchTemplate(xml) {
  let out = xml;

  out = replaceSdtText(out, 'TO_NAME', '<<to.name>>');
  out = replaceSdtText(out, 'SUPPLIER_NAME', '<<to.company>>');
  out = replaceSdtText(out, 'SUPPLIER_ADDRESS_1', '<<to.address_line1>>');
  out = replaceSdtText(out, 'SUPPLIER_ADDRESS_2', '<<to.address_line2>>');
  out = replaceSdtText(out, 'RFQ_NUMBER', '<<rfq_number>>');
  out = replaceSdtText(out, 'DATE_ISSUED', '<<sent_date>>');

  out = replaceSdtText(out, 'CLIENT_NAME', '<<client.name>>');
  out = replaceSdtText(out, 'CLIENT_ADDRESS_1', '<<client.address_line1>>');
  out = replaceSdtText(out, 'CLIENT_ADDRESS_2', '<<client.address_line2>>');
  out = replaceSdtText(out, 'CLIENT_HOME_PHONE', '<<client.home_phone>>');
  out = replaceSdtText(out, 'CLIENT_MOBILE_PHONE', '<<client.mobile_phone>>');
  out = replaceSdtText(out, 'CLIENT_OTHER_PHONE', '<<client.other_phone>>');
  out = replaceSdtText(out, 'CLIENT_EMAIL', '<<client.email>>');
  out = replaceSdtText(out, 'TENANT_NAME', '<<tenant.name>>');
  out = replaceSdtText(out, 'TENANT_HOME_PHONE', '<<tenant.home_phone>>');
  out = replaceSdtText(out, 'TENANT_MOBILE_PHONE', '<<tenant.mobile_phone>>');
  out = replaceSdtText(out, 'TENANT_OTHER_PHONE', '<<tenant.other_phone>>');

  out = replaceSdtText(out, 'SUBTOTAL', '<<subtotal>>');
  out = replaceSdtText(out, 'GST', '<<tax>>');
  out = replaceSdtText(out, 'QUOTATION_TOTAL', '<<total>>');

  for (const tag of [
    'ITEM_3_AMOUNT',
    'ITEM_3_RATE',
    'ITEM_3_UNIT',
    'ITEM_3_QUANTITY',
    'ITEM_3_DESCRIPTION',
    'ITEM_2_AMOUNT',
    'ITEM_2_RATE',
    'ITEM_2_UNIT',
    'ITEM_2_QUANTITY',
    'ITEM_2_DESCRIPTION',
    'ITEM_1_AMOUNT',
    'ITEM_1_RATE',
    'ITEM_1_UNIT',
    'ITEM_1_QUANTITY',
    'ITEM_1_DESCRIPTION',
    'ITEM_SECTION',
  ]) {
    out = removeParagraphWithTag(out, tag);
  }

  // Sample row rules that would overlay the growing item frame.
  for (const y of ['7946', '8248', '8550', '9275']) {
    out = removeParagraphWithFrameY(out, y);
  }

  out = insertAfterFrameY(out, '7644', lineItemBlock());

  return out;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source template not found: ${sourcePath}`);
}
const sourceBuf = fs.readFileSync(sourcePath);
fs.writeFileSync(templatePath, sourceBuf);

const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
const xmlPath = 'word/document.xml';
zip.file(xmlPath, patchTemplate(zip.file(xmlPath).asText()));
fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Patched:', templatePath);
