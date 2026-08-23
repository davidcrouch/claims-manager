import { formatRecordNumber, RECORD_NUMBER_CONFIG } from './record-number.config';
import { RecordNumberService } from './record-number.service';

describe('RecordNumberService', () => {
  describe('formatRecordNumber', () => {
    it('formats uppercase prefix and numeric suffix', () => {
      expect(formatRecordNumber('RFQ', 200_546)).toBe('RFQ-200546');
      expect(formatRecordNumber('EST', 200_001)).toBe('EST-200001');
    });
  });

  describe('isBlank', () => {
    const service = new RecordNumberService({} as never);

    it('treats null, undefined, and whitespace as blank', () => {
      expect(service.isBlank(null)).toBe(true);
      expect(service.isBlank(undefined)).toBe(true);
      expect(service.isBlank('   ')).toBe(true);
    });

    it('treats non-empty strings as present', () => {
      expect(service.isBlank('RFQ-100')).toBe(false);
    });
  });

  describe('RECORD_NUMBER_CONFIG', () => {
    it('defines entity numbering starting at 200001 with uppercase prefixes', () => {
      expect(RECORD_NUMBER_CONFIG.rfq).toEqual({ prefix: 'RFQ', startValue: 200_001 });
      expect(RECORD_NUMBER_CONFIG.job).toEqual({ prefix: 'JOB', startValue: 200_001 });
      expect(RECORD_NUMBER_CONFIG.estimate).toEqual({ prefix: 'EST', startValue: 200_001 });
    });
  });
});
