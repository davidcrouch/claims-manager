import PizZip from 'pizzip';

const PAGE_WIDTH = 400;
const PAGE_HEIGHT = 566;
const MARGIN_X = 22;
const TITLE_SIZE = 13;
const BODY_SIZE = 12;
const LINE_HEIGHT = 17;
const MAX_BODY_LINES = 26;
const CHARS_PER_LINE = 46;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function wrapLine(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    if (word.length <= maxChars) {
      current = word;
    } else {
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      current = '';
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function extractDocxPlainText(buffer: Buffer): string {
  const zip = new PizZip(buffer);
  const file = zip.file('word/document.xml');
  if (!file) return '';

  const xml = file.asText();
  const paragraphs = xml.split(/<\/w:p>/);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const runs = [...paragraph.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)];
    if (runs.length === 0) continue;
    const text = runs.map((match) => decodeXmlEntities(match[1] ?? '')).join('');
    if (text.trim()) lines.push(text.trim());
  }
  return lines.join('\n');
}

/** Simple SVG placeholder for legacy .doc / PDF when raster thumbs are unavailable. */
export function renderOfficePlaceholderSvg(fileName: string): Buffer {
  const lower = fileName.toLowerCase();
  const label = lower.endsWith('.pdf')
    ? 'PDF'
    : lower.endsWith('.doc')
      ? 'DOC'
      : 'FILE';
  const title = escapeXml(fileName);
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="10" y="10" width="${PAGE_WIDTH - 20}" height="${PAGE_HEIGHT - 20}" rx="6" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="10" y="10" width="${PAGE_WIDTH - 20}" height="36" rx="6" fill="#475569"/>
  <rect x="10" y="28" width="${PAGE_WIDTH - 20}" height="18" fill="#475569"/>
  <text x="${MARGIN_X}" y="33" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700">${label}</text>
  <text x="${MARGIN_X}" y="120" fill="#0f172a" font-family="Segoe UI, Arial, sans-serif" font-size="${TITLE_SIZE}" font-weight="600">${title}</text>
  <text x="${MARGIN_X}" y="160" fill="#64748b" font-family="Segoe UI, Arial, sans-serif" font-size="12">Preview not available</text>
</svg>`;
  return Buffer.from(svg, 'utf8');
}

/** First-page SVG preview extracted from DOCX XML (no converter required). */
export function renderDocxPreviewSvg(buffer: Buffer, fileName: string): Buffer {
  const rawText = extractDocxPlainText(buffer);
  const bodyLines: string[] = [];
  for (const paragraph of rawText.split('\n')) {
    bodyLines.push(...wrapLine(paragraph, CHARS_PER_LINE));
    if (bodyLines.length >= MAX_BODY_LINES) break;
  }
  const clipped = bodyLines.slice(0, MAX_BODY_LINES);
  const overflow = bodyLines.length > MAX_BODY_LINES || rawText.length > 0 && clipped.length === MAX_BODY_LINES;

  const titleLines = wrapLine(fileName.replace(/\.docx$/i, ''), 36).slice(0, 2);
  let y = 78;
  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 18;
      return `<tspan x="${MARGIN_X}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  y = 128;
  const bodyTspans = (clipped.length > 0 ? clipped : ['(No extractable text)'])
    .map((line, index) => {
      const dy = index === 0 ? 0 : LINE_HEIGHT;
      return `<tspan x="${MARGIN_X}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH}" height="${PAGE_HEIGHT}" viewBox="0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <rect x="10" y="10" width="${PAGE_WIDTH - 20}" height="${PAGE_HEIGHT - 20}" rx="6" fill="#ffffff" stroke="#e2e8f0"/>
  <rect x="10" y="10" width="${PAGE_WIDTH - 20}" height="36" rx="6" fill="#1d4ed8"/>
  <rect x="10" y="28" width="${PAGE_WIDTH - 20}" height="18" fill="#1d4ed8"/>
  <text x="${MARGIN_X}" y="33" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif" font-size="12" font-weight="700">WORD</text>
  <text x="${PAGE_WIDTH - MARGIN_X}" y="33" text-anchor="end" fill="#dbeafe" font-family="Segoe UI, Arial, sans-serif" font-size="11">.docx</text>
  <text x="${MARGIN_X}" y="78" fill="#0f172a" font-family="Segoe UI, Arial, sans-serif" font-size="${TITLE_SIZE}" font-weight="600">${titleTspans}</text>
  <text x="${MARGIN_X}" y="${y}" fill="#334155" font-family="Segoe UI, Arial, sans-serif" font-size="${BODY_SIZE}">${bodyTspans}</text>
  ${overflow ? `<text x="${MARGIN_X}" y="${PAGE_HEIGHT - 28}" fill="#94a3b8" font-family="Segoe UI, Arial, sans-serif" font-size="11">Preview truncated</text>` : ''}
</svg>`;

  return Buffer.from(svg, 'utf8');
}
