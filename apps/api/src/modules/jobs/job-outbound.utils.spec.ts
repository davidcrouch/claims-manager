import {
  applyCrunchworkJobDates,
  buildCrunchworkJobCreateBody,
  claimApiContactsToOutbound,
  isCwUsableLookupRef,
  lookupToCwObject,
  pickCrunchworkJobDates,
  toCrunchworkDate,
} from './job-outbound.utils';

describe('job-outbound.utils', () => {
  describe('claimApiContactsToOutbound', () => {
    it('maps claim api_payload contacts and falls back to id for externalReference', () => {
      const contacts = claimApiContactsToOutbound({
        contacts: [
          {
            id: 'e1a71812-b113-4811-9726-cd722e2ae58f',
            firstName: 'TEST',
            lastName: 'DREWERACV',
            externalReference: null,
            type: { name: 'insured', externalReference: 'insured' },
          },
          {
            id: 'fa3860c2-48e9-4488-9f18-48c611966403',
            firstName: 'Prefect',
            lastName: 'Automation',
            email: 'prefect.automation@iag.com.au',
            externalReference: null,
            type: { name: 'mainContact', externalReference: 'maincontact' },
          },
        ],
      });

      expect(contacts).toEqual([
        {
          externalReference: 'e1a71812-b113-4811-9726-cd722e2ae58f',
          firstName: 'TEST',
          lastName: 'DREWERACV',
          type: { externalReference: 'insured', name: 'insured' },
        },
        {
          externalReference: 'fa3860c2-48e9-4488-9f18-48c611966403',
          firstName: 'Prefect',
          lastName: 'Automation',
          email: 'prefect.automation@iag.com.au',
          type: { externalReference: 'maincontact', name: 'mainContact' },
        },
      ]);
    });

    it('skips contacts missing both id/externalReference or type', () => {
      expect(
        claimApiContactsToOutbound({
          contacts: [
            { firstName: 'No', lastName: 'Ids', type: { externalReference: 'insured' } },
            { id: 'abc', firstName: 'NoType' },
          ],
        }),
      ).toEqual([]);
    });
  });

  describe('lookupToCwObject', () => {
    it('accepts CW refs and rejects seed refs', () => {
      expect(
        lookupToCwObject({ name: 'Builder Make Safe', externalReference: 'MS' }),
      ).toEqual({ externalReference: 'MS', name: 'Builder Make Safe' });
      expect(isCwUsableLookupRef('seed-contact-type-broker')).toBe(false);
      expect(
        lookupToCwObject({
          name: 'Broker',
          externalReference: 'seed-contact-type-broker',
        }),
      ).toBeNull();
    });
  });

  describe('buildCrunchworkJobCreateBody', () => {
    it('builds CW create body with required fields', () => {
      const body = buildCrunchworkJobCreateBody({
        cwClaimId: '3ce05f84-4b1b-493f-b588-08ff49e86b94',
        jobType: { externalReference: 'MS', name: 'Builder Make Safe' },
        status: { externalReference: 'Pending', name: 'Pending' },
        contacts: [
          {
            externalReference: 'e1a71812-b113-4811-9726-cd722e2ae58f',
            firstName: 'TEST',
            lastName: 'DREWERACV',
            type: { externalReference: 'insured', name: 'insured' },
          },
        ],
        address: { suburb: 'Melbourne', state: 'VIC' },
        makeSafeRequired: false,
      });

      expect(body).toMatchObject({
        claimId: '3ce05f84-4b1b-493f-b588-08ff49e86b94',
        jobType: { externalReference: 'MS', name: 'Builder Make Safe' },
        status: { externalReference: 'Pending', name: 'Pending' },
        makeSafeRequired: false,
        address: { suburb: 'Melbourne', state: 'VIC' },
      });
      expect(body).not.toHaveProperty('jobTypeLookupId');
      expect(body).not.toHaveProperty('claimIdLookup');
    });
  });

  describe('pickCrunchworkJobDates / applyCrunchworkJobDates', () => {
    it('converts date-only values to ISO datetimes', () => {
      expect(toCrunchworkDate('2026-08-23')).toBe('2026-08-23T00:00:00.000Z');
    });

    it('reads booked and attendance dates from customData', () => {
      expect(
        pickCrunchworkJobDates({
          customData: {
            bookedDate: '2026-08-23',
            attendanceDate: '2026-08-24',
            workflowPhase: 'scheduled',
          },
        }),
      ).toEqual({
        bookedDate: '2026-08-23T00:00:00.000Z',
        attendanceDate: '2026-08-24T00:00:00.000Z',
      });
    });

    it('overlays dates onto existing CW customData without forwarding internal keys', () => {
      const body = applyCrunchworkJobDates(
        { jobInstructions: 'Attend site' },
        {
          customData: {
            bookedDate: '2026-08-23',
            attendanceDate: '2026-08-24',
            workflowPhase: 'scheduled',
          },
          cwCustomData: { insurerNote: 'keep-me' },
        },
      );

      expect(body).toEqual({
        jobInstructions: 'Attend site',
        customData: {
          insurerNote: 'keep-me',
          bookedDate: '2026-08-23T00:00:00.000Z',
          attendanceDate: '2026-08-24T00:00:00.000Z',
        },
      });
      expect(body.customData).not.toHaveProperty('workflowPhase');
    });

    it('leaves the body unchanged when dates are absent', () => {
      expect(applyCrunchworkJobDates({ status: { externalReference: 'Pending' } }, {})).toEqual({
        status: { externalReference: 'Pending' },
      });
    });
  });
});
