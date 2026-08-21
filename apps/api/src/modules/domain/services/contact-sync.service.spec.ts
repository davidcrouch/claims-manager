import { Test, TestingModule } from '@nestjs/testing';
import { ContactsRepository } from '../../../database/repositories';
import { ClaimContactsRepository } from '../../../database/repositories';
import { JobContactsRepository } from '../../../database/repositories/job-contacts.repository';
import { ContactSyncService } from './contact-sync.service';
import { LookupResolutionService } from './lookup-resolution.service';
import type { RawContact } from '../transformers/transformer.interface';

describe('ContactSyncService', () => {
  let service: ContactSyncService;

  const mockContactsRepo = {
    findMatchingContact: jest.fn(),
    findByEmail: jest.fn(),
    mergeFillBlanks: jest.fn(),
    create: jest.fn(),
  };

  const mockClaimContactsRepo = {
    upsert: jest.fn().mockResolvedValue({}),
  };

  const mockJobContactsRepo = {
    upsert: jest.fn().mockResolvedValue({}),
  };

  const mockLookupResolution = {
    resolveField: jest.fn().mockResolvedValue(null),
  };

  const tx = {} as never;
  const tenantId = 'tenant-1';
  const claimId = 'claim-1';

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactSyncService,
        { provide: ContactsRepository, useValue: mockContactsRepo },
        { provide: ClaimContactsRepository, useValue: mockClaimContactsRepo },
        { provide: JobContactsRepository, useValue: mockJobContactsRepo },
        { provide: LookupResolutionService, useValue: mockLookupResolution },
      ],
    }).compile();

    service = module.get(ContactSyncService);
    service.onModuleInit();
  });

  function raw(partial: Partial<RawContact> & { sourcePayload?: Record<string, unknown> }): RawContact {
    return {
      sourcePayload: partial.sourcePayload ?? { ...partial },
      ...partial,
    };
  }

  it('creates a new contact and links claim_contacts when no match', async () => {
    mockContactsRepo.findMatchingContact.mockResolvedValue(null);
    mockContactsRepo.findByEmail.mockResolvedValue(null);
    mockContactsRepo.create.mockResolvedValue({ id: 'contact-new' });

    await service.syncForEntity({
      entityType: 'claim',
      entityId: claimId,
      tenantId,
      contacts: [
        raw({
          firstName: 'Ada',
          lastName: 'Lovelace',
          email: 'ada@example.com',
          mobilePhone: '0412345678',
        }),
      ],
      strategy: 'additive',
      tx,
    });

    expect(mockContactsRepo.create).toHaveBeenCalled();
    expect(mockClaimContactsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId,
          claimId,
          contactId: 'contact-new',
          sortIndex: 0,
        }),
      }),
    );
  });

  it('merges fill-blanks when matched by identity cascade', async () => {
    const existing = {
      id: 'contact-1',
      tenantId,
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: null,
      mobilePhone: null,
    };
    mockContactsRepo.findMatchingContact.mockResolvedValue(existing);
    mockContactsRepo.mergeFillBlanks.mockResolvedValue({ ...existing, lastName: 'Lovelace' });

    await service.syncForEntity({
      entityType: 'claim',
      entityId: claimId,
      tenantId,
      contacts: [
        raw({
          email: 'ada@example.com',
          lastName: 'Lovelace',
          mobilePhone: '0412 345 678',
          externalReference: 'cw-ada',
        }),
      ],
      strategy: 'additive',
      tx,
    });

    expect(mockContactsRepo.create).not.toHaveBeenCalled();
    expect(mockContactsRepo.mergeFillBlanks).toHaveBeenCalledWith(
      expect.objectContaining({
        existing,
        data: expect.objectContaining({
          email: 'ada@example.com',
          lastName: 'Lovelace',
          externalReference: 'cw-ada',
        }),
      }),
    );
    expect(mockClaimContactsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: 'contact-1', claimId }),
      }),
    );
  });

  it('syncs contacts without externalReference when email/phone/name present', async () => {
    mockContactsRepo.findMatchingContact.mockResolvedValue(null);
    mockContactsRepo.findByEmail.mockResolvedValue(null);
    mockContactsRepo.create.mockResolvedValue({ id: 'contact-no-ext' });

    await service.syncForEntity({
      entityType: 'claim',
      entityId: claimId,
      tenantId,
      contacts: [raw({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' })],
      strategy: 'additive',
      tx,
    });

    expect(mockContactsRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalReference: null,
          email: 'grace@example.com',
        }),
      }),
    );
    expect(mockClaimContactsRepo.upsert).toHaveBeenCalled();
  });

  it('treats email unique collision as a match and merges', async () => {
    const byEmail = {
      id: 'contact-email',
      tenantId,
      email: 'dup@example.com',
      firstName: null,
    };
    mockContactsRepo.findMatchingContact.mockResolvedValue(null);
    mockContactsRepo.findByEmail.mockResolvedValue(byEmail);
    mockContactsRepo.mergeFillBlanks.mockResolvedValue({ ...byEmail, firstName: 'Dup' });

    await service.syncForEntity({
      entityType: 'claim',
      entityId: claimId,
      tenantId,
      contacts: [raw({ email: 'dup@example.com', firstName: 'Dup', lastName: 'User' })],
      strategy: 'additive',
      tx,
    });

    expect(mockContactsRepo.create).not.toHaveBeenCalled();
    expect(mockContactsRepo.mergeFillBlanks).toHaveBeenCalledWith(
      expect.objectContaining({ existing: byEmail }),
    );
    expect(mockClaimContactsRepo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: 'contact-email' }),
      }),
    );
  });

  it('skips contacts with no identity signals', async () => {
    await service.syncForEntity({
      entityType: 'claim',
      entityId: claimId,
      tenantId,
      contacts: [raw({ notes: 'orphan note only' })],
      strategy: 'additive',
      tx,
    });

    expect(mockContactsRepo.findMatchingContact).not.toHaveBeenCalled();
    expect(mockContactsRepo.create).not.toHaveBeenCalled();
    expect(mockClaimContactsRepo.upsert).not.toHaveBeenCalled();
  });
});
