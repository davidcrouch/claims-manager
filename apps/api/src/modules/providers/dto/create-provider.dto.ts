import { IsString, IsOptional, IsBoolean, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConnectionDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['staging', 'production'])
  environment: string;

  @IsString()
  baseUrl: string;

  @IsOptional()
  @IsString()
  baseApi?: string;

  @IsOptional()
  @IsString()
  authUrl?: string;

  @IsOptional()
  @IsString()
  authType?: string;

  @IsOptional()
  @IsString()
  clientIdentifier?: string;

  @IsOptional()
  @IsString()
  providerTenantId?: string;

  @IsOptional()
  credentials?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  webhookSecret?: string;

  @IsOptional()
  config?: Record<string, unknown>;
}

export class CreateProviderDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateConnectionDto)
  connection?: CreateConnectionDto;
}
