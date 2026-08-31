import {
  isFixedMarkupType,
  parseRateNumber,
  rateToPercentPoints,
} from '../../../common/rates';

export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function csvRow(values: Array<string | null | undefined>): string {
  return values.map((v) => csvEscape(v ?? '')).join(',');
}

export function formatCsvBool(value: boolean): string {
  return value ? 'TRUE' : 'FALSE';
}

/** Internal CSV keeps stored decimal rates; Crunchwork CSV uses percentage points. */
export function formatRateForCsv(params: {
  value: string | null | undefined;
  format: 'internal' | 'crunchwork';
  markupType?: string | null;
  asPercentPoints: boolean;
}): string {
  const raw = params.value;
  if (raw == null || raw === '') return '';
  if (params.format === 'internal' || !params.asPercentPoints) return String(raw);
  if (params.markupType && isFixedMarkupType(params.markupType)) return String(raw);
  return String(rateToPercentPoints(parseRateNumber(raw)));
}

export function formatCwMarkupType(markupType: string | null | undefined): string {
  const key = (markupType ?? 'percent').toLowerCase();
  if (key === 'fixed' || key === 'absolute') return 'Absolute';
  if (key === 'none') return 'None';
  return 'Percentage';
}

export function catalogFilenameSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'catalog'
  );
}

export function kindSortRank(kind: string): number {
  if (kind === 'scope') return 0;
  if (kind === 'assembly') return 1;
  return 2;
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  let current: unknown = obj;
  for (const part of path.split('.')) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function formatMetadataCsvValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'boolean') return formatCsvBool(value);
  if (Array.isArray(value)) return value.map(String).join(',');
  return String(value);
}

export function parseMetadataJson(raw: string): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}
