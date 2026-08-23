/**
 * Patches Purchase Order Template.docx with docx-templates merge tags.
 * Delimiters: << >> (pass cmdDelimiter: ['<<', '>>'] to createReport).
 * Run: node data/templates/_patch-po-template.mjs
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
const templatePath = path.join(__dirname, 'Purchase Order Template.docx');

const ITEM_TAGS = [
  'ITEM_1_DESCRIPTION',
  'ITEM_1_QUANTITY',
  'ITEM_1_UNIT',
  'ITEM_1_RATE',
  'ITEM_1_AMOUNT',
];

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

function stripFrameFromTagParagraph(xml, tag) {
  const tagIdx = xml.indexOf(`w:tag w:val="${tag}"`);
  if (tagIdx === -1) return xml;
  const paraStart = xml.lastIndexOf('<w:p ', tagIdx);
  const frameStart = xml.indexOf('<w:framePr ', paraStart);
  if (frameStart === -1 || frameStart > tagIdx) return xml;
  const frameEnd = xml.indexOf('/>', frameStart) + 2;
  return xml.slice(0, frameStart) + xml.slice(frameEnd);
}

function insertBeforeParagraph(xml, tag, text) {
  const tagIdx = xml.indexOf(`w:tag w:val="${tag}"`);
  const paraStart = xml.lastIndexOf('<w:p ', tagIdx);
  return xml.slice(0, paraStart) + text + xml.slice(paraStart);
}

function insertAfterParagraph(xml, tag, text) {
  const tagIdx = xml.indexOf(`w:tag w:val="${tag}"`);
  const paraEnd = xml.indexOf('</w:p>', tagIdx) + '</w:p>'.length;
  return xml.slice(0, paraEnd) + text + xml.slice(paraEnd);
}

function cmdPara(cmd) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeMerge(cmd)}</w:t></w:r></w:p>`;
}

function patchTemplate(xml) {
  let out = xml;

  out = replaceSdtText(out, 'TO_NAME', '<<to.name>>');
  out = replaceSdtText(out, 'SUPPLIER_NAME', '<<to.name>>');
  out = replaceSdtText(out, 'SUPPLIER_ADDRESS_1', '<<to.address>>');
  out = replaceSdtText(out, 'SUPPLIER_ADDRESS_2', ' ');
  out = replaceSdtText(out, 'PURCHASE_ORDER_NUMBER', '<<po_number>>');
  out = replaceSdtText(out, 'DATE_PRINTED', '<<date>>');

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

  out = replaceSdtText(out, 'SUBTOTAL', ' ');
  out = replaceSdtText(out, 'GST', ' ');
  out = replaceSdtText(out, 'PURCHASE_ORDER_TOTAL', '<<total>>');

  for (const tag of [
    'ITEM_3_AMOUNT', 'ITEM_3_RATE', 'ITEM_3_UNIT', 'ITEM_3_QUANTITY', 'ITEM_3_DESCRIPTION',
    'ITEM_2_AMOUNT', 'ITEM_2_RATE', 'ITEM_2_UNIT', 'ITEM_2_QUANTITY', 'ITEM_2_DESCRIPTION',
  ]) {
    out = removeParagraphWithTag(out, tag);
  }

  out = replaceSdtText(out, 'ITEM_SECTION', '<<$scope.name>>');
  out = replaceSdtText(out, 'ITEM_1_DESCRIPTION', '<<$item.description>>');
  out = replaceSdtText(out, 'ITEM_1_QUANTITY', '<<$item.quantity>>');
  out = replaceSdtText(out, 'ITEM_1_UNIT', '<<$item.category>>');
  out = replaceSdtText(out, 'ITEM_1_RATE', '<<$item.unit_cost>>');
  out = replaceSdtText(out, 'ITEM_1_AMOUNT', '<<$item.total>>');

  for (const tag of ['ITEM_SECTION', ...ITEM_TAGS]) {
    out = stripFrameFromTagParagraph(out, tag);
  }

  const lineItemLoopTail = [
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $scope.combos>>'),
    cmdPara('<<$combo.name>>'),
    cmdPara('<<FOR item IN $combo.items>>'),
    cmdPara(
      '<<$item.description>>\t<<$item.quantity>>\t<<$item.category>>\t<<$item.unit_cost>>\t<<$item.total>>',
    ),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR scope>>'),
    cmdPara('<<FOR item IN $group.items>>'),
    cmdPara(
      '<<$item.description>>\t<<$item.quantity>>\t<<$item.category>>\t<<$item.unit_cost>>\t<<$item.total>>',
    ),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $group.combos>>'),
    cmdPara('<<$combo.name>>'),
    cmdPara('<<FOR item IN $combo.items>>'),
    cmdPara(
      '<<$item.description>>\t<<$item.quantity>>\t<<$item.category>>\t<<$item.unit_cost>>\t<<$item.total>>',
    ),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR group>>'),
  ].join('');

  out = insertBeforeParagraph(out, 'ITEM_SECTION', cmdPara('<<FOR group IN groups>>'));
  out = insertBeforeParagraph(out, 'ITEM_SECTION', cmdPara('<<FOR scope IN $group.scopes>>'));
  out = insertBeforeParagraph(out, 'ITEM_1_DESCRIPTION', cmdPara('<<FOR item IN $scope.items>>'));
  out = insertAfterParagraph(out, 'ITEM_1_AMOUNT', lineItemLoopTail);

  return out;
}

const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
const xmlPath = 'word/document.xml';
zip.file(xmlPath, patchTemplate(zip.file(xmlPath).asText()));
fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Patched:', templatePath);
