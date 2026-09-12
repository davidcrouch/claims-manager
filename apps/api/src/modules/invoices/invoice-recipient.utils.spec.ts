import { BadRequestException } from '@nestjs/common';

/** Mirrors invoices.service parseRecipientType for unit coverage. */
function parseRecipientType(
  raw: unknown,
): 'insurer' | 'insured' | 'other' | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'insurer' || v === 'insured' || v === 'other') return v;
  return null;
}

function assertRecipientForCreate(params: {
  recipientType: unknown;
  recipientContactId?: unknown;
  contactEmail?: string | null;
  isExternalJob: boolean;
}): { recipientType: 'insurer' | 'insured' | 'other'; recipientContactId: string | null } {
  const recipientType = parseRecipientType(params.recipientType);
  if (!recipientType) {
    throw new BadRequestException(
      'recipientType is required (insurer, insured, or other)',
    );
  }

  const recipientContactIdRaw =
    typeof params.recipientContactId === 'string' && params.recipientContactId
      ? params.recipientContactId
      : null;

  if (recipientType === 'insurer') {
    if (!params.isExternalJob) {
      throw new BadRequestException(
        'Insurer recipient is only available for Crunchwork / external jobs',
      );
    }
    return { recipientType, recipientContactId: null };
  }

  if (!recipientContactIdRaw) {
    throw new BadRequestException(
      'recipientContactId is required for insured and other recipients',
    );
  }
  if (!params.contactEmail?.trim()) {
    throw new BadRequestException(
      'Recipient contact must have an email address',
    );
  }
  return { recipientType, recipientContactId: recipientContactIdRaw };
}

describe('invoice recipient validation', () => {
  it('accepts insurer on external jobs without contact', () => {
    expect(
      assertRecipientForCreate({
        recipientType: 'insurer',
        isExternalJob: true,
      }),
    ).toEqual({ recipientType: 'insurer', recipientContactId: null });
  });

  it('rejects insurer on internal jobs', () => {
    expect(() =>
      assertRecipientForCreate({
        recipientType: 'insurer',
        isExternalJob: false,
      }),
    ).toThrow(BadRequestException);
  });

  it('requires contact with email for insured', () => {
    expect(() =>
      assertRecipientForCreate({
        recipientType: 'insured',
        isExternalJob: false,
      }),
    ).toThrow(/recipientContactId/);

    expect(() =>
      assertRecipientForCreate({
        recipientType: 'insured',
        recipientContactId: 'c1',
        contactEmail: '',
        isExternalJob: false,
      }),
    ).toThrow(/email/);

    expect(
      assertRecipientForCreate({
        recipientType: 'Insured',
        recipientContactId: 'c1',
        contactEmail: 'a@b.com',
        isExternalJob: false,
      }),
    ).toEqual({ recipientType: 'insured', recipientContactId: 'c1' });
  });

  it('requires contact with email for other', () => {
    expect(
      assertRecipientForCreate({
        recipientType: 'other',
        recipientContactId: 'c2',
        contactEmail: 'other@example.com',
        isExternalJob: true,
      }),
    ).toEqual({ recipientType: 'other', recipientContactId: 'c2' });
  });

  it('rejects missing recipientType', () => {
    expect(() =>
      assertRecipientForCreate({
        recipientType: undefined,
        isExternalJob: false,
      }),
    ).toThrow(/recipientType is required/);
  });
});
