export type RecordNumberEntity =
  | 'rfq'
  | 'job'
  | 'estimate'
  | 'work_order'
  | 'invoice'
  | 'purchase_order';

export interface RecordNumberEntityConfig {
  /** Prefix used in generated numbers, e.g. "RFQ" → RFQ-200001 */
  prefix: string;
  /** First number assigned when no sequence row exists for the tenant. */
  startValue: number;
}

export const RECORD_NUMBER_CONFIG: Record<RecordNumberEntity, RecordNumberEntityConfig> = {
  rfq: { prefix: 'RFQ', startValue: 200_001 },
  job: { prefix: 'JOB', startValue: 200_001 },
  estimate: { prefix: 'EST', startValue: 200_001 },
  work_order: { prefix: 'WO', startValue: 200_001 },
  invoice: { prefix: 'INV', startValue: 200_001 },
  purchase_order: { prefix: 'PO', startValue: 200_001 },
};

export function formatRecordNumber(prefix: string, value: number): string {
  return `${prefix}-${value}`;
}
