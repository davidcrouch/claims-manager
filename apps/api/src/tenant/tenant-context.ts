import { Injectable, Scope } from '@nestjs/common';
import { TenantContextData } from './interfaces/tenant-context.interface';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  private data: TenantContextData | null = null;

  setTenant(params: TenantContextData): void {
    this.data = params;
  }

  getTenantId(): string {
    if (!this.data) {
      throw new Error('[TenantContext.getTenantId] Tenant context not set');
    }
    return this.data.tenantId;
  }

  getCrunchworkTenantId(): string {
    if (!this.data) {
      throw new Error('[TenantContext.getCrunchworkTenantId] Tenant context not set');
    }
    return this.data.crunchworkTenantId;
  }

  hasTenant(): boolean {
    return this.data !== null;
  }
}
