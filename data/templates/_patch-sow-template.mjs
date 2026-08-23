/**
 * Patches Scope of Work Template.docx with docx-templates merge tags for
 * scope line items, and moves Terms and Conditions onto their own page so
 * they no longer overlap the growing item frame.
 *
 * Delimiters: << >> (cmdDelimiter: ['<<', '>>']).
 * Run: node data/templates/_patch-sow-template.mjs
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
const templatePath = path.join(__dirname, 'Scope of Work Template.docx');

/** Below page-2 headers (Item Number / Area / Scope Line Item). Twips. */
const ITEM_FRAME_PR =
  '<w:framePr w:w="10400" w:wrap="none" w:vAnchor="page" w:hAnchor="page" w:x="1630" w:y="3472"/>';

const ITEM_TABS =
  '<w:tabs>' +
  '<w:tab w:val="left" w:pos="0"/>' +
  '<w:tab w:val="left" w:pos="2668"/>' +
  '</w:tabs>';

const RUN_PR =
  '<w:rPr><w:rFonts w:ascii="Roboto Condensed Medium" w:eastAsia="Roboto Condensed Medium" w:hAnsi="Roboto Condensed Medium" w:cs="Roboto Condensed Medium"/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';
const RUN_PR_BOLD =
  '<w:rPr><w:rFonts w:ascii="Roboto Condensed Medium" w:eastAsia="Roboto Condensed Medium" w:hAnsi="Roboto Condensed Medium" w:cs="Roboto Condensed Medium"/><w:b/><w:color w:val="000000"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>';

function escapeMerge(text) {
  return text.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
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

function nameRow(varPath) {
  return framedPara(textRun(`<<${varPath}>>`, { bold: true }));
}

function nameAndDescriptionRow(nameVar, descriptionVar) {
  return framedPara(
    [textRun(`<<${nameVar}>>`, { bold: true }), tabRun(), textRun(`<<${descriptionVar}>>`)].join(
      '',
    ),
    { tabs: true },
  );
}

function lineItemBlock() {
  return [
    cmdPara('<<FOR group IN groups>>'),
    nameRow('$group.name'),
    cmdPara('<<FOR scope IN $group.scopes>>'),
    nameAndDescriptionRow('$scope.name', '$scope.description'),
    cmdPara('<<FOR item IN $scope.items>>'),
    nameAndDescriptionRow('$item.name', '$item.description'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $scope.combos>>'),
    nameAndDescriptionRow('$combo.name', '$combo.description'),
    cmdPara('<<FOR item IN $combo.items>>'),
    nameAndDescriptionRow('$item.name', '$item.description'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR scope>>'),
    cmdPara('<<FOR item IN $group.items>>'),
    nameAndDescriptionRow('$item.name', '$item.description'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<FOR combo IN $group.combos>>'),
    nameAndDescriptionRow('$combo.name', '$combo.description'),
    cmdPara('<<FOR item IN $combo.items>>'),
    nameAndDescriptionRow('$item.name', '$item.description'),
    cmdPara('<<END-FOR item>>'),
    cmdPara('<<END-FOR combo>>'),
    cmdPara('<<END-FOR group>>'),
  ].join('');
}

const TC_BOX_NAMES = [
  'TextBox127',
  'TextBox128',
  'TextBox129',
  'TextBox130',
  'TextBox131',
  'TextBox132',
  'TextBox133',
  'TextBox134',
  'TextBox135',
  'TextBox136',
];

/** Move T&C from 225.2pt (under item headers) to 57pt on the new page. */
const TC_Y_SHIFT_PT = 168.2;
const TC_Y_SHIFT_EMU = Math.round(TC_Y_SHIFT_PT * 12700);

const PAGE_BREAK_PARA =
  '<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>' +
  '<w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>';

function insertAfterPageBreak(xml, text) {
  const marker = '<w:br w:type="page"/>';
  const idx = xml.indexOf(marker);
  if (idx === -1) throw new Error('Page break not found');
  const paraEnd = xml.indexOf('</w:p>', idx);
  if (paraEnd === -1) throw new Error('Page-break paragraph end not found');
  const insertAt = paraEnd + '</w:p>'.length;
  return xml.slice(0, insertAt) + text + xml.slice(insertAt);
}

function findRunBounds(xml, marker) {
  const idx = xml.indexOf(marker);
  if (idx === -1) throw new Error(`marker not found: ${marker}`);
  const start = xml.lastIndexOf('<w:r>', idx);
  if (start === -1) throw new Error(`run start not found for ${marker}`);
  let i = start + 4;
  let depth = 1;
  let inTxbx = 0;
  while (i < xml.length && depth > 0) {
    if (xml.startsWith('<w:txbxContent', i)) {
      i = xml.indexOf('>', i) + 1;
      inTxbx += 1;
      continue;
    }
    if (xml.startsWith('</w:txbxContent>', i)) {
      inTxbx -= 1;
      i += 16;
      continue;
    }
    if (inTxbx === 0 && xml.startsWith('<w:r', i) && (xml[i + 4] === '>' || xml[i + 4] === ' ')) {
      depth += 1;
    } else if (inTxbx === 0 && xml.startsWith('</w:r>', i)) {
      depth -= 1;
      if (depth === 0) return { start, end: i + 6 };
      i += 6;
      continue;
    }
    i += 1;
  }
  throw new Error(`run end not found for ${marker}`);
}

function findBodyParagraphEnd(xml, marker) {
  const idx = xml.indexOf(marker);
  if (idx === -1) throw new Error(`marker not found: ${marker}`);
  let i = idx;
  let inTxbx = 0;
  let depth = 1;
  while (i < xml.length && depth > 0) {
    if (xml.startsWith('<w:txbxContent', i)) {
      i = xml.indexOf('>', i) + 1;
      inTxbx += 1;
      continue;
    }
    if (xml.startsWith('</w:txbxContent>', i)) {
      inTxbx -= 1;
      i += 16;
      continue;
    }
    if (inTxbx === 0 && xml.startsWith('<w:p', i) && (xml[i + 4] === '>' || xml[i + 4] === ' ')) {
      depth += 1;
    } else if (inTxbx === 0 && xml.startsWith('</w:p>', i)) {
      depth -= 1;
      if (depth === 0) return i + 6;
      i += 6;
      continue;
    }
    i += 1;
  }
  throw new Error(`paragraph end not found for ${marker}`);
}

function shiftTermsY(runXml) {
  let out = runXml.replace(
    /<wp:positionV relativeFrom="page"><wp:posOffset>(\d+)/g,
    (_, n) =>
      `<wp:positionV relativeFrom="page"><wp:posOffset>${Math.max(0, Number(n) - TC_Y_SHIFT_EMU)}`,
  );
  out = out.replace(/margin-top:([\d.]+)pt/g, (_, n) => {
    const next = Math.max(0, Number(n) - TC_Y_SHIFT_PT);
    return `margin-top:${Number(next.toFixed(1))}pt`;
  });
  return out;
}

function termsAlreadyOnOwnPage(xml) {
  const firstBr = xml.indexOf('w:type="page"');
  if (firstBr === -1) return false;
  const secondBr = xml.indexOf('w:type="page"', firstBr + 1);
  const terms = xml.indexOf('name="TextBox127"');
  return secondBr !== -1 && terms > secondBr;
}

function moveTermsToNewPage(xml) {
  if (termsAlreadyOnOwnPage(xml)) {
    console.log('Terms and Conditions already on their own page — skipping');
    return xml;
  }

  const bounds = TC_BOX_NAMES.map((name) => findRunBounds(xml, `name="${name}"`)).sort(
    (a, b) => a.start - b.start,
  );
  const runs = bounds.map((b) => shiftTermsY(xml.slice(b.start, b.end)));

  let out = xml;
  for (const b of [...bounds].reverse()) {
    out = out.slice(0, b.start) + out.slice(b.end);
  }

  const pageTwoEnd = findBodyParagraphEnd(out, 'name="TextBox117"');
  const termsPara = `<w:p><w:pPr><w:spacing w:after="0" w:line="20" w:lineRule="exact"/></w:pPr>${runs.join('')}</w:p>`;
  out = out.slice(0, pageTwoEnd) + PAGE_BREAK_PARA + termsPara + out.slice(pageTwoEnd);

  out = out.replaceAll('Page 1 of 2', 'Page 1 of 3');
  out = out.replaceAll('Page 2 of 2', 'Page 2 of 3');
  return out;
}

function patchTemplate(xml) {
  let out = xml;
  if (!out.includes('FOR group IN groups')) {
    out = insertAfterPageBreak(out, lineItemBlock());
  } else {
    console.log('Line-item loops already present — skipping insert');
  }
  return moveTermsToNewPage(out);
}

const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
const xmlPath = 'word/document.xml';
zip.file(xmlPath, patchTemplate(zip.file(xmlPath).asText()));
fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Patched:', templatePath);
