/**
 * Builds Invoice Template.docx from Purchase Order Template.docx.
 * Header/parties/totals follow the PO layout. Line items sit in one
 * page-anchored frame under the Description header (same approach as RFQ)
 * so they grow in the table body instead of flowing to the top of the page.
 * Item rows use Scope of Work name + description plus PO qty/rate/amount.
 *
 * Delimiters: << >> (cmdDelimiter: ['<<', '>>']).
 * Run: node data/templates/_create-invoice-template.mjs
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
const sourcePath = path.join(__dirname, 'Purchase Order Template.docx');
const outputPath = path.join(__dirname, 'Invoice Template.docx');

/** Same framePr on adjacent paragraphs → Word treats them as one growing frame. */
const ITEM_FRAME_PR =
  '<w:framePr w:w="9977" w:wrap="none" w:vAnchor="page" w:hAnchor="page" w:x="1496" w:y="7700"/>';

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

const ITEM_SDT_TAGS = [
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
];

const LOOP_MARKERS = [
  'FOR group IN groups',
  'FOR scope IN',
  'FOR item IN',
  'FOR combo IN',
  'END-FOR',
  '$group.name',
  '$scope.name',
  '$scope.description',
  '$combo.name',
  '$combo.description',
  '$item.name',
  '$item.description',
  '$item.quantity',
  '$item.category',
  '$item.unit_cost',
  '$item.total',
];

function escapeMerge(text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function replaceSdtText(xml, tag, newText) {
  const re = new RegExp(`(w:tag w:val="${tag}"[\\s\\S]*?<w:t[^>]*>)([^<]*)(</w:t>)`);
  if (!re.test(xml)) {
    console.warn(`SDT tag not found (skipped): ${tag}`);
    return xml;
  }
  return xml.replace(re, `$1${escapeMerge(newText)}$3`);
}

function paraStartBefore(xml, idx) {
  const withAttrs = xml.lastIndexOf('<w:p ', idx);
  const bare = xml.lastIndexOf('<w:p>', idx);
  return Math.max(withAttrs, bare);
}

function removeParagraphWithTag(xml, tag) {
  const tagIdx = xml.indexOf(`w:tag w:val="${tag}"`);
  if (tagIdx === -1) return xml;
  const paraStart = paraStartBefore(xml, tagIdx);
  const paraEnd = xml.indexOf('</w:p>', tagIdx);
  if (paraStart === -1 || paraEnd === -1) return xml;
  return xml.slice(0, paraStart) + xml.slice(paraEnd + '</w:p>'.length);
}

function removeParagraphContaining(xml, marker) {
  const idx = xml.indexOf(marker);
  if (idx === -1) return xml;
  const paraStart = paraStartBefore(xml, idx);
  const paraEnd = xml.indexOf('</w:p>', idx);
  if (paraStart === -1 || paraEnd === -1) return xml;
  return xml.slice(0, paraStart) + xml.slice(paraEnd + '</w:p>'.length);
}

function removeAllParagraphsContaining(xml, marker) {
  let out = xml;
  for (let i = 0; i < 200; i += 1) {
    const next = removeParagraphContaining(out, marker);
    if (next === out) break;
    out = next;
  }
  return out;
}

function removeParagraphWithFrameY(xml, y) {
  const marker = `w:y="${y}"`;
  const idx = xml.indexOf(marker);
  if (idx === -1) return xml;
  const paraStart = paraStartBefore(xml, idx);
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

function headingRow(nameVar, descriptionVar) {
  const parts = [textRun(`<<${nameVar}>>`, { bold: true })];
  if (descriptionVar) {
    parts.push(textRun('  '), textRun(`<<${descriptionVar}>>`));
  }
  return framedPara(parts.join(''));
}

function itemRow(itemVar) {
  return framedPara(
    [
      textRun(`<<${itemVar}.name>>`, { bold: true }),
      textRun('  '),
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
    headingRow('$group.name'),
    cmdPara('<<FOR scope IN $group.scopes>>'),
    headingRow('$scope.name', '$scope.description'),
    cmdPara('<<FOR item IN $scope.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $scope.combos>>'),
    headingRow('$combo.name', '$combo.description'),
    cmdPara('<<FOR item IN $combo.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR scope>>'),
    cmdPara('<<FOR item IN $group.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $group.combos>>'),
    headingRow('$combo.name', '$combo.description'),
    cmdPara('<<FOR item IN $combo.items>>'),
    itemRow('$item'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR group>>'),
  ].join('');
}

function patchTemplate(xml) {
  let out = xml;

  out = out.replaceAll('Purchase Order Total', 'Invoice Total');
  out = out.replaceAll(
    'Purchase Order Number MUST be quoted on your Invoice.',
    'Invoice Number MUST be quoted with remittance.',
  );
  out = out.replaceAll('Purchase Order', 'Tax Invoice');
  out = out.replaceAll('&lt;&lt;po_number&gt;&gt;', '&lt;&lt;invoice_number&gt;&gt;');

  out = replaceSdtText(out, 'PURCHASE_ORDER_NUMBER', '<<invoice_number>>');
  out = replaceSdtText(out, 'PURCHASE_ORDER_TOTAL', '<<total>>');
  out = replaceSdtText(out, 'SUBTOTAL', '<<subtotal>>');
  out = replaceSdtText(out, 'GST', '<<tax>>');

  out = out.replaceAll('w:val="PURCHASE_ORDER_NUMBER"', 'w:val="INVOICE_NUMBER"');
  out = out.replaceAll('w:val="Purchase Order Number"', 'w:val="Invoice Number"');
  out = out.replaceAll('w:val="PURCHASE_ORDER_TOTAL"', 'w:val="INVOICE_TOTAL"');
  out = out.replaceAll('w:val="Purchase Order Total"', 'w:val="Invoice Total"');

  for (const tag of ITEM_SDT_TAGS) {
    out = removeParagraphWithTag(out, tag);
  }
  for (const marker of LOOP_MARKERS) {
    out = removeAllParagraphsContaining(out, marker);
  }
  for (const y of ['7946', '8248', '8550', '9054', '9275']) {
    out = removeParagraphWithFrameY(out, y);
  }

  if (!out.includes('w:y="7700"')) {
    out = insertAfterFrameY(out, '7644', lineItemBlock());
  }

  return out;
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source template not found: ${sourcePath}`);
}

const sourceBuf = fs.readFileSync(sourcePath);
const zip = new PizZip(sourceBuf);
const xmlPath = 'word/document.xml';
zip.file(xmlPath, patchTemplate(zip.file(xmlPath).asText()));
const output = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeOutput(buffer) {
  let lastErr = null;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      fs.writeFileSync(outputPath, buffer);
      console.log('Wrote:', outputPath);
      return;
    } catch (err) {
      lastErr = err;
      if (!err || err.code !== 'EBUSY') throw err;
      await sleep(500);
    }
  }
  throw lastErr;
}

await writeOutput(output);
