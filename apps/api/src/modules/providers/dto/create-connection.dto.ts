import { IsString, IsOptional, IsIn } from 'class-validator';

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
