import { JobTransformer } from './job.transformer';

describe('JobTransformer', () => {
  let transformer: JobTransformer;

  const basePayload: Record<string, unknown> = {
    id: 'job-uuid-001',
    jobType: { name: 'Assessment', externalReference: 'jt-01' },
    status: { name: 'Open', externalReference: 'st-01' },
    claim: { id: 'claim-uuid-001', policyNumber: 'POL-001' },
  };

  beforeAll(() => {
    transformer = new JobTransformer();
  });

  describe('transform with real CW payload shape', () => {

    it('marks inbound jobs as synced when no existing sync status', () => {
      const result = transformer.transform({
        payload: basePayload,
        tenantId: 'test-tenant',
      });
      expect(result.entity.syncStatus).toBe('synced');
    });

    it('preserves an existing pending or failed sync status', () => {
      const result = transformer.transform({
        payload: basePayload,
        tenantId: 'test-tenant',
        existingEntity: { syncStatus: 'pending' } as never,
      });
      expect(result.entity.syncStatus).toBe('pending');
    });

    it('extracts jobInstructions from payload.jobInstructions', () => {
      const result = transformer.transform({
        payload: { ...basePayload, jobInstructions: 'Home Pack' },
        tenantId: 'test-tenant',
      });
      expect(result.entity.jobInstructions).toBe('Home Pack');
    });

    it('falls back to payload.instructions if jobInstructions absent', () => {
      const result = transformer.transform({
        payload: { ...basePayload, instructions: 'Fallback text' },
        tenantId: 'test-tenant',
      });
      expect(result.entity.jobInstructions).toBe('Fallback text');
    });

    it('extracts temporaryAccommodationDetails from top-level keys', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          emergency: true,
          habitableProperty: false,
          numberOfAdults: 2,
          numberOfChildren: 1,
        },
        tenantId: 'test-tenant',
      });
      expect(result.entity.temporaryAccommodationDetails).toEqual(
        expect.objectContaining({
          emergency: true,
          habitableProperty: false,
          numberOfAdults: 2,
          numberOfChildren: 1,
        }),
      );
    });

    it('extracts specialistDetails from top-level keys', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          isSpecificSpecialistRequired: false,
          specialistCategory: { name: 'Plumber', externalReference: 'plumb-01' },
          locationOfDamage: 'Kitchen',
        },
        tenantId: 'test-tenant',
      });
      expect(result.entity.specialistDetails).toEqual(
        expect.objectContaining({
          isSpecificSpecialistRequired: false,
          specialistCategory: { name: 'Plumber', externalReference: 'plumb-01' },
          locationOfDamage: 'Kitchen',
        }),
      );
    });

    it('extracts rectificationDetails from top-level keys', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          originalJobReference: 'JOB-123',
          paidJob: true,
        },
        tenantId: 'test-tenant',
      });
      expect(result.entity.rectificationDetails).toEqual(
        expect.objectContaining({
          originalJobReference: 'JOB-123',
          paidJob: true,
        }),
      );
    });

    it('extracts auditDetails from top-level auditType', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          auditType: { name: 'Final Audit', externalReference: 'aud-01' },
        },
        tenantId: 'test-tenant',
      });
      expect(result.entity.auditDetails).toEqual({
        auditType: { name: 'Final Audit', externalReference: 'aud-01' },
      });
    });

    it('extracts mobilityConsiderations as structured array', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          mobilityConsiderations: [
            { name: 'Wheelchair', externalReference: 'mc-01' },
            { name: 'Walker', externalReference: 'mc-02' },
          ],
        },
        tenantId: 'test-tenant',
      });
      expect(result.entity.mobilityConsiderations).toEqual([
        { name: 'Wheelchair', externalReference: 'mc-01' },
        { name: 'Walker', externalReference: 'mc-02' },
      ]);
    });

    it('resolves parent claim ref from nested claim object', () => {
      const result = transformer.transform({
        payload: {
          id: 'job-uuid',
          claim: { id: 'claim-uuid', policyNumber: 'POL-001' },
          jobType: { name: 'Assessment', externalReference: 'jt-01' },
        },
        tenantId: 'test-tenant',
      });
      expect(result.parentRefs).toContainEqual(
        expect.objectContaining({
          entityType: 'claim',
          externalId: 'claim-uuid',
          required: true,
        }),
      );
    });

    it('extracts contacts without externalReference when email/name present', () => {
      const result = transformer.transform({
        payload: {
          ...basePayload,
          contacts: [
            {
              firstName: 'Ada',
              lastName: 'Lovelace',
              email: 'ada@example.com',
              mobilePhone: '0412 345 678',
            },
          ],
        },
        tenantId: 'test-tenant',
      });
      expect(result.contacts).toEqual([
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          mobilePhone: '0412 345 678',
        }),
      ]);
      expect(result.contacts?.[0]?.externalReference).toBeUndefined();
    });
  });
});
