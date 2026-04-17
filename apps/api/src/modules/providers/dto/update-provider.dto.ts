import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateProviderDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateConnectionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  baseUrl?: string;

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
