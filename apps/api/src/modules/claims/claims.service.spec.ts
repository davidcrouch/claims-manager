import { Test, TestingModule } from '@nestjs/testing';
import { ClaimsRepository } from '../../database/repositories';
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
    create: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...data, id: 'claim-1' }),
    ),
    update: jest.fn().mockImplementation(({ data }) =>
      Promise.resolve({ ...data, id: 'claim-1' }),
    ),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClaimsService,
        { provide: ClaimsRepository, useValue: mockClaimsRepo },
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
      });
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
