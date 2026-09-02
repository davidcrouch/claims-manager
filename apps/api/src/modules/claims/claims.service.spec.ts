import { Test, TestingModule } from '@nestjs/testing';
import { ClaimsRepository, JobsRepository } from '../../database/repositories';
import { ClaimsService } from './claims.service';
import { TenantContext } from '../../tenant/tenant-context';
import { CrunchworkService } from '../../crunchwork/crunchwork.service';

describe('ClaimsService', () => {
  let service: ClaimsService;
  let crunchworkService: jest.Mocked<CrunchworkService>;

  const mockTenantContext = {
    getTenantId: jest.fn().mockReturnValue('tenant-1'),
    hasTenant: jest.fn().mockReturnValue(true),
  };

  const mockClaimsRepo = {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    findOne: jest.fn().mockResolvedValue(null),
    findInsuredNamesByClaimIds: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...data, id: 'claim-1' }),
    ),
    update: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...data, id: 'claim-1' }),
    ),
  };

  const mockJobsRepo = {
    findSummariesByClaimIds: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: ClaimsRepository, useValue: mockClaimsRepo },
        { provide: JobsRepository, useValue: mockJobsRepo },
        { provide: TenantContext, useValue: mockTenantContext },
        {
          provide: CrunchworkService,
          useValue: {
            createClaim: jest.fn().mockResolvedValue({ id: 'cw-claim-1', claimNumber: 'CLM-001' }),
            updateClaim: jest.fn().mockResolvedValue({ id: 'cw-claim-1', claimNumber: 'CLM-001' }),
          },
        },
      ],
    }).compile();

    service = module.get<ClaimsService>(ClaimsService);
    crunchworkService = module.get(CrunchworkService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated claims', async () => {
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result).toEqual({ data: [], total: 0 });
      expect(mockClaimsRepo.findAll).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        page: 1,
        limit: 20,
        search: undefined,
        sort: undefined,
        status: undefined,
        account: undefined,
        jobType: undefined,
      });
      expect(mockJobsRepo.findSummariesByClaimIds).not.toHaveBeenCalled();
      expect(mockClaimsRepo.findInsuredNamesByClaimIds).not.toHaveBeenCalled();
    });

    it('should attach job type summaries for listed claims', async () => {
      mockClaimsRepo.findAll.mockResolvedValueOnce({
        data: [
          {
            id: 'claim-1',
            tenantId: 'tenant-1',
            statusLookupId: 'st-1',
            accountLookupId: null,
            statusName: 'Open',
            statusExternalReference: null,
            accountName: null,
            accountExternalReference: null,
          },
        ],
        total: 1,
      });
      mockJobsRepo.findSummariesByClaimIds.mockResolvedValueOnce([
        {
          id: 'job-1',
          claimId: 'claim-1',
          internalNumber: 'JOB-200423',
          name: null,
          externalJobId: null,
          externalReference: null,
          jobTypeLookupId: 'jt-1',
          jobTypeName: 'Inspection',
        },
        {
          id: 'job-2',
          claimId: 'claim-1',
          internalNumber: 'JOB-200422',
          name: null,
          externalJobId: null,
          externalReference: null,
          jobTypeLookupId: 'jt-2',
          jobTypeName: 'Repair',
        },
      ]);
      mockClaimsRepo.findInsuredNamesByClaimIds.mockResolvedValueOnce([
        { claimId: 'claim-1', insuredName: 'Jane Doe' },
      ]);

      const result = await service.findAll({ page: 1, limit: 20 });
      expect(mockJobsRepo.findSummariesByClaimIds).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        claimIds: ['claim-1'],
      });
      expect(mockClaimsRepo.findInsuredNamesByClaimIds).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        claimIds: ['claim-1'],
      });
      expect(result.data[0].insuredName).toBe('Jane Doe');
      expect(result.data[0].jobs).toEqual([
        {
          id: 'job-1',
          internalNumber: 'JOB-200423',
          name: null,
          externalJobId: null,
          externalReference: null,
          jobTypeLookupId: 'jt-1',
          jobType: { id: 'jt-1', name: 'Inspection' },
        },
        {
          id: 'job-2',
          internalNumber: 'JOB-200422',
          name: null,
          externalJobId: null,
          externalReference: null,
          jobTypeLookupId: 'jt-2',
          jobType: { id: 'jt-2', name: 'Repair' },
        },
      ]);
    });
  });

  describe('create', () => {
    it('should create claim via Crunchwork and persist locally', async () => {
      const body = { claimNumber: 'CLM-001', account: { externalReference: 'ACC001' } };
      const result = await service.create({ body });
      expect(crunchworkService.createClaim).toHaveBeenCalledWith({
        connectionId: 'tenant-1',
        body,
      });
      expect(result).toBeDefined();
    });
  });
});
