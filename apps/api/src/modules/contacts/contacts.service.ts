import { Injectable } from '@nestjs/common';
import { ContactsRepository } from '../../database/repositories';
import { TenantContext } from '../../tenant/tenant-context';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepo: ContactsRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async findAll(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findAll({
      tenantId,
      page: params.page,
      limit: params.limit,
      search: params.search,
    });
  }

  async findOne(params: { id: string }) {
    const tenantId = this.tenantContext.getTenantId();
    return this.contactsRepo.findOne({ id: params.id, tenantId });
  }
}
