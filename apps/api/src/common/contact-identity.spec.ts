import {
  buildContactFillBlanksUpdate,
  hasContactIdentity,
  isBlankContactValue,
  normalizePhoneDigits,
} from './contact-identity';

describe('contact-identity', () => {
  describe('normalizePhoneDigits', () => {
    it('strips non-digits', () => {
      expect(normalizePhoneDigits('+61 412-345-678')).toBe('61412345678');
    });

    it('returns null for empty / non-phone', () => {
      expect(normalizePhoneDigits(null)).toBeNull();
      expect(normalizePhoneDigits('')).toBeNull();
      expect(normalizePhoneDigits('---')).toBeNull();
    });
  });

  describe('isBlankContactValue', () => {
    it('treats null, undefined, and whitespace as blank', () => {
      expect(isBlankContactValue(null)).toBe(true);
      expect(isBlankContactValue(undefined)).toBe(true);
      expect(isBlankContactValue('  ')).toBe(true);
      expect(isBlankContactValue('a')).toBe(false);
    });
  });

  describe('buildContactFillBlanksUpdate', () => {
    it('fills blank scalars and always applies extRef + payload when provided', () => {
      const update = buildContactFillBlanksUpdate({
        existing: {
          firstName: 'Ada',
          lastName: null,
          email: 'ada@example.com',
          mobilePhone: null,
          homePhone: '',
          workPhone: null,
          notes: null,
          typeLookupId: null,
          preferredContactMethodLookupId: null,
          externalReference: null,
          contactPayload: {},
        },
        inbound: {
          firstName: 'Ignored',
          lastName: 'Lovelace',
          email: 'other@example.com',
          mobilePhone: '0412 345 678',
          homePhone: '02 9000 0000',
          workPhone: null,
          notes: 'note',
          typeLookupId: 'type-1',
          preferredContactMethodLookupId: null,
          externalReference: 'cw-ada',
          contactPayload: { id: 'cw-ada' },
        },
      });

      expect(update).toEqual({
        lastName: 'Lovelace',
        mobilePhone: '0412 345 678',
        homePhone: '02 9000 0000',
        notes: 'note',
        typeLookupId: 'type-1',
        externalReference: 'cw-ada',
        contactPayload: { id: 'cw-ada' },
      });
      expect(update.firstName).toBeUndefined();
      expect(update.email).toBeUndefined();
    });
  });

  describe('hasContactIdentity', () => {
    it('requires full name when no other signals', () => {
      expect(hasContactIdentity({ firstName: 'Ada' })).toBe(false);
      expect(hasContactIdentity({ firstName: 'Ada', lastName: 'Lovelace' })).toBe(true);
    });

    it('accepts email, phone, or externalReference alone', () => {
      expect(hasContactIdentity({ email: 'a@b.com' })).toBe(true);
      expect(hasContactIdentity({ mobilePhone: '0412' })).toBe(true);
      expect(hasContactIdentity({ externalReference: 'x' })).toBe(true);
    });
  });
});
