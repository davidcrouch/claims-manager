import { IsUUID } from 'class-validator';

export class SeedTenantDto {
  @IsUUID()
  tenantId!: string;
}
